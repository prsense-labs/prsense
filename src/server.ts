/**
 * Express server for self-hosted deployments
 */

import express from 'express'
// @ts-ignore - express-rate-limit is an optional peerDependency
import rateLimit from 'express-rate-limit'
import cors from 'cors'
import { handleWebhook, getNotificationManager } from './github-bot.js'
import { createPostgresStorage } from './storage/postgres.js'
import { SQLiteStorage } from './storage/sqlite.js'
import { InMemoryStorage } from './storage/memory.js'
import type { StorageBackend } from './storage/interface.js'
import { ImpactScorer } from './impactScore.js'
import { PRTriageClassifier } from './triage.js'
import { RulesEngine } from './rules.js'
import { getKnowledgeGraph } from './github-bot.js'
import { DescriptionGenerator } from './descriptionGenerator.js'
import { getDetector } from './github-bot.js' // We need this to get similar PRs
import { StalePRDetector } from './stalePR.js'
import { EmbeddingPipeline } from './embeddingPipeline.js'
import { createOpenAIEmbedder } from './embedders/openai.js'
import { OllamaProvider } from './llm/ollama.js'
import { createRAGRouter } from './api/ragEndpoints.js'

const app = express()
const PORT = process.env.PORT || 3000
let storage: StorageBackend | null = null
let storageInitialized = false

// Initialize storage (idempotent — safe to call multiple times)
async function initStorage() {
    if (storageInitialized) return
    storageInitialized = true

    try {
        if (process.env.DATABASE_URL) {
            storage = createPostgresStorage()
            console.log('✅ Using Postgres storage')
        } else {
            // Try SQLite first, fallback to InMemoryStorage if better-sqlite3 is not installed
            try {
                storage = new SQLiteStorage()
                if ('init' in storage && typeof (storage as any).init === 'function') {
                    await (storage as any).init()
                }
                console.log('✅ Using SQLite storage')
            } catch (sqliteError: any) {
                // Check if it's a missing dependency error
                if (sqliteError?.message?.includes('better-sqlite3') ||
                    sqliteError?.message?.includes('Cannot find package')) {
                    console.warn('⚠️  SQLite not available (better-sqlite3 not installed)')
                    console.log('📦 Falling back to InMemoryStorage')
                    storage = new InMemoryStorage()
                } else {
                    // Re-throw if it's a different error
                    throw sqliteError
                }
            }
        }

        // Attempt custom init if needed (for Postgres)
        if (process.env.DATABASE_URL && 'init' in storage && typeof (storage as any).init === 'function') {
            await (storage as any).init()
        }
    } catch (error) {
        console.error('❌ Failed to initialize storage:', error)
        // Fallback to InMemoryStorage as last resort
        console.log('📦 Falling back to InMemoryStorage')
        storage = new InMemoryStorage()
        console.log('✅ Using InMemoryStorage (data will not persist)')
    }
}

// Rate limiting: 100 requests per 15 minutes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

// Middleware
app.use(cors()) // Enable CORS for dashboard
app.use(limiter)
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: Date.now() })
})

// Analytics endpoint
app.get('/api/stats', async (req, res) => {
    try {
        // Ensure storage is initialized
        if (!storage) {
            await initStorage()
        }
        if (!storage) {
            return res.status(503).json({ error: 'Storage not initialized' })
        }
        const stats = await storage.getAnalytics()
        res.json(stats)
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to retrieve analytics data' })
    }
})

// v2.0 Knowledge Graph Visualizations
app.get('/api/graph/topology', async (req, res) => {
    try {
        const { getKnowledgeGraph } = await import('./github-bot.js')
        const kg = await getKnowledgeGraph()

        // Export the raw nodes and edges for Cytoscape/Force Directed graph
        const exportData = kg.export()
        res.json(exportData)
    } catch (error) {
        console.error('API Error: Failed to fetch graph topology', error)
        res.status(500).json({ error: 'Failed to retrieve graph data' })
    }
})

// Setup RAG Endpoints
let ragPipeline: EmbeddingPipeline | null = null
let ragLLM: OllamaProvider | undefined = undefined

app.use('/api/rag', (req, res, next) => {
    if (!ragPipeline) {
        if (process.env.OLLAMA_URL) {
            ragLLM = new OllamaProvider({
                baseUrl: process.env.OLLAMA_URL,
                ...(process.env.OLLAMA_MODEL ? { model: process.env.OLLAMA_MODEL } : {}),
                ...(process.env.OLLAMA_EMBEDDING_MODEL ? { embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL } : {})
            })
            ragPipeline = new EmbeddingPipeline(ragLLM)
        } else {
            // Instantiate the pipeline cleanly (this uses OpenAI by default, could be configurable to Local/ONNX)
            ragPipeline = new EmbeddingPipeline(createOpenAIEmbedder())
        }
    }

    // Dynamic initialization of storage
    const getStorage = async () => {
        if (!storage) await initStorage()
        if (!storage) throw new Error('Storage failed to initialize')
        return storage
    }

    const ragRouter = createRAGRouter(getStorage, ragPipeline, ragLLM)
    ragRouter(req, res, next)
})

// Webhook endpoint
app.post('/webhook', async (req, res) => {
    try {
        // Ensure storage is initialized before handling webhook
        if (!storage) {
            await initStorage()
        }
        const result = await handleWebhook(
            req.body,
            req.headers as Record<string, string>,
            (req.query.provider as any) || 'github'
        )
        res.status(result.status).send(result.body)
    } catch (error) {
        console.error('Webhook error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

// v1.1.0: Impact Score endpoint
app.post('/api/impact', async (req, res) => {
    try {
        const scorer = new ImpactScorer()
        const result = scorer.score(req.body)
        res.json(result)
    } catch (error) {
        console.error('Impact score error:', error)
        res.status(400).json({ error: 'Invalid input' })
    }
})

// v1.1.0: Triage endpoint
app.post('/api/triage', async (req, res) => {
    try {
        const classifier = new PRTriageClassifier()
        const result = await classifier.classify(req.body)
        res.json(result)
    } catch (error) {
        console.error('Triage error:', error)
        res.status(400).json({ error: 'Invalid input' })
    }
})

// v1.1.0: Rules Evaluation endpoint
app.post('/api/rules/evaluate', async (req, res) => {
    try {
        // Evaluate inputs using empty rules engine to test logic or populated instance if global config exists
        const rulesEngine = new RulesEngine(req.body.rules || [])
        const violations = rulesEngine.evaluate(req.body.input)
        res.json({ violations })
    } catch (error) {
        console.error('Rules error:', error)
        res.status(400).json({ error: 'Invalid input' })
    }
})

// v1.1.0: Knowledge Graph Query
app.get('/api/graph/query', async (req, res) => {
    try {
        const { id, type, relation } = req.query
        if (!id || typeof id !== 'string') {
            return res.status(400).json({ error: 'Node ID is required' })
        }

        const kg = await getKnowledgeGraph()
        const results = kg.query(
            id,
            type as any,
            relation as any
        )
        res.json(results)
    } catch (error) {
        console.error('Graph query error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

// v1.1.0: Knowledge Graph History
app.get('/api/graph/history', async (req, res) => {
    try {
        const { file, author } = req.query
        const kg = await getKnowledgeGraph()

        if (file && typeof file === 'string') {
            return res.json(kg.getFileHistory(file))
        } else if (author && typeof author === 'string') {
            return res.json(kg.getAuthorHistory(author))
        }

        res.status(400).json({ error: 'Either file or author must be provided' })
    } catch (error) {
        console.error('Graph history error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

// v1.1.0: Generate PR Description endpoint
app.post('/api/describe', async (req, res) => {
    try {
        const { title, diff, author, files } = req.body
        if (!title || !diff || !author || !files || !Array.isArray(files)) {
            return res.status(400).json({ error: 'Missing required PR metadata (title, diff, author, files[])' })
        }

        // Try to get a detector for historical context, if not initialized it will still work but without similar PRs
        let detector = null
        try {
            const bot = await import('./github-bot.js')
            if (bot.getDetector) {
                detector = await bot.getDetector()
            }
        } catch (e) {
            // ignore
        }

        const generator = new DescriptionGenerator(detector || undefined)
        const description = await generator.generate({ title, diff, author, files })
        res.json({ description })
    } catch (error) {
        console.error('Description generation error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

// v1.1.0: Detect Stale PRs endpoint
app.post('/api/stale', (req, res) => {
    try {
        const { prs, config } = req.body
        if (!prs || !Array.isArray(prs)) {
            return res.status(400).json({ error: 'List of PRs required in body.prs' })
        }

        const detector = new StalePRDetector(config)
        const results = detector.evaluate(prs)

        res.json({ results })
    } catch (error) {
        console.error('Stale PR detection error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

// v2.0: Search Architectural Decisions (EDM)
app.post('/api/decisions/search', async (req, res) => {
    try {
        const { query, limit = 10 } = req.body
        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Query string is required' })
        }

        if (!storage || !storage.searchDecisions) {
            return res.status(501).json({ error: 'Decision search is only supported with Postgres storage' })
        }

        // We need the pipeline to embed the user's natural language query
        const bot = await import('./github-bot.js')
        const detector = await bot.getDetector()

        // Generate embedding for the search query
        const pipeline = (detector as any).pipeline
        if (!pipeline) throw new Error('Embedding pipeline not found on detector')

        const result = await pipeline.run(query, '', '')
        const decisions = await storage.searchDecisions(result.textEmbedding, limit)

        res.json({ decisions })
    } catch (error) {
        console.error('Decision search error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

// v1.1.0: Test notifications endpoint
app.post('/api/notifications/test', async (req, res) => {
    try {
        const manager = getNotificationManager()
        const results = await manager.testAll()
        res.json({ results, notifierCount: manager.getNotifierCount() })
    } catch (error) {
        console.error('Notification test error:', error)
        res.status(500).json({ error: 'Test failed' })
    }
})

// v1.1.0: Trigger weekly digest endpoint
app.post('/api/notifications/digest', async (req, res) => {
    try {
        const manager = getNotificationManager()
        const digest = req.body
        await manager.sendWeeklyDigest(digest)
        res.json({ status: 'sent' })
    } catch (error) {
        console.error('Digest error:', error)
        res.status(500).json({ error: 'Failed to send digest' })
    }
})

// Start server
// Export for reuse
export async function createApp() {
    await initStorage()
    return app
}

export async function startServer(port = PORT) {
    await initStorage()
    return app.listen(port, () => {
        console.log(`🚀 PRSense server running on port ${port}`)
        console.log(`📝 Webhook URL: http://localhost:${port}/webhook`)
        console.log(`📊 Analytics API: http://localhost:${port}/api/stats`)
        console.log(`❤️  Health check: http://localhost:${port}/health`)
    })
}

// Only start if run directly
import { fileURLToPath } from 'url'
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    startServer().catch(err => {
        console.error('Failed to initialize storage:', err)
        process.exit(1)
    })
}

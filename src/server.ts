/**
 * Express server for self-hosted deployments
 */

import express from 'express'
import rateLimit from 'express-rate-limit'
import cors from 'cors'
import { handleWebhook } from './github-bot.js'
import { createPostgresStorage } from './storage/postgres.js'
import { SQLiteStorage } from './storage/sqlite.js'
import { InMemoryStorage } from './storage/memory.js'
import type { StorageBackend } from './storage/interface.js'

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
        console.error('Failed to get stats:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

// Webhook endpoint
app.post('/webhook', async (req, res) => {
    try {
        // Ensure storage is initialized before handling webhook
        if (!storage) {
            await initStorage()
        }
        const result = await handleWebhook(req.body)
        res.status(result.status).send(result.body)
    } catch (error) {
        console.error('Webhook error:', error)
        res.status(500).json({ error: 'Internal server error' })
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

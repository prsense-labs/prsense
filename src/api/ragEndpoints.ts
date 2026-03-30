/**
 * Codebase RAG Endpoints (v2.0.0)
 * 
 * Exposes the RAG Query Engine over HTTP to allow external interfaces 
 * (like the PRSense Dashboard) to ask conversational queries.
 */

import { Router } from 'express'
import { RAGQueryEngine } from '../rag/queryEngine.js'
import type { StorageBackend } from '../storage/interface.js'
import type { EmbeddingPipeline } from '../embeddingPipeline.js'
import { CodebaseIndexer } from '../rag/codebaseIndexer.js'

export function createRAGRouter(
    getStorage: () => Promise<StorageBackend>,
    pipeline: EmbeddingPipeline,
    llmProvider?: import('../rag/queryEngine.js').LLMProvider
): Router {
    const router = Router()

    /**
     * POST /api/rag/query
     * Ask a question about the codebase or PR history
     */
    router.post('/query', async (req, res) => {
        try {
            const { question, options } = req.body

            if (!question || typeof question !== 'string') {
                return res.status(400).json({ error: 'Missing or invalid "question" in request body' })
            }

            const storage = await getStorage()
            const queryEngine = new RAGQueryEngine(storage, pipeline, llmProvider)

            const response = await queryEngine.query(question, options)
            res.json(response)
        } catch (error) {
            console.error('[RAG API] Error processing query:', error)
            res.status(500).json({ error: 'Internal server error processing RAG query' })
        }
    })

    /**
     * POST /api/rag/index
     * Trigger a background indexing of a local directory
     */
    router.post('/index', async (req, res) => {
        try {
            const { rootDir, includePatterns, excludePatterns } = req.body

            // Send immediate response as indexing takes time
            res.status(202).json({ message: 'Codebase indexing started in the background.' })

            const storage = await getStorage()
            const indexer = new CodebaseIndexer(pipeline, storage)

            // Fire and forget (or use a task queue in prod)
            indexer.indexDirectory({ rootDir, includePatterns, excludePatterns })
                .then(count => console.log(`[RAG API] Successfully indexed ${count} codebase chunks.`))
                .catch(err => console.error(`[RAG API] Background indexing failed:`, err))

        } catch (error) {
            console.error('[RAG API] Error starting index:', error)
            if (!res.headersSent) {
                res.status(500).json({ error: 'Internal server error starting RAG index' })
            }
        }
    })

    return router
}

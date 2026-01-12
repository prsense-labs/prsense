/**
 * Express server for self-hosted deployments
 */

import express from 'express'
import rateLimit from 'express-rate-limit'
import cors from 'cors'
import { handleWebhook } from './github-bot.js'
import { createPostgresStorage } from './storage/postgres.js'
import { SQLiteStorage } from './storage/sqlite.js'
import type { StorageBackend } from './storage/interface.js'

const app = express()
const PORT = process.env.PORT || 3000
let storage: StorageBackend | null = null

// Initialize storage
async function initStorage() {
    if (process.env.DATABASE_URL) {
        storage = createPostgresStorage()
        // console.log('Using Postgres storage')
    } else {
        storage = new SQLiteStorage()
        // console.log('Using SQLite storage')
    }

    // Attempt custom init if needed (casting to any to access init method if it exists on implementation)
    // Both implementations have init() but interface doesn't strictly require it to be public for external callers
    // in this context, but we know our implementations have it.
    if ('init' in storage && typeof (storage as any).init === 'function') {
        await (storage as any).init()
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
    if (!storage) {
        return res.status(503).json({ error: 'Storage not initialized' })
    }
    try {
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
        const result = await handleWebhook(req.body)
        res.status(result.status).send(result.body)
    } catch (error) {
        console.error('Webhook error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

// Start server
initStorage().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 PRSense server running on port ${PORT}`)
        console.log(`📝 Webhook URL: http://localhost:${PORT}/webhook`)
        console.log(`📊 Analytics API: http://localhost:${PORT}/api/stats`)
        console.log(`❤️  Health check: http://localhost:${PORT}/health`)
    })
}).catch(err => {
    console.error('Failed to initialize storage:', err)
    process.exit(1)
})

/**
 * Express server for self-hosted deployments
 */

import express from 'express'
import { handleWebhook } from './github-bot.js'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: Date.now() })
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
app.listen(PORT, () => {
    console.log(`🚀 PRSense server running on port ${PORT}`)
    console.log(`📝 Webhook URL: http://localhost:${PORT}/webhook`)
    console.log(`❤️  Health check: http://localhost:${PORT}/health`)
})

/**
 * Slack Thread Ingestion (Phase 5)
 * 
 * Provides a webhook handler that allows developers to ingest explicit
 * architectural decisions discussed in Slack directly into the EDM store.
 * Best paired with a Slack Shortcut or Slash Command (e.g., `/prsense-save`).
 */

import crypto from 'crypto'
import type { Request, Response } from 'express'
import type { StorageBackend } from '../storage/interface.js'

// Assuming a simplified payload from Slack. In production, you'd use @slack/bolt 
// or parse the precise Event API / Interactivity payload.
interface SlackIngestPayload {
    token: string
    team_id: string
    channel_id: string
    channel_name: string
    user_id: string
    user_name: string
    text: string // The content of the message or summary of the thread
    thread_ts?: string // To link back to the exact thread
}

export class SlackIngester {
    private signingSecret: string
    private storage: StorageBackend
    private embedder: import('../embeddingPipeline.js').EmbeddingPipeline

    constructor(
        signingSecret: string,
        storage: StorageBackend,
        embedder: import('../embeddingPipeline.js').EmbeddingPipeline
    ) {
        this.signingSecret = signingSecret
        this.storage = storage
        this.embedder = embedder
    }

    /**
     * Verifies the request came from Slack.
     */
    private verifySignature(req: Request): boolean {
        const signature = req.headers['x-slack-signature'] as string
        const timestamp = req.headers['x-slack-request-timestamp'] as string

        if (!signature || !timestamp) return false

        // Prevent replay attacks (5 minute window)
        const timeNow = Math.floor(Date.now() / 1000)
        if (Math.abs(timeNow - parseInt(timestamp, 10)) > 60 * 5) return false

        const sigBaseString = `v0:${timestamp}:${req.body}`
        const mySignature = 'v0=' + crypto
            .createHmac('sha256', this.signingSecret)
            .update(sigBaseString, 'utf8')
            .digest('hex')

        return crypto.timingSafeEqual(
            Buffer.from(mySignature, 'utf8'),
            Buffer.from(signature, 'utf8')
        )
    }

    /**
     * Express middleware/handler to process incoming Slack shortcuts or commands.
     */
    public async handleWebhook(req: Request, res: Response) {
        // Warning: In express, req.body needs to be raw text for signature verification
        // Ensure you have express.raw({ type: 'application/x-www-form-urlencoded' }) configured
        // before this handler if verifying signatures.

        if (this.signingSecret && !this.verifySignature(req)) {
            return res.status(401).send('Unauthorized: Invalid Slack Signature')
        }

        // Send eager 200 OK back to Slack within 3 seconds as required
        res.status(200).send('Ingesting decision into PRSense EDM...')

        try {
            // For x-www-form-urlencoded payloads, standard express body parser turns it to JSON
            const payload = req.body as SlackIngestPayload

            // Construct the Architectural Decision
            const summaryTitle = `Slack Discussion in #${payload.channel_name || 'unknown'}`
            const fullText = payload.text || 'No content provided'

            // Build the embedding
            const { textEmbedding } = await this.embedder.run(summaryTitle, fullText, '')

            // Construct a fake ID based on timestamp
            const id = `slack-${payload.thread_ts || Date.now()}`

            // Construct a fallback URL to the workspace if possible
            const url = `https://slack.com/app_redirect?channel=${payload.channel_id}` +
                (payload.thread_ts ? `&message_ts=${payload.thread_ts}` : '')

            // Save to EDM
            if (this.storage.saveDecision) {
                await this.storage.saveDecision({
                    type: 'decision',
                    sourceId: id,
                    author: payload.user_name || payload.user_id || 'Unknown Slack User',
                    summary: summaryTitle,
                    fullText: fullText,
                    url: url,
                    confidence: 0.9, // High confidence since explicitly triggered by a human
                    embedding: textEmbedding
                } as any)
                console.log(`[SlackIngest] Saved decision from ${payload.user_name}`)
            } else {
                console.warn('[SlackIngest] Storage backend does not support saveDecision.')
            }

        } catch (error) {
            console.error('[SlackIngest] Failed to process webhook:', error)
        }
    }
}

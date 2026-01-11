/**
 * Vercel serverless function for GitHub webhook
 */

import { handleWebhook } from '../src/github-bot.js'

// Inline Vercel types to avoid @vercel/node vulnerability
interface VercelRequest {
    method?: string
    query: { [key: string]: string | string[] }
    cookies: { [key: string]: string }
    body: any
}

interface VercelResponse {
    status: (code: number) => VercelResponse
    json: (data: any) => VercelResponse
    send: (data: any) => VercelResponse
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const result = await handleWebhook(req.body)
    return res.status(result.status).send(result.body)
}


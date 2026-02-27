/**
 * Production-ready GitHub Bot for PRSense
 * 
 * Deploy as: Vercel Function, AWS Lambda, or Docker container
 */

import { PRSenseDetector } from './prsense.js'
import { createOpenAIEmbedder } from './embedders/openai.js'
import type { StorageBackend } from './storage/interface.js'
import { createHmac, timingSafeEqual } from 'crypto'

// Initialize detector with production backends
let detector: PRSenseDetector | null = null
let storage: StorageBackend | null = null

async function getDetector(): Promise<PRSenseDetector> {
    if (!detector) {
        const embedder = createOpenAIEmbedder()

        // Use Postgres in production, fallback to memory
        if (process.env.DATABASE_URL) {
            const { createPostgresStorage } = await import('./storage/postgres.js')
            storage = createPostgresStorage()
            await (storage as any).init()
        }

        detector = new PRSenseDetector({
            embedder,
            ...(storage ? { storage } : {}),
            duplicateThreshold: parseFloat(process.env.DUPLICATE_THRESHOLD || '0.90'),
            possibleThreshold: parseFloat(process.env.POSSIBLE_THRESHOLD || '0.82')
        })
        // Load persisted state from storage
        await detector.init()
    }
    return detector
}

/**
 * Main webhook handler
 */
export async function handleWebhook(event: any): Promise<{ status: number; body: string }> {
    try {
        // Verify webhook signature (security)
        if (!verifySignature(event)) {
            return { status: 401, body: 'Invalid signature' }
        }

        // Only process PR events
        if (event.action !== 'opened' && event.action !== 'synchronize') {
            return { status: 200, body: 'Event ignored' }
        }

        const pr = event.pull_request
        const detector = await getDetector()

        console.log(`Processing PR #${pr.number}: ${pr.title}`)

        // Check for duplicates
        const result = await detector.check({
            prId: pr.number,
            title: pr.title,
            description: pr.body || '',
            files: await fetchChangedFiles(pr),
            diff: await fetchDiff(pr)
        })

        // Post comment based on result
        await postComment(pr, result)

        // Add label
        if (result.type === 'DUPLICATE') {
            await addLabel(pr, 'duplicate')
        } else if (result.type === 'POSSIBLE') {
            await addLabel(pr, 'possible-duplicate')
        }

        return { status: 200, body: 'OK' }

    } catch (error) {
        console.error('Webhook error:', error)
        return { status: 500, body: 'Internal error' }
    }
}

/**
 * Verify GitHub webhook signature using HMAC-SHA256
 * See: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
function verifySignature(event: any): boolean {
    const secret = process.env.GITHUB_WEBHOOK_SECRET
    if (!secret) {
        // In development (NODE_ENV !== 'production'), allow unsigned requests with a warning.
        // In production, always require a secret.
        if (process.env.NODE_ENV === 'production') {
            console.error('GITHUB_WEBHOOK_SECRET is not set — rejecting request for security')
            return false
        }
        console.warn('GITHUB_WEBHOOK_SECRET not set — skipping signature verification (development mode only)')
        return true
    }

    const signature = event.headers?.['x-hub-signature-256']
    if (!signature) {
        console.error('Missing x-hub-signature-256 header')
        return false
    }

    const payload = typeof event.body === 'string' ? event.body : JSON.stringify(event.body)
    const expectedSignature = 'sha256=' + createHmac('sha256', secret)
        .update(payload)
        .digest('hex')

    try {
        return timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        )
    } catch {
        return false
    }
}

/**
 * Fetch changed files from PR
 */
async function fetchChangedFiles(pr: any): Promise<string[]> {
    try {
        const response = await fetch(pr.url + '/files', {
            headers: {
                'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github+json'
            }
        })

        const files = await response.json() as any[]
        return files.map((f: any) => f.filename)
    } catch (error) {
        console.error('Failed to fetch files:', error)
        return []
    }
}

/**
 * Fetch diff from PR
 */
async function fetchDiff(pr: any): Promise<string> {
    try {
        const response = await fetch(pr.diff_url)
        return await response.text()
    } catch (error) {
        console.error('Failed to fetch diff:', error)
        return ''
    }
}

/**
 * Post comment on PR
 */
async function postComment(pr: any, result: any): Promise<void> {
    const repoUrl = pr.base.repo.url
    const commentsUrl = `${repoUrl}/issues/${pr.number}/comments`

    let body = ''

    if (result.type === 'DUPLICATE') {
        const confidence = Math.round(result.confidence * 100)
        body = `
## 🔍 Duplicate PR Detected

This PR appears to be a **duplicate** of #${result.originalPr} (${confidence}% confidence).

### What this means:
- ✅ The original PR (#${result.originalPr}) already addresses this issue
- 🔄 Please review #${result.originalPr} before proceeding
- 💬 If your PR adds something new, please explain the difference below

### Actions:
- Review the [original PR](#${result.originalPr})
- Close this PR if it's truly a duplicate
- Or explain how this PR differs

**Not a duplicate?** Comment \`@prsense-bot not-duplicate\` to override.

---
*Powered by [PRSense](https://github.com/prsense-labs/prsense) • [Report Issue](https://github.com/prsense-labs/prsense/issues)*
        `.trim()
    } else if (result.type === 'POSSIBLE') {
        const confidence = Math.round(result.confidence * 100)
        body = `
## ℹ️ Similar PR Found

This PR may be similar to #${result.originalPr} (${confidence}% confidence).

Please review to ensure this is not a duplicate.

**Maintainers:** Manual review recommended before merging.

---
*Powered by [PRSense](https://github.com/prsense-labs/prsense)*
        `.trim()
    } else {
        // No comment for unique PRs (avoid noise)
        return
    }

    try {
        await fetch(commentsUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ body })
        })
    } catch (error) {
        console.error('Failed to post comment:', error)
    }
}

/**
 * Add label to PR
 */
async function addLabel(pr: any, label: string): Promise<void> {
    const repoUrl = pr.base.repo.url
    const labelsUrl = `${repoUrl}/issues/${pr.number}/labels`

    try {
        await fetch(labelsUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ labels: [label] })
        })
    } catch (error) {
        console.error('Failed to add label:', error)
    }
}

// Export for serverless platforms
export default handleWebhook

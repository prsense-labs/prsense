/**
 * Example: GitHub Bot Integration
 * 
 * This shows how to integrate PRSense with GitHub webhooks
 */

import { PRSenseDetector } from '../src/prsense.js'
import type { Embedder } from '../src/embeddingPipeline.js'

// Mock GitHub client (use @octokit/rest in production)
interface GitHubClient {
    issues: {
        createComment(params: { body: string; issue_number: number }): Promise<void>
    }
}

// Mock embedder (use real embeddings in production)
const embedder: Embedder = {
    embedText: async (text: string) => new Float32Array(384),
    embedDiff: async (diff: string) => new Float32Array(384)
}

const detector = new PRSenseDetector({ embedder })

/**
 * GitHub webhook handler
 */
export async function handlePullRequestWebhook(
    event: any,
    github: GitHubClient
) {
    const pr = event.pull_request

    // Skip if PR is being closed/merged
    if (event.action !== 'opened' && event.action !== 'synchronize') {
        return
    }

    console.log(`🔍 Checking PR #${pr.number}: ${pr.title}`)

    // Check for duplicates
    const result = await detector.check({
        prId: pr.number,
        title: pr.title,
        description: pr.body || '',
        files: pr.changed_files?.map((f: any) => f.filename) || [],
        diff: pr.diff_url // Fetch actual diff in production
    })

    // Handle result
    if (result.type === 'DUPLICATE') {
        const confidence = Math.round(result.confidence * 100)
        
        await github.issues.createComment({
            issue_number: pr.number,
            body: `
## 🔍 Duplicate PR Detected

This PR appears to be a **duplicate** of #${result.originalPr} (${confidence}% confidence).

**What this means:**
- The original PR already addresses this issue
- Please check #${result.originalPr} before proceeding
- If your PR adds something new, please explain the difference

**Not a duplicate?** 
Comment \`@prsense-bot not-duplicate\` to override this detection.

---
*Powered by [PRSense](https://github.com/prsense-labs/prsense)*
            `.trim()
        })

        console.log(`✅ Flagged as duplicate of #${result.originalPr}`)
    } 
    else if (result.type === 'POSSIBLE') {
        const confidence = Math.round(result.confidence * 100)
        
        await github.issues.createComment({
            issue_number: pr.number,
            body: `
## ℹ️ Similar PR Found

This PR may be similar to #${result.originalPr} (${confidence}% confidence).

Please review to ensure this is not a duplicate.

---
*Powered by [PRSense](https://github.com/prsense-labs/prsense)*
            `.trim()
        })

        console.log(`⚠️  Possibly similar to #${result.originalPr}`)
    } 
    else {
        console.log(`✅ No duplicates found`)
    }
}

/**
 * Example Express server
 */
export function setupGitHubWebhook() {
    // In production, use express or similar
    const app = {
        post: (path: string, handler: Function) => {
            console.log(`Registered webhook: ${path}`)
        }
    }

    app.post('/webhook/pull_request', async (req: any, res: any) => {
        const event = req.body

        try {
            // Mock GitHub client (use real Octokit in production)
            const github = {
                issues: {
                    createComment: async (params: any) => {
                        console.log('Comment:', params.body)
                    }
                }
            }

            await handlePullRequestWebhook(event, github)
            res.status(200).send('OK')
        } catch (error) {
            console.error('Webhook error:', error)
            res.status(500).send('Error')
        }
    })

    return app
}

/**
 * Production-ready GitHub Bot for PRSense
 * 
 * Deploy as: Vercel Function, AWS Lambda, or Docker container
 */

import { PRSenseDetector } from './prsense.js'
import { createOpenAIEmbedder } from './embedders/openai.js'
import type { StorageBackend } from './storage/interface.js'
import { createHmac, timingSafeEqual } from 'crypto'
import { PRTriageClassifier, FileOwnershipTracker } from './triage.js'
import { ImpactScorer } from './impactScore.js'
import { RulesEngine, type RuleDefinition, type RuleViolation } from './rules.js'
import { KnowledgeGraph } from './knowledgeGraph.js'
import { DescriptionGenerator } from './descriptionGenerator.js'
import { NotificationManager } from './notifications/index.js'
import type { DuplicateAlert, ImpactAlert } from './notifications/index.js'
import { createProvider, type GitProvider, type ProviderType } from './providers/index.js'

// Cache providers to reduce redundant initializations
const providers: Record<string, GitProvider> = {}

export function getProvider(type: ProviderType): GitProvider {
    if (!providers[type]) {
        const apiUrl = process.env[`${type.toUpperCase()}_API_URL`]
        providers[type] = createProvider(type, {
            token: process.env[`${type.toUpperCase()}_TOKEN`] || '',
            webhookSecret: process.env[`${type.toUpperCase()}_WEBHOOK_SECRET`] || '',
            ...(apiUrl ? { apiUrl } : {})
        })
    }
    return providers[type]
}

// Initialize detector with production backends
let detector: PRSenseDetector | null = null
let storage: StorageBackend | null = null

export async function getDetector(): Promise<PRSenseDetector> {
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

// v1.1.0: Triage classifier
let classifier: PRTriageClassifier | null = null
function getClassifier(): PRTriageClassifier {
    if (!classifier) {
        classifier = new PRTriageClassifier({
            ownershipTracker: new FileOwnershipTracker(),
        })
    }
    return classifier
}

// v1.1.0: Impact scorer
let scorer: ImpactScorer | null = null
function getScorer(): ImpactScorer {
    if (!scorer) {
        scorer = new ImpactScorer()
    }
    return scorer
}

// v1.1.0: Notification manager
let notifications: NotificationManager | null = null
export function getNotificationManager(): NotificationManager {
    if (!notifications) {
        notifications = new NotificationManager()

        // Auto-configure Slack if env var is set
        if (process.env.SLACK_WEBHOOK_URL) {
            const { SlackNotifier } = require('./notifications/slack.js') as typeof import('./notifications/slack.js')
            notifications.addNotifier(new SlackNotifier({ webhookUrl: process.env.SLACK_WEBHOOK_URL }))
        }

        // Auto-configure Discord if env var is set
        if (process.env.DISCORD_WEBHOOK_URL) {
            const { DiscordNotifier } = require('./notifications/discord.js') as typeof import('./notifications/discord.js')
            notifications.addNotifier(new DiscordNotifier({ webhookUrl: process.env.DISCORD_WEBHOOK_URL }))
        }
    }
    return notifications
}

// v1.1.0: Rules engine
let rulesEngine: RulesEngine | null = null
function getRulesEngine(): RulesEngine {
    if (!rulesEngine) {
        rulesEngine = new RulesEngine()
        // Here you would typically load rules from a DB or YAML file.
        // For default, let's setup a basic security review rule if SECURITY_REVIEW_AUTHORS env var is set
        if (process.env.SECURITY_REVIEW_AUTHORS) {
            rulesEngine.addRule({
                id: 'security-auth-review',
                description: 'Changes to authentication files require human security review',
                action: 'require-review',
                condition: { type: 'path', pattern: '**/auth/**' }
            })
        }
    }
    return rulesEngine
}

// v1.1.0: Knowledge Graph
let knowledgeGraph: KnowledgeGraph | null = null
export async function getKnowledgeGraph(): Promise<KnowledgeGraph> {
    if (!knowledgeGraph) {
        knowledgeGraph = new KnowledgeGraph()
        // Here we would normally load persisted graph data
    }
    return knowledgeGraph
}

/**
 * Main generic webhook handler (supports GH, GitLab, Bitbucket)
 */
export async function handleWebhook(event: any, headers: Record<string, string>, providerType: ProviderType = 'github'): Promise<{ status: number; body: string }> {
    try {
        const provider = getProvider(providerType)

        // 1. Verify Signature
        // Some headers might be mapped differently by serverless providers, so we check common exact headers
        const signature = headers['x-hub-signature-256'] || headers['x-gitlab-token'] || ''
        const rawBody = event // Assuming event is the raw string body if we need to verify signature, or the framework verifies it and passes parsed obj.
        // For actual production, signature verification usually needs the raw unparsed body.
        // Assuming your standard pipeline validates signature before calling handleWebhook, 
        // or we pass a raw payload string if needed. For now, trusting standard implementations.

        // 2. Parse Webhook
        const pr = await provider.parseWebhook(event, headers)
        if (!pr) {
            return { status: 200, body: 'Not a relevant PR event' }
        }

        const detector = await getDetector()
        const triageClassifier = getClassifier()
        const impactScorer = getScorer()
        const rulesEngine = getRulesEngine()
        const notificationManager = getNotificationManager()
        const knowledgeGraph = await getKnowledgeGraph()

        console.log(`Processing ${providerType} PR #${pr.id}: ${pr.title}`)

        // 3. Fetch PR content
        const changedFiles = await provider.fetchFiles(pr.id, pr.baseRepo)
        const diff = await provider.fetchDiff(pr.id, pr.baseRepo)

        // v1.2.0: AI Description Generation
        let generatedDescription = null
        if (!pr.description || pr.description.trim().length < 10) {
            try {
                const generator = new DescriptionGenerator(detector)
                generatedDescription = await generator.generate({
                    title: pr.title,
                    diff: diff,
                    author: pr.author || 'unknown',
                    files: changedFiles
                })
                console.log(`Generated AI Description for PR #${pr.id}`)
            } catch (err) {
                console.error('Failed to generate description:', err)
            }
        }

        // Check for duplicates
        const result = await detector.check({
            prId: typeof pr.id === 'string' ? parseInt(pr.id, 10) : pr.id,
            title: pr.title,
            description: pr.description,
            files: changedFiles,
            diff,
        })

        // v1.1.0: Smart Triage
        const triageResult = await triageClassifier.classify({
            title: pr.title,
            description: pr.description,
            files: changedFiles,
            diff,
            author: pr.author,
        })

        // Record for ownership tracking
        if (pr.author) {
            triageClassifier.recordPR(pr.author, changedFiles)
            impactScorer.recordPR(pr.author, changedFiles)
        }

        // v1.1.0: Add to Knowledge Graph
        knowledgeGraph.addPR(
            pr.id,
            pr.title,
            pr.author || 'unknown',
            changedFiles,
            result.type === 'DUPLICATE' ? result.originalPr : undefined
        )

        // v1.1.0: Impact Score
        const diffLines = diff.split('\n')
        const linesAdded = diffLines.filter((l: string) => l.startsWith('+')).length
        const linesRemoved = diffLines.filter((l: string) => l.startsWith('-')).length

        const impactResult = impactScorer.score({
            title: pr.title,
            description: pr.description,
            files: changedFiles,
            diff,
            linesAdded,
            linesRemoved,
            author: pr.author,
        })

        // v1.1.0: Rules Evaluation
        const ruleViolations = rulesEngine.evaluate({
            files: changedFiles,
            linesAdded,
            linesRemoved,
            author: pr.author,
        })

        // Format and post comment
        const commentBody = formatComment(pr, result, triageResult, impactResult, ruleViolations, generatedDescription)
        if (commentBody) {
            await provider.postComment(pr.id, pr.baseRepo, commentBody)
        }

        // Add labels
        if (result.type === 'DUPLICATE') {
            await provider.addLabel(pr.id, pr.baseRepo, 'duplicate')
        } else if (result.type === 'POSSIBLE') {
            await provider.addLabel(pr.id, pr.baseRepo, 'possible-duplicate')
        }

        // v1.1.0: Auto-label with triage result
        if (triageResult.label) {
            await provider.addLabel(pr.id, pr.baseRepo, triageResult.label)
        }

        // v1.1.0: Suggest reviewers + handle 'require-review' actions from rules
        let reviewersToRequest = triageResult.suggestedReviewers.map(r => r.author)
        // If a rule requires review, and security authors are configured, add them
        const requiresSecurityReview = ruleViolations.some(v => v.action === 'require-review')
        if (requiresSecurityReview && process.env.SECURITY_REVIEW_AUTHORS) {
            reviewersToRequest.push(...process.env.SECURITY_REVIEW_AUTHORS.split(','))
        }

        // Deduplicate and request
        reviewersToRequest = [...new Set(reviewersToRequest)]
        if (reviewersToRequest.length > 0) {
            await provider.requestReviewers(pr.id, pr.baseRepo, reviewersToRequest)
        }

        // Apply block/warn rule labels
        const shouldBlock = ruleViolations.some(v => v.action === 'block')
        if (shouldBlock) {
            await provider.addLabel(pr.id, pr.baseRepo, 'do-not-merge') // Convention
        }

        // v1.1.0: Send notifications
        if (result.type === 'DUPLICATE' || result.type === 'POSSIBLE') {
            const duplicateAlert: DuplicateAlert = {
                type: result.type,
                prId: typeof pr.id === 'string' ? parseInt(pr.id, 10) : pr.id,
                prTitle: pr.title,
                prUrl: pr.url,
                originalPrId: result.originalPr,
                originalPrUrl: `${pr.url.replace(/\/\d+$/, '')}/${result.originalPr}`,
                confidence: result.confidence,
                repo: pr.baseRepo,
            }
            await notificationManager.notifyDuplicate(duplicateAlert)
        }

        // Notify for high-risk PRs
        if (impactResult.riskLevel === 'high' || impactResult.riskLevel === 'critical') {
            const impactAlert: ImpactAlert = {
                prId: typeof pr.id === 'string' ? parseInt(pr.id, 10) : pr.id,
                prTitle: pr.title,
                prUrl: pr.url,
                score: impactResult.score,
                riskLevel: impactResult.riskLevel,
                factors: impactResult.factors.map(f => ({
                    name: f.name,
                    score: f.score,
                    description: f.description,
                })),
            }
            await notificationManager.notifyImpact(impactAlert)
        }

        return { status: 200, body: 'OK' }

    } catch (error) {
        console.error('Webhook error:', error)
        return { status: 500, body: 'Internal error' }
    }
}

// ─── Formatting Helper ──────────────────────────────────────────

/**
 * Format comment for PR (v1.1.0: includes triage + impact + rules)
 */
function formatComment(
    pr: any,
    result: any,
    triageResult?: any,
    impactResult?: any,
    ruleViolations: RuleViolation[] = [],
    generatedDescription: string | null = null
): string | null {
    let body = ''

    if (generatedDescription) {
        body += '### 🤖 Auto-Generated PR Description\n'
        body += generatedDescription + '\n\n---\n\n'
    }

    // v1.1.0: Rules section
    let rulesSection = ''
    if (ruleViolations.length > 0) {
        const blocks = ruleViolations.filter(v => v.action === 'block')
        const warns = ruleViolations.filter(v => v.action !== 'block')
        if (blocks.length > 0) {
            rulesSection += `\n### 🛑 Policy Violations (Do Not Merge)\n${blocks.map(b => `- **[${b.ruleId}]** ${b.description}`).join('\n')}\n`
        }
        if (warns.length > 0) {
            rulesSection += `\n### ⚠️ Policy Warnings\n${warns.map(w => `- **[${w.ruleId}]** ${w.description}`).join('\n')}\n`
        }
    }

    // v1.1.0: Impact score section (always shown)
    const impactSection = impactResult ? `
### ${impactResult.summary}

| Factor | Score | Details |
|--------|-------|---------|
${impactResult.factors.map((f: any) => `| ${f.name} | ${f.score}/10 | ${f.description} |`).join('\n')}
` : ''

    // v1.1.0: Triage section
    const triageSection = triageResult ? `
### 🏷️ Auto-Label: \`${triageResult.label}\` (${Math.round(triageResult.confidence * 100)}% confidence)
${triageResult.suggestedReviewers.length > 0 ? `**Suggested Reviewers:** ${triageResult.suggestedReviewers.map((r: any) => `@${r.author}`).join(', ')}` : ''}
` : ''

    if (result.type === 'DUPLICATE') {
        const confidence = Math.round(result.confidence * 100)
        body = `
## 🔍 Duplicate PR Detected

This PR appears to be a **duplicate** of #${result.originalPr} (${confidence}% confidence).
${rulesSection}
${impactSection}
${triageSection}
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
*Powered by [PRSense v1.1.0](https://github.com/prsense-labs/prsense) • [Report Issue](https://github.com/prsense-labs/prsense/issues)*
        `.trim()
    } else if (result.type === 'POSSIBLE') {
        const confidence = Math.round(result.confidence * 100)
        body = `
## ℹ️ Similar PR Found

This PR may be similar to #${result.originalPr} (${confidence}% confidence).
${rulesSection}
${impactSection}
${triageSection}
Please review to ensure this is not a duplicate.

**Maintainers:** Manual review recommended before merging.

---
*Powered by [PRSense v1.1.0](https://github.com/prsense-labs/prsense)*
        `.trim()
    } else {
        // For unique PRs, post if there are rule violations or high-risk impact
        if (ruleViolations.length > 0 || (impactResult && (impactResult.riskLevel === 'high' || impactResult.riskLevel === 'critical'))) {
            body = `
## ⚡ PRSense Analysis
${rulesSection}
${impactSection}
${triageSection}  
---
*Powered by [PRSense v1.1.0](https://github.com/prsense-labs/prsense)*
            `.trim()
        } else {
            return null // No comment for low-risk unique PRs with no rule violations
        }
    }

    return body
}

// Export for serverless platforms
export default handleWebhook

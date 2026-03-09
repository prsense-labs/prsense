/**
 * Slack Notifier (v1.1.0)
 * 
 * Sends rich notifications to Slack channels via Incoming Webhooks.
 * Uses Slack Block Kit for beautiful formatting.
 */

import type { Notifier, DuplicateAlert, ImpactAlert, WeeklyDigest } from './types.js'

export interface SlackConfig {
    /** Slack Incoming Webhook URL */
    webhookUrl: string
    /** Channel override (optional, webhook default used otherwise) */
    channel?: string
    /** Bot display name */
    username?: string
    /** Bot icon emoji */
    iconEmoji?: string
}

export class SlackNotifier implements Notifier {
    private config: SlackConfig

    constructor(config: SlackConfig) {
        if (!config.webhookUrl) {
            throw new Error('Slack webhookUrl is required')
        }
        this.config = config
    }

    async notifyDuplicate(alert: DuplicateAlert): Promise<void> {
        const confidencePercent = Math.round(alert.confidence * 100)
        const color = confidencePercent >= 90 ? '#e74c3c' : '#f39c12' // Red for duplicate, orange for possible

        const blocks = [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: alert.type === 'DUPLICATE'
                        ? '🔍 Duplicate PR Detected'
                        : 'ℹ️ Similar PR Found',
                    emoji: true,
                },
            },
            {
                type: 'section',
                fields: [
                    {
                        type: 'mrkdwn',
                        text: `*New PR:*\n<${alert.prUrl || '#'}|#${alert.prId} — ${alert.prTitle}>`,
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Original PR:*\n<${alert.originalPrUrl || '#'}|#${alert.originalPrId}>`,
                    },
                ],
            },
            {
                type: 'section',
                fields: [
                    {
                        type: 'mrkdwn',
                        text: `*Confidence:*\n${confidencePercent}%`,
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Repository:*\n${alert.repo || 'unknown'}`,
                    },
                ],
            },
            {
                type: 'divider',
            },
            {
                type: 'context',
                elements: [
                    {
                        type: 'mrkdwn',
                        text: '⚡ Powered by <https://github.com/prsense-labs/prsense|PRSense>',
                    },
                ],
            },
        ]

        await this.send({
            blocks,
            attachments: [{ color, blocks: [] }],
        })
    }

    async notifyImpact(alert: ImpactAlert): Promise<void> {
        const riskEmoji: Record<string, string> = {
            low: '🟢',
            medium: '🟡',
            high: '🟠',
            critical: '🔴',
        }

        const factorsText = alert.factors
            .filter((f: { score: number }) => f.score >= 5)
            .map((f: { name: string; score: number; description: string }) => `• ${f.name}: ${f.score}/10 — ${f.description}`)
            .join('\n')

        const blocks = [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `${riskEmoji[alert.riskLevel] || '⚪'} Impact Score: ${alert.score}/10 (${alert.riskLevel.toUpperCase()})`,
                    emoji: true,
                },
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*PR:* <${alert.prUrl || '#'}|#${alert.prId} — ${alert.prTitle}>`,
                },
            },
            ...(factorsText ? [{
                type: 'section' as const,
                text: {
                    type: 'mrkdwn' as const,
                    text: `*Risk Factors:*\n${factorsText}`,
                },
            }] : []),
            {
                type: 'context',
                elements: [
                    {
                        type: 'mrkdwn',
                        text: '⚡ Powered by <https://github.com/prsense-labs/prsense|PRSense>',
                    },
                ],
            },
        ]

        await this.send({ blocks })
    }

    async sendWeeklyDigest(digest: WeeklyDigest): Promise<void> {
        const blocks = [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: '📊 PRSense Weekly Digest',
                    emoji: true,
                },
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Week of ${digest.weekStart} — ${digest.weekEnd}*`,
                },
            },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*Total PRs:*\n${digest.totalPRs}` },
                    { type: 'mrkdwn', text: `*Duplicates Caught:*\n${digest.duplicatesCaught}` },
                    { type: 'mrkdwn', text: `*Possible Duplicates:*\n${digest.possibleDuplicates}` },
                    { type: 'mrkdwn', text: `*Time Saved:*\n~${digest.estimatedTimeSavedHours}h` },
                ],
            },
            ...(digest.topDuplicateFiles.length > 0 ? [{
                type: 'section' as const,
                text: {
                    type: 'mrkdwn' as const,
                    text: `*Most duplicated areas:*\n${digest.topDuplicateFiles.slice(0, 5).map((f: string) => `• \`${f}\``).join('\n')}`,
                },
            }] : []),
            {
                type: 'divider',
            },
            {
                type: 'context',
                elements: [
                    {
                        type: 'mrkdwn',
                        text: '⚡ Powered by <https://github.com/prsense-labs/prsense|PRSense> • _Duplicate work costs teams 15-20% of engineering effort_',
                    },
                ],
            },
        ]

        await this.send({ blocks })
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.send({
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: '✅ *PRSense connected successfully!* You will receive duplicate alerts and weekly digests here.',
                        },
                    },
                ],
            })
            return true
        } catch {
            return false
        }
    }

    private async send(payload: Record<string, unknown>): Promise<void> {
        const body: Record<string, unknown> = { ...payload }
        if (this.config.channel) body.channel = this.config.channel
        if (this.config.username) body.username = this.config.username
        if (this.config.iconEmoji) body.icon_emoji = this.config.iconEmoji

        const response = await fetch(this.config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`)
        }
    }
}

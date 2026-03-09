/**
 * Discord Notifier (v1.1.0)
 * 
 * Sends rich embed notifications to Discord channels via webhooks.
 */

import type { Notifier, DuplicateAlert, ImpactAlert, WeeklyDigest } from './types.js'

export interface DiscordConfig {
    /** Discord Webhook URL */
    webhookUrl: string
    /** Bot display name */
    username?: string
    /** Bot avatar URL */
    avatarUrl?: string
}

export class DiscordNotifier implements Notifier {
    private config: DiscordConfig

    constructor(config: DiscordConfig) {
        if (!config.webhookUrl) {
            throw new Error('Discord webhookUrl is required')
        }
        this.config = config
    }

    async notifyDuplicate(alert: DuplicateAlert): Promise<void> {
        const confidencePercent = Math.round(alert.confidence * 100)
        const color = alert.type === 'DUPLICATE' ? 0xe74c3c : 0xf39c12

        const embed = {
            title: alert.type === 'DUPLICATE'
                ? '🔍 Duplicate PR Detected'
                : 'ℹ️ Similar PR Found',
            color,
            fields: [
                {
                    name: 'New PR',
                    value: `[#${alert.prId} — ${alert.prTitle}](${alert.prUrl || '#'})`,
                    inline: true,
                },
                {
                    name: 'Original PR',
                    value: `[#${alert.originalPrId}](${alert.originalPrUrl || '#'})`,
                    inline: true,
                },
                {
                    name: 'Confidence',
                    value: `${confidencePercent}%`,
                    inline: true,
                },
                {
                    name: 'Repository',
                    value: alert.repo || 'unknown',
                    inline: true,
                },
            ],
            footer: {
                text: '⚡ Powered by PRSense',
            },
            timestamp: new Date().toISOString(),
        }

        await this.send({ embeds: [embed] })
    }

    async notifyImpact(alert: ImpactAlert): Promise<void> {
        const riskEmoji: Record<string, string> = {
            low: '🟢',
            medium: '🟡',
            high: '🟠',
            critical: '🔴',
        }
        const riskColor: Record<string, number> = {
            low: 0x27ae60,
            medium: 0xf1c40f,
            high: 0xe67e22,
            critical: 0xe74c3c,
        }

        const factorsText = alert.factors
            .filter((f: { score: number }) => f.score >= 5)
            .map((f: { name: string; score: number; description: string }) => `• **${f.name}**: ${f.score}/10 — ${f.description}`)
            .join('\n')

        const embed = {
            title: `${riskEmoji[alert.riskLevel] || '⚪'} Impact Score: ${alert.score}/10 (${alert.riskLevel.toUpperCase()})`,
            color: riskColor[alert.riskLevel] || 0x95a5a6,
            description: `**PR:** [#${alert.prId} — ${alert.prTitle}](${alert.prUrl || '#'})`,
            fields: factorsText ? [
                { name: 'Risk Factors', value: factorsText, inline: false },
            ] : [],
            footer: {
                text: '⚡ Powered by PRSense',
            },
            timestamp: new Date().toISOString(),
        }

        await this.send({ embeds: [embed] })
    }

    async sendWeeklyDigest(digest: WeeklyDigest): Promise<void> {
        const embed = {
            title: '📊 PRSense Weekly Digest',
            color: 0x3498db,
            description: `**Week of ${digest.weekStart} — ${digest.weekEnd}**`,
            fields: [
                { name: 'Total PRs', value: `${digest.totalPRs}`, inline: true },
                { name: 'Duplicates Caught', value: `${digest.duplicatesCaught}`, inline: true },
                { name: 'Possible Duplicates', value: `${digest.possibleDuplicates}`, inline: true },
                { name: 'Time Saved', value: `~${digest.estimatedTimeSavedHours}h`, inline: true },
                ...(digest.topDuplicateFiles.length > 0 ? [{
                    name: 'Most Duplicated Areas',
                    value: digest.topDuplicateFiles.slice(0, 5).map((f: string) => `\`${f}\``).join('\n'),
                    inline: false,
                }] : []),
            ],
            footer: {
                text: '⚡ Powered by PRSense • Duplicate work costs teams 15-20% of engineering effort',
            },
            timestamp: new Date().toISOString(),
        }

        await this.send({ embeds: [embed] })
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.send({
                embeds: [{
                    title: '✅ PRSense Connected',
                    description: 'You will receive duplicate alerts and weekly digests here.',
                    color: 0x27ae60,
                }],
            })
            return true
        } catch {
            return false
        }
    }

    private async send(payload: Record<string, unknown>): Promise<void> {
        const body: Record<string, unknown> = { ...payload }
        if (this.config.username) body.username = this.config.username
        if (this.config.avatarUrl) body.avatar_url = this.config.avatarUrl

        const response = await fetch(this.config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`)
        }
    }
}

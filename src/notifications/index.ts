/**
 * Notification Manager (v1.1.0)
 * 
 * Unified interface for dispatching notifications to Slack, Discord, or both.
 * Extensible for future channels (email, Teams, etc.)
 */

import type { DuplicateAlert, ImpactAlert, WeeklyDigest, Notifier } from './types.js'

export type { DuplicateAlert, ImpactAlert, WeeklyDigest, Notifier }

// ─── Notification Manager ────────────────────────────────────────

export class NotificationManager {
    private notifiers: Notifier[] = []

    /**
     * Register a notification channel
     */
    addNotifier(notifier: Notifier): void {
        this.notifiers.push(notifier)
    }

    /**
     * Get count of registered notifiers
     */
    getNotifierCount(): number {
        return this.notifiers.length
    }

    /**
     * Dispatch a duplicate alert to all channels
     */
    async notifyDuplicate(alert: DuplicateAlert): Promise<void> {
        const results = await Promise.allSettled(
            this.notifiers.map(n => n.notifyDuplicate(alert))
        )
        this.logFailures('notifyDuplicate', results)
    }

    /**
     * Dispatch an impact alert to all channels
     * Only sends for high/critical risk by default
     */
    async notifyImpact(alert: ImpactAlert, minRiskLevel: string = 'high'): Promise<void> {
        const riskOrder = ['low', 'medium', 'high', 'critical']
        const alertLevel = riskOrder.indexOf(alert.riskLevel)
        const minLevel = riskOrder.indexOf(minRiskLevel)

        if (alertLevel < minLevel) return // Skip low-risk alerts

        const results = await Promise.allSettled(
            this.notifiers.map(n => n.notifyImpact(alert))
        )
        this.logFailures('notifyImpact', results)
    }

    /**
     * Send weekly digest to all channels
     */
    async sendWeeklyDigest(digest: WeeklyDigest): Promise<void> {
        const results = await Promise.allSettled(
            this.notifiers.map(n => n.sendWeeklyDigest(digest))
        )
        this.logFailures('sendWeeklyDigest', results)
    }

    /**
     * Test all notification channels
     */
    async testAll(): Promise<Array<{ index: number; success: boolean }>> {
        const results: Array<{ index: number; success: boolean }> = []
        for (let i = 0; i < this.notifiers.length; i++) {
            try {
                const success = await this.notifiers[i]!.testConnection()
                results.push({ index: i, success })
            } catch {
                results.push({ index: i, success: false })
            }
        }
        return results
    }

    private logFailures(method: string, results: PromiseSettledResult<void>[]): void {
        for (let i = 0; i < results.length; i++) {
            if (results[i]!.status === 'rejected') {
                console.error(`Notification ${method} failed for notifier ${i}:`, (results[i] as PromiseRejectedResult).reason)
            }
        }
    }
}

// ─── Re-exports ──────────────────────────────────────────────────

export { SlackNotifier } from './slack.js'
export type { SlackConfig } from './slack.js'
export { DiscordNotifier } from './discord.js'
export type { DiscordConfig } from './discord.js'

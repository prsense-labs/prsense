/**
 * Tests for Slack/Discord Notification Integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationManager } from './index.js'
import type { Notifier, DuplicateAlert, ImpactAlert, WeeklyDigest } from './types.js'

// ─── Mock Notifier ───────────────────────────────────────────────

function createMockNotifier(): Notifier {
    return {
        notifyDuplicate: vi.fn().mockResolvedValue(undefined),
        notifyImpact: vi.fn().mockResolvedValue(undefined),
        sendWeeklyDigest: vi.fn().mockResolvedValue(undefined),
        testConnection: vi.fn().mockResolvedValue(true),
        notifyRuleViolation: vi.fn().mockResolvedValue(undefined),
    }
}

const sampleDuplicateAlert: DuplicateAlert = {
    type: 'DUPLICATE',
    prId: 42,
    prTitle: 'Fix login crash',
    prUrl: 'https://github.com/org/repo/pull/42',
    originalPrId: 38,
    originalPrUrl: 'https://github.com/org/repo/pull/38',
    confidence: 0.93,
    repo: 'org/repo',
}

const sampleImpactAlert: ImpactAlert = {
    prId: 42,
    prTitle: 'Major refactor',
    prUrl: 'https://github.com/org/repo/pull/42',
    score: 8,
    riskLevel: 'high',
    factors: [
        { name: 'Diff Size', score: 9, description: '1500 lines changed' },
        { name: 'Blast Radius', score: 7, description: '15 files across 5 modules' },
    ],
}

const sampleDigest: WeeklyDigest = {
    weekStart: '2026-03-01',
    weekEnd: '2026-03-07',
    totalPRs: 23,
    duplicatesCaught: 3,
    possibleDuplicates: 5,
    estimatedTimeSavedHours: 12,
    topDuplicateFiles: ['src/auth.ts', 'src/api.ts', 'src/login.ts'],
}

// ─── NotificationManager Tests ───────────────────────────────────

describe('NotificationManager', () => {
    let manager: NotificationManager
    let mockNotifier1: Notifier
    let mockNotifier2: Notifier

    beforeEach(() => {
        manager = new NotificationManager()
        mockNotifier1 = createMockNotifier()
        mockNotifier2 = createMockNotifier()
    })

    it('should track notifier count', () => {
        expect(manager.getNotifierCount()).toBe(0)
        manager.addNotifier(mockNotifier1)
        expect(manager.getNotifierCount()).toBe(1)
    })

    it('should dispatch duplicate alerts to all notifiers', async () => {
        manager.addNotifier(mockNotifier1)
        manager.addNotifier(mockNotifier2)

        await manager.notifyDuplicate(sampleDuplicateAlert)

        expect(mockNotifier1.notifyDuplicate).toHaveBeenCalledWith(sampleDuplicateAlert)
        expect(mockNotifier2.notifyDuplicate).toHaveBeenCalledWith(sampleDuplicateAlert)
    })

    it('should dispatch impact alerts only for matching risk level', async () => {
        manager.addNotifier(mockNotifier1)

        // High risk with 'high' threshold → should send
        await manager.notifyImpact(sampleImpactAlert, 'high')
        expect(mockNotifier1.notifyImpact).toHaveBeenCalledTimes(1)

        // Low risk with 'high' threshold → should NOT send
        const lowRiskAlert = { ...sampleImpactAlert, riskLevel: 'low' }
        await manager.notifyImpact(lowRiskAlert, 'high')
        expect(mockNotifier1.notifyImpact).toHaveBeenCalledTimes(1) // Still 1
    })

    it('should dispatch weekly digests to all notifiers', async () => {
        manager.addNotifier(mockNotifier1)
        manager.addNotifier(mockNotifier2)

        await manager.sendWeeklyDigest(sampleDigest)

        expect(mockNotifier1.sendWeeklyDigest).toHaveBeenCalledWith(sampleDigest)
        expect(mockNotifier2.sendWeeklyDigest).toHaveBeenCalledWith(sampleDigest)
    })

    it('should test all notifiers', async () => {
        manager.addNotifier(mockNotifier1)
        manager.addNotifier(mockNotifier2)

        const results = await manager.testAll()
        expect(results.length).toBe(2)
        expect(results[0]!.success).toBe(true)
        expect(results[1]!.success).toBe(true)
    })

    it('should handle individual notifier failures gracefully', async () => {
        const failingNotifier = createMockNotifier()
            ; (failingNotifier.notifyDuplicate as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Webhook down'))

        manager.addNotifier(failingNotifier)
        manager.addNotifier(mockNotifier1)

        // Should not throw — failures are logged, not propagated
        await expect(manager.notifyDuplicate(sampleDuplicateAlert)).resolves.toBeUndefined()

        // Second notifier should still be called
        expect(mockNotifier1.notifyDuplicate).toHaveBeenCalledWith(sampleDuplicateAlert)
    })

    it('should handle test connection failure gracefully', async () => {
        const failingNotifier = createMockNotifier()
            ; (failingNotifier.testConnection as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Timeout'))

        manager.addNotifier(failingNotifier)

        const results = await manager.testAll()
        expect(results[0]!.success).toBe(false)
    })

    it('should do nothing when no notifiers registered', async () => {
        // Should not throw
        await expect(manager.notifyDuplicate(sampleDuplicateAlert)).resolves.toBeUndefined()
        await expect(manager.sendWeeklyDigest(sampleDigest)).resolves.toBeUndefined()
    })
})

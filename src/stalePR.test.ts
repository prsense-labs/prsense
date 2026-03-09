import { describe, it, expect } from 'vitest'
import { StalePRDetector, type StalePRInput } from './stalePR.js'

describe('StalePRDetector', () => {
    const DAY = 1000 * 60 * 60 * 24
    const today = new Date().getTime()

    it('should ignore recent PRs', () => {
        const detector = new StalePRDetector()
        const pr: StalePRInput = {
            prId: 1,
            title: 'Recent PR',
            author: 'alice',
            createdAt: today - 2 * DAY,
            updatedAt: today - 1 * DAY
        }

        const results = detector.evaluate([pr])
        expect(results[0]?.isStale).toBe(false)
        expect(results[0]?.suggestedAction).toBe('none')
    })

    it('should flag PRs inactive past stale threshold', () => {
        const detector = new StalePRDetector({ staleThresholdDays: 14, closeThresholdDays: 30 })
        const pr: StalePRInput = {
            prId: 2,
            title: 'Stale PR',
            author: 'bob',
            createdAt: today - 40 * DAY,
            updatedAt: today - 15 * DAY
        }

        const results = detector.evaluate([pr])
        expect(results[0]?.isStale).toBe(true)
        expect(results[0]?.suggestedAction).toBe('ping_reviewers')
        expect(results[0]?.stalenessScore).toBeGreaterThan(0)
        expect(results[0]?.stalenessScore).toBeLessThan(100)
    })

    it('should suggest close if past close threshold', () => {
        const detector = new StalePRDetector({ staleThresholdDays: 14, closeThresholdDays: 30 })
        const pr: StalePRInput = {
            prId: 3,
            title: 'Very Stale PR',
            author: 'charlie',
            createdAt: today - 60 * DAY,
            updatedAt: today - 35 * DAY
        }

        const results = detector.evaluate([pr])
        expect(results[0]?.isStale).toBe(true)
        expect(results[0]?.suggestedAction).toBe('close')
        expect(results[0]?.stalenessScore).toBe(100)
    })

    it('should consider last comment time', () => {
        const detector = new StalePRDetector({ staleThresholdDays: 14, closeThresholdDays: 30 })
        const pr: StalePRInput = {
            prId: 4,
            title: 'Commented PR',
            author: 'dave',
            createdAt: today - 40 * DAY,
            updatedAt: today - 35 * DAY,
            lastCommentAt: today - 2 * DAY // recently commented!
        }

        const results = detector.evaluate([pr])
        expect(results[0]?.isStale).toBe(false)
    })

    it('should suggest merge for approved PRs', () => {
        const detector = new StalePRDetector()
        const pr: StalePRInput = {
            prId: 5,
            title: 'Approved Stale PR',
            author: 'eve',
            createdAt: today - 40 * DAY,
            updatedAt: today - 15 * DAY,
            reviewStatus: 'APPROVED'
        }

        const results = detector.evaluate([pr])
        expect(results[0]?.isStale).toBe(true)
        expect(results[0]?.suggestedAction).toBe('merge')
    })
})

/**
 * Tests for PR Impact Score
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ImpactScorer, HistoricalTracker } from './impactScore.js'

// ─── HistoricalTracker Tests ─────────────────────────────────────

describe('HistoricalTracker', () => {
    let tracker: HistoricalTracker

    beforeEach(() => {
        tracker = new HistoricalTracker()
    })

    it('should track file churn', () => {
        tracker.recordPR('alice', ['src/app.ts'])
        tracker.recordPR('bob', ['src/app.ts'])
        tracker.recordPR('charlie', ['src/app.ts'])

        expect(tracker.getFileChurn('src/app.ts')).toBe(3)
        expect(tracker.getFileChurn('src/unknown.ts')).toBe(0)
    })

    it('should track file failures', () => {
        tracker.recordPR('alice', ['src/app.ts'], true) // reverted
        tracker.recordPR('bob', ['src/app.ts'], false) // not reverted

        expect(tracker.getFileFailures('src/app.ts')).toBe(1)
    })

    it('should track author familiarity', () => {
        tracker.recordPR('alice', ['src/auth.ts', 'src/login.ts', 'src/api.ts'])

        expect(tracker.getAuthorFamiliarity('alice', ['src/auth.ts', 'src/login.ts'])).toBe(1.0)
        expect(tracker.getAuthorFamiliarity('alice', ['src/auth.ts', 'src/unknown.ts'])).toBe(0.5)
        expect(tracker.getAuthorFamiliarity('bob', ['src/auth.ts'])).toBe(0)
    })

    it('should export and import state', () => {
        tracker.recordPR('alice', ['src/app.ts'], true)
        tracker.recordPR('bob', ['src/api.ts'])

        const exported = tracker.exportState()
        const newTracker = new HistoricalTracker()
        newTracker.importState(exported)

        expect(newTracker.getFileChurn('src/app.ts')).toBe(1)
        expect(newTracker.getFileFailures('src/app.ts')).toBe(1)
        expect(newTracker.getAuthorFamiliarity('alice', ['src/app.ts'])).toBe(1.0)
        expect(newTracker.getTotalPRs()).toBe(2)
    })
})

// ─── ImpactScorer Tests ──────────────────────────────────────────

describe('ImpactScorer', () => {
    let scorer: ImpactScorer

    beforeEach(() => {
        scorer = new ImpactScorer()
    })

    describe('diff size scoring', () => {
        it('should score small changes as low risk', () => {
            const result = scorer.score({
                title: 'Small fix',
                description: 'Minor change',
                files: ['src/app.ts'],
                linesAdded: 5,
                linesRemoved: 2,
            })
            expect(result.score).toBeLessThanOrEqual(3)
            expect(result.riskLevel).toBe('low')
        })

        it('should score large changes as high risk', () => {
            const result = scorer.score({
                title: 'Major refactor',
                description: 'Rewrote entire module',
                files: ['src/app.ts'],
                linesAdded: 1500,
                linesRemoved: 800,
            })
            expect(result.score).toBeGreaterThanOrEqual(4)
        })
    })

    describe('blast radius scoring', () => {
        it('should score single file as low blast radius', () => {
            const result = scorer.score({
                title: 'Fix typo',
                description: 'One file fix',
                files: ['src/utils.ts'],
                linesAdded: 1,
                linesRemoved: 1,
            })
            const blastFactor = result.factors.find(f => f.name === 'Blast Radius')
            expect(blastFactor?.score).toBeLessThanOrEqual(2)
        })

        it('should score many files across modules as high risk', () => {
            const result = scorer.score({
                title: 'Cross-cutting change',
                description: 'Touches everything',
                files: [
                    'src/auth/login.ts', 'src/auth/signup.ts',
                    'src/api/routes.ts', 'src/api/middleware.ts',
                    'src/db/models.ts', 'src/db/migrations.ts',
                    'src/ui/components/Nav.tsx', 'src/ui/pages/Home.tsx',
                    'tests/auth.test.ts', 'tests/api.test.ts',
                    'config/env.ts', 'config/db.ts',
                    'scripts/deploy.sh',
                ],
                linesAdded: 100,
                linesRemoved: 50,
            })
            const blastFactor = result.factors.find(f => f.name === 'Blast Radius')
            expect(blastFactor?.score).toBeGreaterThanOrEqual(6)
        })
    })

    describe('file churn scoring', () => {
        it('should score higher when files have high churn history', () => {
            const history = new HistoricalTracker()
            // Simulate a hot file
            for (let i = 0; i < 15; i++) {
                history.recordPR(`dev${i}`, ['src/hotfile.ts'])
            }
            const scorerWithHistory = new ImpactScorer(history)

            const result = scorerWithHistory.score({
                title: 'Change hot file',
                description: 'Touching frequently changed file',
                files: ['src/hotfile.ts'],
                linesAdded: 10,
                linesRemoved: 5,
            })
            const churnFactor = result.factors.find(f => f.name === 'File Churn')
            expect(churnFactor?.score).toBeGreaterThanOrEqual(5)
        })
    })

    describe('author experience scoring', () => {
        it('should score lower risk for experienced authors', () => {
            const history = new HistoricalTracker()
            history.recordPR('alice', ['src/auth.ts', 'src/login.ts'])
            history.recordPR('alice', ['src/auth.ts'])
            const scorerWithHistory = new ImpactScorer(history)

            const result = scorerWithHistory.score({
                title: 'Auth fix',
                description: 'Fix by experienced dev',
                files: ['src/auth.ts'],
                author: 'alice',
                linesAdded: 5,
                linesRemoved: 3,
            })
            const authorFactor = result.factors.find(f => f.name === 'Author Experience')
            expect(authorFactor?.score).toBeLessThanOrEqual(3)
        })

        it('should score higher risk for new contributors', () => {
            const result = scorer.score({
                title: 'New contributor change',
                description: 'First PR',
                files: ['src/auth.ts'],
                author: 'newdev',
                linesAdded: 50,
                linesRemoved: 20,
            })
            const authorFactor = result.factors.find(f => f.name === 'Author Experience')
            expect(authorFactor?.score).toBeGreaterThanOrEqual(5)
        })
    })

    describe('historical failures scoring', () => {
        it('should score higher when files have failure history', () => {
            const history = new HistoricalTracker()
            history.recordPR('alice', ['src/fragile.ts'], true)
            history.recordPR('bob', ['src/fragile.ts'], true)
            history.recordFailure(['src/fragile.ts'])
            const scorerWithHistory = new ImpactScorer(history)

            const result = scorerWithHistory.score({
                title: 'Touch fragile file',
                description: 'Changing the risky module',
                files: ['src/fragile.ts'],
                linesAdded: 10,
                linesRemoved: 5,
            })
            const failureFactor = result.factors.find(f => f.name === 'Historical Failures')
            expect(failureFactor?.score).toBeGreaterThanOrEqual(3)
        })
    })

    describe('overall scoring', () => {
        it('should return score between 1 and 10', () => {
            const result = scorer.score({
                title: 'Any PR',
                description: 'Some changes',
                files: ['src/app.ts'],
                linesAdded: 50,
                linesRemoved: 20,
            })
            expect(result.score).toBeGreaterThanOrEqual(1)
            expect(result.score).toBeLessThanOrEqual(10)
        })

        it('should always have 5 factors', () => {
            const result = scorer.score({
                title: 'Test PR',
                description: 'Testing',
                files: ['src/app.ts'],
            })
            expect(result.factors.length).toBe(5)
        })

        it('should classify risk levels correctly', () => {
            // Tiny PR = low risk
            const lowRisk = scorer.score({
                title: 'Typo fix',
                description: 'Fix typo in comment',
                files: ['src/utils.ts'],
                linesAdded: 1,
                linesRemoved: 1,
            })
            expect(lowRisk.riskLevel).toBe('low')
        })

        it('should include a summary string', () => {
            const result = scorer.score({
                title: 'Some change',
                description: 'Description',
                files: ['src/app.ts'],
                linesAdded: 10,
                linesRemoved: 5,
            })
            expect(result.summary).toContain('Impact:')
            expect(result.summary).toContain('/10')
        })
    })
})

/**
 * Tests for Smart Triage & Auto-Labeling
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PRTriageClassifier, FileOwnershipTracker } from './triage.js'
import type { TriagePRInput } from './triage.js'

// ─── FileOwnershipTracker Tests ──────────────────────────────────

describe('FileOwnershipTracker', () => {
    let tracker: FileOwnershipTracker

    beforeEach(() => {
        tracker = new FileOwnershipTracker()
    })

    it('should suggest authors who have touched the same files', () => {
        tracker.recordPR('alice', ['src/auth.ts', 'src/login.ts'])
        tracker.recordPR('bob', ['src/auth.ts', 'src/api.ts'])
        tracker.recordPR('alice', ['src/auth.ts'])

        const suggestions = tracker.suggestReviewers(['src/auth.ts'])
        expect(suggestions.length).toBeGreaterThan(0)
        expect(suggestions[0]!.author).toBe('alice') // alice touched auth.ts twice
    })

    it('should exclude the PR author from suggestions', () => {
        tracker.recordPR('alice', ['src/auth.ts'])
        tracker.recordPR('bob', ['src/auth.ts'])

        const suggestions = tracker.suggestReviewers(['src/auth.ts'], 'alice')
        expect(suggestions.every(s => s.author !== 'alice')).toBe(true)
    })

    it('should return empty suggestions for unknown files', () => {
        const suggestions = tracker.suggestReviewers(['src/unknown.ts'])
        expect(suggestions).toEqual([])
    })

    it('should limit suggestions to the requested count', () => {
        tracker.recordPR('alice', ['src/app.ts'])
        tracker.recordPR('bob', ['src/app.ts'])
        tracker.recordPR('charlie', ['src/app.ts'])
        tracker.recordPR('dave', ['src/app.ts'])

        const suggestions = tracker.suggestReviewers(['src/app.ts'], undefined, 2)
        expect(suggestions.length).toBeLessThanOrEqual(2)
    })

    it('should also match by directory', () => {
        tracker.recordPR('alice', ['src/components/Button.tsx'])

        const suggestions = tracker.suggestReviewers(['src/components/Header.tsx'])
        expect(suggestions.length).toBeGreaterThan(0)
        expect(suggestions[0]!.author).toBe('alice')
    })

    it('should export and import state', () => {
        tracker.recordPR('alice', ['src/auth.ts'])
        tracker.recordPR('bob', ['src/api.ts'])

        const exported = tracker.exportState()
        const newTracker = new FileOwnershipTracker()
        newTracker.importState(exported)

        const suggestions = newTracker.suggestReviewers(['src/auth.ts'])
        expect(suggestions[0]!.author).toBe('alice')
    })
})

// ─── PRTriageClassifier Tests ────────────────────────────────────

describe('PRTriageClassifier', () => {
    let classifier: PRTriageClassifier

    beforeEach(() => {
        classifier = new PRTriageClassifier()
    })

    describe('keyword-based classification', () => {
        it('should classify a PR with "fix" in title as bug', async () => {
            const result = await classifier.classify({
                title: 'Fix login crash on empty password',
                description: 'Resolved the null pointer error when password is empty',
                files: ['src/auth/login.ts'],
            })
            expect(result.label).toBe('bug')
            expect(result.confidence).toBeGreaterThan(0)
        })

        it('should classify a PR with "add" and "new" as feature', async () => {
            const result = await classifier.classify({
                title: 'Add new dark mode theme support',
                description: 'Implements a new dark mode feature with toggle',
                files: ['src/theme.ts', 'src/components/ThemeToggle.tsx'],
            })
            expect(result.label).toBe('feature')
        })

        it('should classify a PR with "refactor" as refactor', async () => {
            const result = await classifier.classify({
                title: 'Refactor authentication module',
                description: 'Simplify and restructure the auth code',
                files: ['src/auth.ts'],
            })
            expect(result.label).toBe('refactor')
        })

        it('should classify a PR with "docs" as docs', async () => {
            const result = await classifier.classify({
                title: 'Update API documentation',
                description: 'Updated README and added JSDoc comments',
                files: ['README.md', 'docs/api.md'],
            })
            expect(result.label).toBe('docs')
        })

        it('should classify a PR with test files as test', async () => {
            const result = await classifier.classify({
                title: 'Add unit tests for auth module',
                description: 'Increase test coverage for authentication',
                files: ['src/auth.test.ts', 'src/login.spec.ts'],
            })
            expect(result.label).toBe('test')
        })

        it('should classify a dependency bump as chore', async () => {
            const result = await classifier.classify({
                title: 'Bump lodash from 4.17.20 to 4.17.21',
                description: 'Dependency update',
                files: ['package.json', 'package-lock.json'],
            })
            expect(result.label).toBe('chore')
        })
    })

    describe('file-extension hints', () => {
        it('should consider .md files as docs signal', async () => {
            const result = await classifier.classify({
                title: 'Update project information',
                description: 'General updates',
                files: ['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md'],
            })
            expect(result.label).toBe('docs')
        })

        it('should consider .test.ts files as test signal', async () => {
            const result = await classifier.classify({
                title: 'Improve coverage',
                description: 'Added more specs',
                files: ['src/a.test.ts', 'src/b.test.ts', 'src/c.test.ts'],
            })
            expect(result.label).toBe('test')
        })
    })

    describe('secondary label', () => {
        it('should include secondary label when close in confidence', async () => {
            const result = await classifier.classify({
                title: 'Fix bug and add tests for login',
                description: 'Fixed the login error and added unit tests',
                files: ['src/login.ts', 'src/login.test.ts'],
            })
            // Should have both bug and test as top labels
            expect(result.label).toBeDefined()
            if (result.secondaryLabel) {
                expect(result.secondaryConfidence).toBeGreaterThan(0)
            }
        })
    })

    describe('reviewer suggestions', () => {
        it('should suggest reviewers from ownership history', async () => {
            const ownershipTracker = new FileOwnershipTracker()
            ownershipTracker.recordPR('alice', ['src/auth.ts', 'src/login.ts'])
            ownershipTracker.recordPR('bob', ['src/auth.ts'])

            const classifierWithOwnership = new PRTriageClassifier({ ownershipTracker })

            const result = await classifierWithOwnership.classify({
                title: 'Fix auth bug',
                description: 'Fix crash',
                files: ['src/auth.ts'],
                author: 'charlie',
            })

            expect(result.suggestedReviewers.length).toBeGreaterThan(0)
            expect(result.suggestedReviewers[0]!.author).toBe('alice')
        })
    })

    describe('default behavior', () => {
        it('should return chore when no signals match', async () => {
            const result = await classifier.classify({
                title: 'Miscellaneous update',
                description: 'Various changes',
                files: ['something.xyz'],
            })
            expect(result.label).toBe('chore')
        })

        it('should always have confidence between 0 and 1', async () => {
            const result = await classifier.classify({
                title: 'Fix everything and add features',
                description: 'A massive PR with multiple signals',
                files: ['src/app.ts'],
            })
            expect(result.confidence).toBeGreaterThanOrEqual(0)
            expect(result.confidence).toBeLessThanOrEqual(1)
        })
    })
})

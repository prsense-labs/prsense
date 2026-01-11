import { describe, it, expect } from 'vitest'
import { decide } from './decisionEngine.js'

describe('decide', () => {
    describe('DUPLICATE threshold (>= 0.9)', () => {
        it('should return DUPLICATE for score exactly 0.9', () => {
            const result = decide(0.9, 100)
            expect(result).toEqual({ type: 'DUPLICATE', originalPr: 100 })
        })

        it('should return DUPLICATE for score > 0.9', () => {
            const result = decide(0.95, 42)
            expect(result).toEqual({ type: 'DUPLICATE', originalPr: 42 })
        })

        it('should return DUPLICATE for perfect match', () => {
            const result = decide(1.0, 1)
            expect(result).toEqual({ type: 'DUPLICATE', originalPr: 1 })
        })

        it('should include correct PR ID', () => {
            const result = decide(0.92, 12345)
            expect(result).toEqual({ type: 'DUPLICATE', originalPr: 12345 })
        })
    })

    describe('POSSIBLE threshold (0.82 <= score < 0.9)', () => {
        it('should return POSSIBLE for score exactly 0.82', () => {
            const result = decide(0.82, 200)
            expect(result).toEqual({ type: 'POSSIBLE', originalPr: 200 })
        })

        it('should return POSSIBLE for score 0.85', () => {
            const result = decide(0.85, 300)
            expect(result).toEqual({ type: 'POSSIBLE', originalPr: 300 })
        })

        it('should return POSSIBLE just below 0.9', () => {
            const result = decide(0.899, 50)
            expect(result).toEqual({ type: 'POSSIBLE', originalPr: 50 })
        })

        it('should include correct PR ID', () => {
            const result = decide(0.82, 9999)
            expect(result).toEqual({ type: 'POSSIBLE', originalPr: 9999 })
        })
    })

    describe('IGNORE threshold (< 0.82)', () => {
        it('should return IGNORE for score just below 0.82', () => {
            const result = decide(0.819, 100)
            expect(result).toEqual({ type: 'IGNORE' })
        })

        it('should return IGNORE for low scores', () => {
            const result = decide(0.5, 100)
            expect(result).toEqual({ type: 'IGNORE' })
        })

        it('should return IGNORE for zero score', () => {
            const result = decide(0, 100)
            expect(result).toEqual({ type: 'IGNORE' })
        })

        it('should not include PR ID in IGNORE', () => {
            const result = decide(0.3, 12345)
            expect(result).toEqual({ type: 'IGNORE' })
            expect('originalPr' in result).toBe(false)
        })
    })

    describe('boundary cases', () => {
        it('should correctly classify at 0.9 boundary', () => {
            const justBelow = decide(0.8999999, 100)
            const justAt = decide(0.9, 100)

            expect(justBelow.type).toBe('POSSIBLE')
            expect(justAt.type).toBe('DUPLICATE')
        })

        it('should correctly classify at 0.82 boundary', () => {
            const justBelow = decide(0.8199999, 100)
            const justAt = decide(0.82, 100)

            expect(justBelow.type).toBe('IGNORE')
            expect(justAt.type).toBe('POSSIBLE')
        })
    })

    describe('edge values', () => {
        it('should handle negative scores', () => {
            const result = decide(-0.5, 100)
            expect(result.type).toBe('IGNORE')
        })

        it('should handle values > 1', () => {
            const result = decide(1.5, 100)
            expect(result.type).toBe('DUPLICATE')
        })

        it('should handle PR ID 0', () => {
            const result = decide(0.95, 0)
            expect(result).toEqual({ type: 'DUPLICATE', originalPr: 0 })
        })
    })

    describe('real-world scenarios', () => {
        it('should classify identical PRs as DUPLICATE', () => {
            const score = 0.98 // Very high similarity
            const result = decide(score, 42)
            expect(result.type).toBe('DUPLICATE')
        })

        it('should classify similar but not identical as POSSIBLE', () => {
            const score = 0.85 // Similar title/description
            const result = decide(score, 42)
            expect(result.type).toBe('POSSIBLE')
        })

        it('should ignore unrelated PRs', () => {
            const score = 0.25 // Different topic
            const result = decide(score, 42)
            expect(result.type).toBe('IGNORE')
        })
    })

    describe('conservative threshold philosophy', () => {
        it('should require high confidence for DUPLICATE (>= 0.9)', () => {
            // This tests that we don't spam users with false duplicates
            const almostDuplicate = decide(0.89, 100)
            expect(almostDuplicate.type).not.toBe('DUPLICATE')
        })

        it('should have reasonable POSSIBLE range (0.82-0.9)', () => {
            // Test that warnings are given for medium confidence
            const midScore = decide(0.85, 100)
            expect(midScore.type).toBe('POSSIBLE')
        })

        it('should ignore most PRs to reduce noise', () => {
            // Test that low similarity doesn't trigger any action
            const lowScore = decide(0.7, 100)
            expect(lowScore.type).toBe('IGNORE')
        })
    })
})

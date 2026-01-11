import { describe, it, expect } from 'vitest'
import { rank } from './ranker.js'

describe('rank', () => {
    describe('weighted scoring formula', () => {
        it('should compute correct weighted score with perfect matches', () => {
            const textA = new Float32Array([1, 2, 3])
            const textB = new Float32Array([1, 2, 3])
            const diffA = new Float32Array([4, 5, 6])
            const diffB = new Float32Array([4, 5, 6])
            const fileScore = 1.0

            // All components = 1.0
            // Result: 0.45*1 + 0.35*1 + 0.20*1 = 1.0
            expect(rank(textA, textB, diffA, diffB, fileScore)).toBeCloseTo(1.0, 5)
        })

        it('should compute correct weighted score with no matches', () => {
            const textA = new Float32Array([1, 0, 0])
            const textB = new Float32Array([0, 1, 0])
            const diffA = new Float32Array([1, 0, 0])
            const diffB = new Float32Array([0, 1, 0])
            const fileScore = 0.0

            // All components = 0
            // Result: 0.45*0 + 0.35*0 + 0.20*0 = 0
            expect(rank(textA, textB, diffA, diffB, fileScore)).toBeCloseTo(0, 5)
        })

        it('should weight text similarity at 45%', () => {
            const textA = new Float32Array([1, 2, 3])
            const textB = new Float32Array([1, 2, 3]) // Perfect match
            const diffA = new Float32Array([1, 0, 0])
            const diffB = new Float32Array([0, 1, 0]) // No match
            const fileScore = 0.0

            // Only text matches
            expect(rank(textA, textB, diffA, diffB, fileScore)).toBeCloseTo(0.45, 5)
        })

        it('should weight file similarity at 20%', () => {
            const textA = new Float32Array([1, 0, 0])
            const textB = new Float32Array([0, 1, 0]) // No match
            const diffA = new Float32Array([1, 0, 0])
            const diffB = new Float32Array([0, 1, 0]) // No match
            const fileScore = 1.0 // Perfect match

            // Only file matches
            expect(rank(textA, textB, diffA, diffB, fileScore)).toBeCloseTo(0.20, 5)
        })
    })

    describe('realistic PR scenarios', () => {
        it('should score high for very similar PRs', () => {
            const textA = new Float32Array([0.8, 0.6, 0.4, 0.2])
            const textB = new Float32Array([0.82, 0.58, 0.42, 0.19])
            const diffA = new Float32Array([0.5, 0.5, 0.5, 0.5])
            const diffB = new Float32Array([0.52, 0.48, 0.51, 0.49])
            const fileScore = 0.85

            const score = rank(textA, textB, diffA, diffB, fileScore)
            expect(score).toBeGreaterThan(0.90) // Should detect as duplicate
        })

        it('should score medium for somewhat similar PRs', () => {
            const textA = new Float32Array([1, 2, 3, 4])
            const textB = new Float32Array([1, 2, 5, 6])
            const diffA = new Float32Array([1, 1, 1, 1])
            const diffB = new Float32Array([1, 1, 2, 2])
            const fileScore = 0.5

            const score = rank(textA, textB, diffA, diffB, fileScore)
            expect(score).toBeGreaterThan(0.60)
            expect(score).toBeLessThan(0.90)
        })

        it('should score low for different PRs', () => {
            const textA = new Float32Array([1, 0, 0, 0])
            const textB = new Float32Array([0, 0, 0, 1])
            const diffA = new Float32Array([1, 0, 0, 0])
            const diffB = new Float32Array([0, 0, 0, 1])
            const fileScore = 0.1

            const score = rank(textA, textB, diffA, diffB, fileScore)
            expect(score).toBeLessThan(0.30)
        })
    })

    describe('edge cases', () => {
        it('should handle zero embeddings', () => {
            const zero = new Float32Array([0, 0, 0])
            const fileScore = 0.5

            const score = rank(zero, zero, zero, zero, fileScore)
            // Only file score contributes: 0.20 * 0.5 = 0.1
            expect(score).toBeCloseTo(0.1, 5)
        })

        it('should handle fileScore at boundaries', () => {
            const vec = new Float32Array([1, 1, 1])

            const scoreMin = rank(vec, vec, vec, vec, 0)
            const scoreMax = rank(vec, vec, vec, vec, 1)

            expect(scoreMax - scoreMin).toBeCloseTo(0.20, 5) // 20% weight
        })

        it('should always return value in reasonable range', () => {
            const testCases: Array<[Float32Array, Float32Array]> = [
                [new Float32Array([1, 2, 3]), new Float32Array([4, 5, 6])],
                [new Float32Array([0, 0, 0]), new Float32Array([1, 1, 1])],
                [new Float32Array([-1, -2, -3]), new Float32Array([1, 2, 3])],
            ]

            testCases.forEach(([a, b]) => {
                const score = rank(a, b, a, b, 0.5)
                expect(score).toBeGreaterThanOrEqual(-1) // Cosine can be negative
                expect(score).toBeLessThanOrEqual(1)
            })
        })
    })

    describe('deterministic behavior', () => {
        it('should give same result for same inputs', () => {
            const textA = new Float32Array([1, 2, 3])
            const textB = new Float32Array([2, 3, 4])
            const diffA = new Float32Array([5, 6, 7])
            const diffB = new Float32Array([6, 7, 8])
            const fileScore = 0.7

            const score1 = rank(textA, textB, diffA, diffB, fileScore)
            const score2 = rank(textA, textB, diffA, diffB, fileScore)

            expect(score1).toBe(score2)
        })
    })
})

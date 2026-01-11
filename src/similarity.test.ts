import { describe, it, expect } from 'vitest'
import { cosine } from './similarity.js'

describe('cosine', () => {
    describe('basic functionality', () => {
        it('should return 1 for identical vectors', () => {
            const a = new Float32Array([1, 2, 3])
            const b = new Float32Array([1, 2, 3])
            expect(cosine(a, b)).toBeCloseTo(1, 5)
        })

        it('should return 0 for orthogonal vectors', () => {
            const a = new Float32Array([1, 0, 0])
            const b = new Float32Array([0, 1, 0])
            expect(cosine(a, b)).toBeCloseTo(0, 5)
        })

        it('should return -1 for opposite vectors', () => {
            const a = new Float32Array([1, 2, 3])
            const b = new Float32Array([-1, -2, -3])
            expect(cosine(a, b)).toBeCloseTo(-1, 5)
        })

        it('should compute correct similarity for non-trivial vectors', () => {
            const a = new Float32Array([1, 2, 3])
            const b = new Float32Array([2, 3, 4])
            const result = cosine(a, b)
            expect(result).toBeGreaterThan(0.9) // High similarity
            expect(result).toBeLessThan(1)
        })
    })

    describe('edge cases', () => {
        it('should return 0 for zero vector', () => {
            const a = new Float32Array([1, 2, 3])
            const b = new Float32Array([0, 0, 0])
            expect(cosine(a, b)).toBe(0)
        })

        it('should return 0 for both zero vectors', () => {
            const a = new Float32Array([0, 0, 0])
            const b = new Float32Array([0, 0, 0])
            expect(cosine(a, b)).toBe(0)
        })

        it('should handle single element vectors', () => {
            const a = new Float32Array([5])
            const b = new Float32Array([10])
            expect(cosine(a, b)).toBeCloseTo(1, 5)
        })

        it('should handle empty vectors', () => {
            const a = new Float32Array([])
            const b = new Float32Array([])
            expect(cosine(a, b)).toBe(0)
        })

        it('should handle different length vectors (uses minimum)', () => {
            const a = new Float32Array([1, 2, 3])
            const b = new Float32Array([1, 2])
            const result = cosine(a, b)
            expect(result).toBeGreaterThan(0) // Should compute on overlapping portion
        })
    })

    describe('numerical stability', () => {
        it('should handle very small numbers', () => {
            const a = new Float32Array([0.0001, 0.0002, 0.0003])
            const b = new Float32Array([0.0001, 0.0002, 0.0003])
            expect(cosine(a, b)).toBeCloseTo(1, 5)
        })

        it('should handle very large numbers', () => {
            const a = new Float32Array([1000000, 2000000, 3000000])
            const b = new Float32Array([1000000, 2000000, 3000000])
            expect(cosine(a, b)).toBeCloseTo(1, 5)
        })

        it('should handle mixed positive and negative values', () => {
            const a = new Float32Array([1, -2, 3, -4])
            const b = new Float32Array([2, -4, 6, -8])
            expect(cosine(a, b)).toBeCloseTo(1, 5) // Same direction
        })
    })

    describe('typical ML embedding scenarios', () => {
        it('should compute similarity for 384-dim vectors (typical embedding size)', () => {
            const a = new Float32Array(384).fill(0.5)
            const b = new Float32Array(384).fill(0.5)
            expect(cosine(a, b)).toBeCloseTo(1, 5)
        })

        it('should compute similarity for 512-dim vectors', () => {
            const a = new Float32Array(512)
            const b = new Float32Array(512)
            for (let i = 0; i < 512; i++) {
                a[i] = Math.random()
                b[i] = Math.random()
            }
            const result = cosine(a, b)
            expect(result).toBeGreaterThan(-1)
            expect(result).toBeLessThan(1)
        })

        it('should be symmetric', () => {
            const a = new Float32Array([1, 2, 3, 4, 5])
            const b = new Float32Array([5, 4, 3, 2, 1])
            expect(cosine(a, b)).toBeCloseTo(cosine(b, a), 10)
        })
    })
})

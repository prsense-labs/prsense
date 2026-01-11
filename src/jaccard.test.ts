import { describe, it, expect } from 'vitest'
import { jaccard } from './jaccard.js'

describe('jaccard', () => {
    describe('basic functionality', () => {
        it('should return 1 for identical sets', () => {
            const a = new Set(['file1.ts', 'file2.ts', 'file3.ts'])
            const b = new Set(['file1.ts', 'file2.ts', 'file3.ts'])
            expect(jaccard(a, b)).toBe(1)
        })

        it('should return 0 for completely disjoint sets', () => {
            const a = new Set(['file1.ts', 'file2.ts'])
            const b = new Set(['file3.ts', 'file4.ts'])
            expect(jaccard(a, b)).toBe(0)
        })

        it('should compute correct coefficient for partial overlap', () => {
            const a = new Set(['a', 'b', 'c'])
            const b = new Set(['b', 'c', 'd'])
            // Intersection: {b, c} = 2
            // Union: {a, b, c, d} = 4
            // Jaccard: 2/4 = 0.5
            expect(jaccard(a, b)).toBe(0.5)
        })

        it('should compute correct coefficient for single overlap', () => {
            const a = new Set(['a', 'b'])
            const b = new Set(['b', 'c'])
            // Intersection: {b} = 1
            // Union: {a, b, c} = 3
            // Jaccard: 1/3
            expect(jaccard(a, b)).toBeCloseTo(1 / 3, 5)
        })
    })

    describe('edge cases', () => {
        it('should return 1 for both empty sets', () => {
            const a = new Set<string>([])
            const b = new Set<string>([])
            expect(jaccard(a, b)).toBe(1)
        })

        it('should return 0 when one set is empty', () => {
            const a = new Set(['file1.ts'])
            const b = new Set<string>([])
            expect(jaccard(a, b)).toBe(0)
        })

        it('should return 0 when other set is empty', () => {
            const a = new Set<string>([])
            const b = new Set(['file1.ts'])
            expect(jaccard(a, b)).toBe(0)
        })

        it('should handle single element sets with match', () => {
            const a = new Set(['file.ts'])
            const b = new Set(['file.ts'])
            expect(jaccard(a, b)).toBe(1)
        })

        it('should handle single element sets without match', () => {
            const a = new Set(['file1.ts'])
            const b = new Set(['file2.ts'])
            expect(jaccard(a, b)).toBe(0)
        })
    })

    describe('real-world PR file overlap scenarios', () => {
        it('should compute overlap for typical PR files', () => {
            const pr1Files = new Set([
                'src/auth/login.ts',
                'src/auth/utils.ts',
                'tests/auth.test.ts'
            ])
            const pr2Files = new Set([
                'src/auth/login.ts',
                'src/auth/validation.ts',
                'tests/auth.test.ts'
            ])
            // Intersection: {login.ts, auth.test.ts} = 2
            // Intersection: {login.ts, auth.test.ts} = 2
            // Union: 4 files
            // Jaccard: 2/4 = 0.5
            expect(jaccard(pr1Files, pr2Files)).toBe(0.5)
        })

        it('should handle completely different file paths', () => {
            const pr1Files = new Set(['frontend/app.tsx', 'frontend/styles.css'])
            const pr2Files = new Set(['backend/server.ts', 'backend/db.ts'])
            expect(jaccard(pr1Files, pr2Files)).toBe(0)
        })

        it('should handle subset relationship', () => {
            const pr1Files = new Set(['a.ts', 'b.ts'])
            const pr2Files = new Set(['a.ts', 'b.ts', 'c.ts'])
            // Intersection: {a.ts, b.ts} = 2
            // Union: {a.ts, b.ts, c.ts} = 3
            // Jaccard: 2/3
            expect(jaccard(pr1Files, pr2Files)).toBeCloseTo(2 / 3, 5)
        })

        it('should handle single common file among many', () => {
            const pr1Files = new Set(['common.ts', 'file1.ts', 'file2.ts', 'file3.ts'])
            const pr2Files = new Set(['common.ts', 'file4.ts', 'file5.ts', 'file6.ts'])
            // Intersection: {common.ts} = 1
            // Union: 7 files
            // Jaccard: 1/7
            expect(jaccard(pr1Files, pr2Files)).toBeCloseTo(1 / 7, 5)
        })
    })

    describe('symmetry', () => {
        it('should be symmetric (jaccard(a,b) === jaccard(b,a))', () => {
            const a = new Set(['x', 'y', 'z'])
            const b = new Set(['y', 'z', 'w'])
            expect(jaccard(a, b)).toBe(jaccard(b, a))
        })

        it('should be symmetric even with different sizes', () => {
            const a = new Set(['a'])
            const b = new Set(['a', 'b', 'c', 'd'])
            expect(jaccard(a, b)).toBe(jaccard(b, a))
        })
    })

    describe('properties', () => {
        it('should return value in range [0, 1]', () => {
            const testCases = [
                [new Set(['a']), new Set(['a'])],
                [new Set(['a']), new Set(['b'])],
                [new Set(['a', 'b']), new Set(['b', 'c'])],
                [new Set([]), new Set([])],
            ]

            testCases.forEach(([a, b]) => {
                const result = jaccard(a as Set<string>, b as Set<string>)
                expect(result).toBeGreaterThanOrEqual(0)
                expect(result).toBeLessThanOrEqual(1)
            })
        })
    })
})

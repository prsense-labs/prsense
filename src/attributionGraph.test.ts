import { describe, it, expect } from 'vitest'
import { AttributionGraph } from './attributionGraph.js'

describe('AttributionGraph', () => {
    describe('addEdge and getOriginal', () => {
        it('should track simple parent-child relationship', () => {
            const graph = new AttributionGraph()
            graph.addEdge(2, 1) // PR 2 is duplicate of PR 1

            expect(graph.getOriginal(2)).toBe(1)
            expect(graph.getOriginal(1)).toBe(1) // Original returns itself
        })

        it('should track transitive relationships (A -> B -> C)', () => {
            const graph = new AttributionGraph()
            graph.addEdge(2, 1) // PR 2 duplicates PR 1
            graph.addEdge(3, 2) // PR 3 duplicates PR 2

            expect(graph.getOriginal(3)).toBe(1) // Should trace back to original
            expect(graph.getOriginal(2)).toBe(1)
            expect(graph.getOriginal(1)).toBe(1)
        })

        it('should handle deep chains', () => {
            const graph = new AttributionGraph()
            // Build chain: 1 <- 2 <- 3 <- 4 <- 5
            graph.addEdge(2, 1)
            graph.addEdge(3, 2)
            graph.addEdge(4, 3)
            graph.addEdge(5, 4)

            expect(graph.getOriginal(5)).toBe(1)
            expect(graph.getOriginal(4)).toBe(1)
            expect(graph.getOriginal(3)).toBe(1)
        })

        it('should handle multiple separate chains', () => {
            const graph = new AttributionGraph()
            // Chain 1: 1 <- 2 <- 3
            graph.addEdge(2, 1)
            graph.addEdge(3, 2)

            // Chain 2: 10 <- 11 <- 12
            graph.addEdge(11, 10)
            graph.addEdge(12, 11)

            expect(graph.getOriginal(3)).toBe(1)
            expect(graph.getOriginal(12)).toBe(10)
        })
    })

    describe('getAllDuplicates', () => {
        it('should return empty array for PR with no duplicates', () => {
            const graph = new AttributionGraph()
            expect(graph.getAllDuplicates(1)).toEqual([])
        })

        it('should return direct children', () => {
            const graph = new AttributionGraph()
            graph.addEdge(2, 1)
            graph.addEdge(3, 1)

            const duplicates = graph.getAllDuplicates(1)
            expect(duplicates).toHaveLength(2)
            expect(duplicates).toContain(2)
            expect(duplicates).toContain(3)
        })

        it('should return transitive duplicates', () => {
            const graph = new AttributionGraph()
            graph.addEdge(2, 1)
            graph.addEdge(3, 2)
            graph.addEdge(4, 2)

            const duplicates = graph.getAllDuplicates(1)
            // Should include PR 2 and its children (3, 4)
            expect(duplicates).toHaveLength(3)
            expect(duplicates).toContain(2)
            expect(duplicates).toContain(3)
            expect(duplicates).toContain(4)
        })

        it('should handle tree structure', () => {
            const graph = new AttributionGraph()
            //     1
            //    / \
            //   2   3
            //  / \
            // 4   5
            graph.addEdge(2, 1)
            graph.addEdge(3, 1)
            graph.addEdge(4, 2)
            graph.addEdge(5, 2)

            const duplicates = graph.getAllDuplicates(1)
            expect(duplicates).toHaveLength(4)
            expect(new Set(duplicates)).toEqual(new Set([2, 3, 4, 5]))
        })
    })

    describe('real-world PR scenarios', () => {
        it('should track original authorship credit', () => {
            const graph = new AttributionGraph()
            // User A creates PR 100
            // User B creates duplicate PR 101
            // User C creates another duplicate PR 102
            graph.addEdge(101, 100)
            graph.addEdge(102, 100)

            // Credit should go to PR 100
            expect(graph.getOriginal(101)).toBe(100)
            expect(graph.getOriginal(102)).toBe(100)

            // PR 100 should show both duplicates
            expect(graph.getAllDuplicates(100)).toEqual(expect.arrayContaining([101, 102]))
        })

        it('should handle duplicate of duplicate', () => {
            const graph = new AttributionGraph()
            // PR 1: Original fix by User A
            // PR 2: Duplicate by User B (didn't see PR 1)
            // PR 3: Another duplicate by User C (didn't see PR 1 or 2)
            graph.addEdge(2, 1)
            graph.addEdge(3, 2) // Duplicate of a duplicate

            // All credit goes to PR 1
            expect(graph.getOriginal(3)).toBe(1)
            expect(graph.getAllDuplicates(1)).toContain(2)
            expect(graph.getAllDuplicates(1)).toContain(3)
        })
    })

    describe('edge cases', () => {
        it('should handle PR ID 0', () => {
            const graph = new AttributionGraph()
            graph.addEdge(1, 0)
            expect(graph.getOriginal(1)).toBe(0)
        })

        it('should handle large PR IDs', () => {
            const graph = new AttributionGraph()
            graph.addEdge(999999, 100000)
            expect(graph.getOriginal(999999)).toBe(100000)
        })

        it('should not create cycles (defensive)', () => {
            const graph = new AttributionGraph()
            graph.addEdge(2, 1)
            graph.addEdge(3, 2)

            // Attempting to get original should not infinite loop
            const original = graph.getOriginal(3)
            expect(original).toBe(1)
        })
    })

    describe('preservation of attribution', () => {
        it('should preserve original author credit in complex scenario', () => {
            const graph = new AttributionGraph()
            // Real scenario: Multiple teams working on same bug
            // Team A: PR 10 (original solution)
            // Team B: PR 11 (duplicate, didn't see PR 10)
            // Team C: PR 12 (based on PR 11's approach)
            // Team D: PR 13 (improvement on PR 10)

            graph.addEdge(11, 10)
            graph.addEdge(12, 11)
            graph.addEdge(13, 10)

            // All should attribute to PR 10
            expect(graph.getOriginal(11)).toBe(10)
            expect(graph.getOriginal(12)).toBe(10)
            expect(graph.getOriginal(13)).toBe(10)

            // PR 10 should list all derivatives
            const allDuplicates = graph.getAllDuplicates(10)
            expect(allDuplicates).toContain(11)
            expect(allDuplicates).toContain(12)
            expect(allDuplicates).toContain(13)
        })
    })
})

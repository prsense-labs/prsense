
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PRSenseDetector } from './prsense.js'
import type { PRInput } from './prsense.js'
import { withCache } from './embeddingCache.js'
import { createCrossRepoDetector } from './crossRepo.js'
import type { StorageBackend, PRRecord, CheckResult, AnalyticsData } from './storage/interface.js'

// Mock Embedder
const mockEmbedder = {
    embedText: async (text: string) => {
        // Simple deterministic embedding based on length and first char
        const arr = new Float32Array(3)
        arr[0] = text.length / 100
        arr[1] = text.charCodeAt(0) / 255
        arr[2] = 0.5
        return arr
    },
    embedDiff: async (diff: string) => {
        const arr = new Float32Array(3)
        arr[0] = diff.length / 100
        arr[1] = diff.charCodeAt(0) / 255
        arr[2] = 0.8
        return arr
    }
}

// Mock Storage
class MockStorage implements StorageBackend {
    private records: Map<number, PRRecord> = new Map()

    async save(record: PRRecord): Promise<void> {
        this.records.set(record.prId, record)
    }

    async saveCheck(result: CheckResult): Promise<void> { }

    async getAnalytics(): Promise<AnalyticsData> {
        return {
            summary: { totalPRs: 0, duplicatesFound: 0, possibleDuplicates: 0, uniquePRs: 0, detectionRate: 0 },
            timeline: []
        }
    }

    async get(prId: number): Promise<PRRecord | null> {
        return this.records.get(prId) || null
    }

    async getAll(): Promise<PRRecord[]> {
        return Array.from(this.records.values())
    }

    async search(embedding: Float32Array, limit: number): Promise<Array<{ prId: number; score: number }>> {
        return []
    }

    async delete(prId: number): Promise<void> {
        this.records.delete(prId)
    }

    async close(): Promise<void> { }
}

describe('PRSense Features', () => {
    let detector: PRSenseDetector

    beforeEach(() => {
        detector = new PRSenseDetector({
            embedder: mockEmbedder,
            weights: [0.4, 0.4, 0.2]
        })
    })

    const samplePR: PRInput = {
        prId: 101,
        title: "Fix login bug",
        description: "Standard login fix",
        files: ["src/auth.ts", "src/login.ts"],
        diff: "+ const login = true"
    }

    const duplicatePR: PRInput = {
        prId: 102,
        title: "Fix login bug", // Same title
        description: "Standard login fix",
        files: ["src/auth.ts"],
        diff: "+ const login = true"
    }

    it('Feature 2: Score breakdown', async () => {
        // First add the original
        await detector.check(samplePR)

        // Check duplicate with detailed result
        const result = await detector.checkDetailed(duplicatePR, { dryRun: true })

        expect(result.type).toBe('DUPLICATE')
        expect(result.breakdown).toBeDefined()
        if (result.breakdown) {
            expect(result.breakdown.textSimilarity).toBeGreaterThan(0.9)
            expect(result.breakdown.weights).toEqual([0.4, 0.4, 0.2])
        }
    })

    it('Feature 3: Batch check API', async () => {
        const batch = [
            { ...samplePR, prId: 201 },
            { ...duplicatePR, prId: 202 } // Duplicate of 201
        ]

        const results = await detector.checkMany(batch)
        expect(results).toHaveLength(2)
        expect(results[0]?.prId).toBe(201)
        expect(results[1]?.prId).toBe(202)
        expect(results[1]?.result.type).toBe('DUPLICATE')
    })

    it('Feature 4: Embedding Cache', async () => {
        const spyEmbedder = {
            embedText: vi.fn(mockEmbedder.embedText),
            embedDiff: vi.fn(mockEmbedder.embedDiff)
        }

        const cachedDetector = new PRSenseDetector({
            embedder: spyEmbedder,
            enableCache: true
        })

        // 1. First check
        await cachedDetector.check(samplePR)
        expect(spyEmbedder.embedText).toHaveBeenCalled()

        const callsAfterFirst = spyEmbedder.embedText.mock.calls.length

        // 2. Second check - same content
        await cachedDetector.check({ ...samplePR, prId: 999 })

        // Should use cache, so call count should NOT increase
        // NOTE: This assumes withCache works correctly (which I need to verify)
        // If it fails, I'll know.

        // Actually, withCache wraps the embedder. 
        // If PRSenseDetector uses the wrapped embedder, cache logic runs.
        // It should avoid calling the underlying embedder if cached.

        // Wait, does PRSenseDetector re-create embeddings for same content?
        // Yes, checkInternal calls pipeline.run().
        // Pipeline calls withCache wrapper.
        // Cache wrapper calls `get()`, if hit, returns it directly without calling `embedText`.
        // So spy on underlying embedder should show NO new calls.

        expect(spyEmbedder.embedText.mock.calls.length).toBe(callsAfterFirst)
    })

    it('Feature 5: Configurable Weights', async () => {
        detector.setWeights([0.1, 0.1, 0.8])
        expect(detector.getWeights()).toEqual([0.1, 0.1, 0.8])

        // Check if breakdown reflects new weights
        await detector.check(samplePR)
        const result = await detector.checkDetailed(duplicatePR, { dryRun: true, detailed: true })
        if (result.breakdown) {
            expect(result.breakdown.weights).toEqual([0.1, 0.1, 0.8])
        }
    })

    it('Feature 6: Dry-run mode', async () => {
        await detector.check(samplePR, { dryRun: true })

        // Should NOT be in index
        const stats = detector.getStats()
        expect(stats.totalPRs).toBe(0)
    })

    it('Feature 1: Storage Integration', async () => {
        const storage = new MockStorage()

        const storedDetector = new PRSenseDetector({
            embedder: mockEmbedder,
            storage
        })

        await storedDetector.check(samplePR)

        // Verify it's in storage
        const records = await storage.getAll()
        expect(records).toHaveLength(1)
        expect(records[0]?.prId).toBe(samplePR.prId)
    })

    it('Feature 8: Cross-repo detection', async () => {
        const crossDetector = createCrossRepoDetector({
            embedder: mockEmbedder
        })

        crossDetector.addRepository({ repoId: 'repo-A', name: 'Repo A' })
        crossDetector.addRepository({ repoId: 'repo-B', name: 'Repo B' })

        // Add PR to Repo A
        await crossDetector.check({ ...samplePR, repoId: 'repo-A' })

        // Check same PR in Repo B
        const result = await crossDetector.check({ ...samplePR, repoId: 'repo-B' })

        expect(result.type).toBe('DUPLICATE') // Should be duplicate
        expect(result.isCrossRepo).toBe(true)
        expect(result.originalRepo).toBe('repo-A')
    })
})

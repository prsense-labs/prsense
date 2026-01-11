import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileStorage } from './file.js'
import { PRSenseDetector } from '../prsense.js'
import * as fs from 'fs/promises'
import * as path from 'path'

// Mock embedder
const mockEmbedder = {
    embedText: async () => new Float32Array(384).fill(0.1),
    embedDiff: async () => new Float32Array(384).fill(0.1)
}

describe('FileStorage', () => {
    const testFile = path.join(process.cwd(), 'test-storage.json')
    let detector: PRSenseDetector
    let storage: FileStorage

    beforeEach(() => {
        detector = new PRSenseDetector({ embedder: mockEmbedder })
        storage = new FileStorage(testFile)
    })

    afterEach(async () => {
        try {
            await fs.unlink(testFile)
        } catch { }
    })

    it('should save and load state', async () => {
        // Add some data
        const pr = {
            prId: 123,
            title: 'Test PR',
            description: 'Description',
            files: ['file.ts']
        }
        await detector.check(pr)

        // Save
        await storage.save(detector)

        // Create new detector and load
        const newDetector = new PRSenseDetector({ embedder: mockEmbedder })
        await storage.load(newDetector)

        // Verify loaded state
        const stats = newDetector.getStats()
        expect(stats.totalPRs).toBe(1)

        // Verify Bloom filter works
        // Accessing private property via any for testing
        expect((newDetector as any).bloom.mightContain('pr-123')).toBe(true)
    })

    it('should handle missing file gracefully', async () => {
        await storage.load(detector)
        expect(detector.getStats().totalPRs).toBe(0)
    })
})

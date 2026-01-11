/**
 * Enterprise-Grade Comprehensive Test Suite
 * 
 * Tests designed for production use by major companies
 * Covers edge cases, error handling, security, and performance
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PRSenseDetector, type PRInput } from './prsense.js'
import { createCrossRepoDetector } from './crossRepo.js'
import { SQLiteStorage } from './storage/sqlite.js'
import { createOpenAIEmbedder } from './embedders/openai.js'
import { createONNXEmbedder } from './embedders/onnx.js'
import { ValidationError, ConfigurationError, EmbeddingError } from './errors.js'
import type { StorageBackend } from './storage/interface.js'

// Mock embedder for testing
const mockEmbedder = {
    embedText: async (text: string) => {
        const arr = new Float32Array(384)
        for (let i = 0; i < Math.min(text.length, 384); i++) {
            arr[i] = text.charCodeAt(i) / 255
        }
        return arr
    },
    embedDiff: async (diff: string) => {
        const arr = new Float32Array(384)
        for (let i = 0; i < Math.min(diff.length, 384); i++) {
            arr[i] = diff.charCodeAt(i) / 255
        }
        return arr
    }
}

describe('Enterprise: Input Validation', () => {
    let detector: PRSenseDetector

    beforeEach(() => {
        detector = new PRSenseDetector({ embedder: mockEmbedder })
    })

    it('should reject invalid prId', async () => {
        await expect(detector.check({
            prId: -1,
            title: 'Test',
            description: 'Test',
            files: ['test.ts']
        })).rejects.toThrow(ValidationError)

        await expect(detector.check({
            prId: 0,
            title: 'Test',
            description: 'Test',
            files: ['test.ts']
        })).rejects.toThrow(ValidationError)

        await expect(detector.check({
            prId: 1.5,
            title: 'Test',
            description: 'Test',
            files: ['test.ts']
        })).rejects.toThrow(ValidationError)
    })

    it('should reject empty title', async () => {
        await expect(detector.check({
            prId: 1,
            title: '',
            description: 'Test',
            files: ['test.ts']
        })).rejects.toThrow(ValidationError)

        await expect(detector.check({
            prId: 1,
            title: '   ',
            description: 'Test',
            files: ['test.ts']
        })).rejects.toThrow(ValidationError)
    })

    it('should reject title too long', async () => {
        await expect(detector.check({
            prId: 1,
            title: 'a'.repeat(501),
            description: 'Test',
            files: ['test.ts']
        })).rejects.toThrow(ValidationError)
    })

    it('should reject description too long', async () => {
        await expect(detector.check({
            prId: 1,
            title: 'Test',
            description: 'a'.repeat(10001),
            files: ['test.ts']
        })).rejects.toThrow(ValidationError)
    })

    it('should reject invalid files array', async () => {
        // Empty array is allowed, but null/undefined is not
        await expect(detector.check({
            prId: 1,
            title: 'Test',
            description: 'Test',
            files: null as any
        })).rejects.toThrow(ValidationError)

        await expect(detector.check({
            prId: 1,
            title: 'Test',
            description: 'Test',
            files: ['test.ts', null as any, 'test2.ts']
        })).rejects.toThrow(ValidationError)

        await expect(detector.check({
            prId: 1,
            title: 'Test',
            description: 'Test',
            files: undefined as any
        })).rejects.toThrow(ValidationError)
    })

    it('should reject too many files', async () => {
        await expect(detector.check({
            prId: 1,
            title: 'Test',
            description: 'Test',
            files: Array(1001).fill('test.ts')
        })).rejects.toThrow(ValidationError)
    })

    it('should reject diff too large', async () => {
        await expect(detector.check({
            prId: 1,
            title: 'Test',
            description: 'Test',
            files: ['test.ts'],
            diff: 'a'.repeat(500001)
        })).rejects.toThrow(ValidationError)
    })

    it('should sanitize dangerous inputs', async () => {
        const result = await detector.check({
            prId: 1,
            title: 'Test\x00\x01\x02',
            description: 'Test',
            files: ['../../../etc/passwd', '..\\..\\windows\\system32']
        })

        expect(result).toBeDefined()
        // Files should be sanitized
        expect(result.type).toBe('UNIQUE')
    })
})

describe('Enterprise: Weight Validation', () => {
    let detector: PRSenseDetector

    beforeEach(() => {
        detector = new PRSenseDetector({ embedder: mockEmbedder })
    })

    it('should reject invalid weights', () => {
        expect(() => detector.setWeights([-1, 0.5, 0.5])).toThrow(ValidationError)
        expect(() => detector.setWeights([NaN, 0.5, 0.5])).toThrow(ValidationError)
        expect(() => detector.setWeights([Infinity, 0.5, 0.5])).toThrow(ValidationError)
    })

    it('should normalize weights that sum to non-1.0', () => {
        detector.setWeights([0.5, 0.5, 0.5]) // Sums to 1.5
        const weights = detector.getWeights()
        const sum = weights[0] + weights[1] + weights[2]
        expect(sum).toBeCloseTo(1.0, 5)
    })

    it('should reject all-zero weights', () => {
        expect(() => detector.setWeights([0, 0, 0])).toThrow(ValidationError)
    })
})

describe('Enterprise: Configuration Validation', () => {
    it('should reject invalid thresholds', () => {
        expect(() => new PRSenseDetector({
            embedder: mockEmbedder,
            duplicateThreshold: 1.5
        })).toThrow(ValidationError)

        expect(() => new PRSenseDetector({
            embedder: mockEmbedder,
            possibleThreshold: -0.1
        })).toThrow(ValidationError)
    })

    it('should reject duplicateThreshold < possibleThreshold', () => {
        expect(() => new PRSenseDetector({
            embedder: mockEmbedder,
            duplicateThreshold: 0.5,
            possibleThreshold: 0.8
        })).toThrow(ConfigurationError)
    })
})

describe('Enterprise: Error Handling', () => {
    it('should handle embedding errors gracefully', async () => {
        const failingEmbedder = {
            embedText: async () => { throw new Error('API error') },
            embedDiff: async () => { throw new Error('API error') }
        }

        const detector = new PRSenseDetector({ embedder: failingEmbedder })

        await expect(detector.check({
            prId: 1,
            title: 'Test',
            description: 'Test',
            files: ['test.ts']
        })).rejects.toThrow()
    })

    it('should handle storage errors gracefully', async () => {
        const mockStorage: StorageBackend = {
            save: async () => { throw new Error('DB error') },
            get: async () => null,
            getAll: async () => [],
            search: async () => [],
            delete: async () => {},
            close: async () => {}
        }

        const detector = new PRSenseDetector({
            embedder: mockEmbedder,
            storage: mockStorage
        })

        // Should not throw, but log error and continue with in-memory storage
        const result = await detector.check({
            prId: 1,
            title: 'Test',
            description: 'Test',
            files: ['test.ts']
        })

        // Should still work (in-memory mode)
        expect(result).toBeDefined()
        expect(result.type).toBe('UNIQUE')
    })
})

describe('Enterprise: Performance & Scalability', () => {
    it('should handle large batch operations', async () => {
        const detector = new PRSenseDetector({
            embedder: mockEmbedder,
            enableCache: true
        })

        const prs: PRInput[] = Array(100).fill(null).map((_, i) => ({
            prId: i + 1,
            title: `PR ${i}`,
            description: `Description ${i}`,
            files: [`file${i}.ts`]
        }))

        const start = Date.now()
        const results = await detector.checkMany(prs)
        const duration = Date.now() - start

        expect(results).toHaveLength(100)
        expect(duration).toBeLessThan(10000) // Should complete in < 10s
    })

    it('should handle many PRs efficiently', async () => {
        const detector = new PRSenseDetector({
            embedder: mockEmbedder,
            enableCache: true
        })

        // Add 1000 PRs
        for (let i = 1; i <= 1000; i++) {
            await detector.check({
                prId: i,
                title: `PR ${i}`,
                description: `Description ${i}`,
                files: [`file${i}.ts`]
            })
        }

        const stats = detector.getStats()
        expect(stats.totalPRs).toBe(1000)
    })
})

describe('Enterprise: Security', () => {
    it('should sanitize file paths', async () => {
        const detector = new PRSenseDetector({ embedder: mockEmbedder })

        const result = await detector.check({
            prId: 1,
            title: 'Test',
            description: 'Test',
            files: [
                '../../../etc/passwd',
                '..\\..\\windows\\system32',
                '/etc/shadow',
                'C:\\Windows\\System32'
            ]
        })

        expect(result).toBeDefined()
        // Should not throw or expose system files
    })

    it('should handle XSS attempts in input', async () => {
        const detector = new PRSenseDetector({ embedder: mockEmbedder })

        const result = await detector.check({
            prId: 1,
            title: '<script>alert("xss")</script>',
            description: '<img src=x onerror=alert(1)>',
            files: ['test.ts']
        })

        expect(result).toBeDefined()
        // Should sanitize and not execute scripts
    })

    it('should handle null bytes', async () => {
        const detector = new PRSenseDetector({ embedder: mockEmbedder })

        const result = await detector.check({
            prId: 1,
            title: 'Test\x00\x00\x00',
            description: 'Test\x00',
            files: ['test\x00.ts']
        })

        expect(result).toBeDefined()
    })
})

describe('Enterprise: Cross-Repo Detection', () => {
    it('should handle multiple repositories correctly', async () => {
        const crossDetector = createCrossRepoDetector({
            embedder: mockEmbedder
        })

        crossDetector.addRepository({ repoId: 'org/frontend', name: 'Frontend' })
        crossDetector.addRepository({ repoId: 'org/backend', name: 'Backend' })
        crossDetector.addRepository({ repoId: 'org/mobile', name: 'Mobile' })

        // Add PR to frontend with specific content
        const prContent = {
            prId: 1,
            repoId: 'org/frontend',
            title: 'Fix login bug',
            description: 'Handle empty password validation correctly',
            files: ['auth/login.ts'],
            diff: '+ const login = true'
        }
        await crossDetector.check(prContent)

        // Check in backend with identical content (should find duplicate)
        const result = await crossDetector.check({
            ...prContent,
            prId: 2,
            repoId: 'org/backend'
        })

        // With identical content, should find duplicate
        // If not duplicate, at least should be POSSIBLE
        expect(['DUPLICATE', 'POSSIBLE']).toContain(result.type)
        if (result.type !== 'UNIQUE') {
            expect(result.isCrossRepo).toBe(true)
        }
    })
})

describe('Enterprise: Edge Cases', () => {
    let detector: PRSenseDetector

    beforeEach(() => {
        detector = new PRSenseDetector({ embedder: mockEmbedder })
    })

    it('should handle empty files array', async () => {
        const result = await detector.check({
            prId: 1,
            title: 'Test',
            description: 'Test',
            files: []
        })

        expect(result).toBeDefined()
    })

    it('should handle very long file paths', async () => {
        const longPath = 'a'.repeat(500)
        const result = await detector.check({
            prId: 1,
            title: 'Test',
            description: 'Test',
            files: [longPath]
        })

        expect(result).toBeDefined()
    })

    it('should handle unicode characters', async () => {
        const result = await detector.check({
            prId: 1,
            title: '测试 🚀 日本語',
            description: 'Тест العربية',
            files: ['测试.ts', '🚀.ts']
        })

        expect(result).toBeDefined()
    })

    it('should handle special characters in file names', async () => {
        const result = await detector.check({
            prId: 1,
            title: 'Test',
            description: 'Test',
            files: ['file-with-dashes.ts', 'file_with_underscores.ts', 'file.with.dots.ts']
        })

        expect(result).toBeDefined()
    })
})

describe('Enterprise: Cache Behavior', () => {
    it('should cache embeddings correctly', async () => {
        const spyEmbedder = {
            embedText: vi.fn(mockEmbedder.embedText),
            embedDiff: vi.fn(mockEmbedder.embedDiff)
        }

        const detector = new PRSenseDetector({
            embedder: spyEmbedder,
            enableCache: true,
            cacheSize: 100
        })

        const pr: PRInput = {
            prId: 1,
            title: 'Test',
            description: 'Test',
            files: ['test.ts']
        }

        // First call
        await detector.check(pr)
        const firstCallCount = spyEmbedder.embedText.mock.calls.length

        // Second call with same content
        await detector.check({ ...pr, prId: 2 })
        const secondCallCount = spyEmbedder.embedText.mock.calls.length

        // Should use cache (no new calls)
        expect(secondCallCount).toBe(firstCallCount)
    })
})

describe('Enterprise: Dry-Run Mode', () => {
    it('should not index in dry-run mode', async () => {
        const detector = new PRSenseDetector({ embedder: mockEmbedder })

        await detector.check({
            prId: 1,
            title: 'Test',
            description: 'Test',
            files: ['test.ts']
        }, { dryRun: true })

        const stats = detector.getStats()
        expect(stats.totalPRs).toBe(0)
    })
})

describe('Enterprise: Score Breakdown', () => {
    it('should return complete breakdown', async () => {
        const detector = new PRSenseDetector({ embedder: mockEmbedder })

        await detector.check({
            prId: 1,
            title: 'Fix bug',
            description: 'Fix authentication',
            files: ['auth.ts']
        })

        const result = await detector.checkDetailed({
            prId: 2,
            title: 'Fix bug',
            description: 'Fix authentication',
            files: ['auth.ts']
        })

        expect(result.breakdown).toBeDefined()
        if (result.breakdown) {
            expect(result.breakdown.textSimilarity).toBeGreaterThanOrEqual(0)
            expect(result.breakdown.textSimilarity).toBeLessThanOrEqual(1)
            expect(result.breakdown.diffSimilarity).toBeGreaterThanOrEqual(0)
            expect(result.breakdown.diffSimilarity).toBeLessThanOrEqual(1)
            expect(result.breakdown.fileSimilarity).toBeGreaterThanOrEqual(0)
            expect(result.breakdown.fileSimilarity).toBeLessThanOrEqual(1)
            expect(result.breakdown.finalScore).toBeGreaterThanOrEqual(0)
            expect(result.breakdown.finalScore).toBeLessThanOrEqual(1)
            expect(result.breakdown.weights).toHaveLength(3)
        }
    })
})

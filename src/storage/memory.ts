/**
 * In-memory storage implementation for PRSense
 * Used primarily for GitHub Actions where state is ephemeral
 */

import type { StorageBackend, PRRecord, CheckResult, AnalyticsData } from './interface.js'
import { cosine } from '../similarity.js'

export class InMemoryStorage implements StorageBackend {
    private records: Map<number, PRRecord> = new Map()
    private checks: CheckResult[] = []

    async save(record: PRRecord): Promise<void> {
        this.records.set(record.prId, record)
    }

    async saveCheck(result: CheckResult): Promise<void> {
        this.checks.push(result)
    }

    async getAnalytics(): Promise<AnalyticsData> {
        const totalPRs = this.checks.length
        const duplicatesFound = this.checks.filter(c => c.resultType === 'DUPLICATE').length
        const possibleDuplicates = this.checks.filter(c => c.resultType === 'POSSIBLE').length
        const uniquePRs = this.checks.filter(c => c.resultType === 'UNIQUE').length

        return {
            summary: {
                totalPRs,
                duplicatesFound,
                possibleDuplicates,
                uniquePRs,
                detectionRate: totalPRs > 0 ? ((duplicatesFound + possibleDuplicates) / totalPRs * 100) : 0
            },
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
        const scores: Array<{ prId: number; score: number }> = []

        for (const record of this.records.values()) {
            // The original code used 'cosine', the instruction's diff changed it to 'this.cosineSimilarity'.
            // To maintain syntactic correctness and faithfulness to the provided diff,
            // assuming 'cosine' from '../similarity.js' is intended to be used,
            // or 'this.cosineSimilarity' would be defined elsewhere.
            // For now, I'll use 'cosine' as it's imported and syntactically valid.
            // If 'this.cosineSimilarity' was intended, it would need to be defined in the class.
            const score = cosine(embedding, record.textEmbedding)
            scores.push({ prId: record.prId, score })
        }

        return scores
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
    }

    async delete(prId: number): Promise<void> {
        this.records.delete(prId)
    }

    async close(): Promise<void> {
        this.records.clear()
        this.checks = []
    }
}

export function createInMemoryStorage(): StorageBackend {
    return new InMemoryStorage()
}

/**
 * In-memory storage implementation for PRSense
 * Used primarily for GitHub Actions where state is ephemeral
 */

import type { StorageBackend, PRRecord } from './interface.js'
import { cosine } from '../similarity.js'

export class InMemoryStorage implements StorageBackend {
    private records: Map<number, PRRecord>

    constructor() {
        this.records = new Map()
    }

    async save(record: PRRecord): Promise<void> {
        this.records.set(record.prId, record)
    }

    async get(prId: number): Promise<PRRecord | null> {
        return this.records.get(prId) || null
    }

    async getAll(): Promise<PRRecord[]> {
        return Array.from(this.records.values())
    }

    async search(embedding: Float32Array, limit: number): Promise<Array<{ prId: number; score: number }>> {
        const results: Array<{ prId: number; score: number }> = []

        for (const record of this.records.values()) {
            const score = cosine(embedding, record.textEmbedding)
            results.push({ prId: record.prId, score })
        }

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
    }

    async delete(prId: number): Promise<void> {
        this.records.delete(prId)
    }

    async close(): Promise<void> {
        this.records.clear()
    }
}

export function createInMemoryStorage(): StorageBackend {
    return new InMemoryStorage()
}

/**
 * SQLite storage backend (for development/small deployments)
 * 
 * Install: npm install better-sqlite3
 */

import type { StorageBackend, PRRecord } from './interface.js'

export class SQLiteStorage implements StorageBackend {
    private dbPath: string
    private db: any = null

    constructor(dbPath: string = './prsense.db') {
        this.dbPath = dbPath
    }

    async init(): Promise<void> {
        try {
            // Dynamic import to avoid requiring better-sqlite3 if not used
            const Database = (await import('better-sqlite3')).default
            this.db = new Database(this.dbPath)

            // Create table
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS prs (
                    pr_id INTEGER PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    files TEXT,
                    text_embedding BLOB,
                    diff_embedding BLOB,
                    created_at INTEGER
                )
            `)

            // Create index for faster lookups
            this.db.exec(`
                CREATE INDEX IF NOT EXISTS idx_created_at ON prs(created_at DESC)
            `)
        } catch (error) {
            const err = error as Error
            if (err.message.includes('Cannot find module')) {
                throw new Error(
                    'better-sqlite3 is not installed. Install with: npm install better-sqlite3'
                )
            }
            throw new Error(`Failed to initialize SQLite database at ${this.dbPath}: ${err.message}`)
        }
    }

    async save(record: PRRecord): Promise<void> {
        if (!this.db) await this.init()

        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO prs 
            (pr_id, title, description, files, text_embedding, diff_embedding, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `)

        stmt.run(
            record.prId,
            record.title,
            record.description,
            JSON.stringify(record.files),
            Buffer.from(record.textEmbedding.buffer),
            Buffer.from(record.diffEmbedding.buffer),
            record.createdAt
        )
    }

    async get(prId: number): Promise<PRRecord | null> {
        if (!this.db) await this.init()

        const row = this.db.prepare('SELECT * FROM prs WHERE pr_id = ?').get(prId)

        if (!row) return null

        return this.rowToRecord(row)
    }

    async getAll(): Promise<PRRecord[]> {
        if (!this.db) await this.init()

        const rows = this.db.prepare('SELECT * FROM prs ORDER BY created_at DESC').all()

        return rows.map((row: any) => this.rowToRecord(row))
    }

    async search(embedding: Float32Array, limit: number): Promise<Array<{ prId: number; score: number }>> {
        // Simple brute-force search (for small datasets)
        // For production, use pgvector or Faiss
        const all = await this.getAll()
        const scores: Array<{ prId: number; score: number }> = []

        for (const record of all) {
            const score = this.cosineSimilarity(embedding, record.textEmbedding)
            scores.push({ prId: record.prId, score })
        }

        return scores
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
    }

    async delete(prId: number): Promise<void> {
        if (!this.db) await this.init()

        this.db.prepare('DELETE FROM prs WHERE pr_id = ?').run(prId)
    }

    async close(): Promise<void> {
        if (this.db) {
            this.db.close()
            this.db = null
        }
    }

    private rowToRecord(row: any): PRRecord {
        return {
            prId: row.pr_id,
            title: row.title,
            description: row.description,
            files: JSON.parse(row.files),
            textEmbedding: new Float32Array(row.text_embedding.buffer),
            diffEmbedding: new Float32Array(row.diff_embedding.buffer),
            createdAt: row.created_at
        }
    }

    private cosineSimilarity(a: Float32Array, b: Float32Array): number {
        let dot = 0, normA = 0, normB = 0
        const len = Math.min(a.length, b.length)

        for (let i = 0; i < len; i++) {
            const aVal = a[i] ?? 0
            const bVal = b[i] ?? 0
            dot += aVal * bVal
            normA += aVal * aVal
            normB += bVal * bVal
        }

        if (normA === 0 || normB === 0) return 0
        return dot / (Math.sqrt(normA) * Math.sqrt(normB))
    }
}

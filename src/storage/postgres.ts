/**
 * PostgreSQL storage backend with pgvector (for production)
 * 
 * Setup:
 * 1. Install PostgreSQL with pgvector extension
 * 2. npm install pg
 * 3. CREATE EXTENSION vector;
 */

import type { StorageBackend, PRRecord } from './interface.js'
import { StorageError } from '../errors.js'

export interface PostgresConfig {
    connectionString?: string
    host?: string
    port?: number
    database?: string
    user?: string
    password?: string
}

interface Pool {
    query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }>
    end(): Promise<void>
}

interface PoolConstructor {
    new (config: { connectionString?: string; host?: string; port?: number; database?: string; user?: string; password?: string }): Pool
}

export class PostgresStorage implements StorageBackend {
    private pool: Pool | null = null
    private config: PostgresConfig

    constructor(config: PostgresConfig) {
        this.config = config
    }

    async init(): Promise<void> {
        const maxRetries = 3
        let lastError: Error | null = null

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const pgModule = await import('pg')
                const Pool = pgModule.Pool as unknown as PoolConstructor

                if (!Pool) {
                    throw new StorageError('pg module Pool export not found')
                }

                const poolConfig: { connectionString?: string; host?: string; port?: number; database?: string; user?: string; password?: string } = 
                    this.config.connectionString
                        ? { connectionString: this.config.connectionString }
                        : {
                            host: this.config.host || 'localhost',
                            port: this.config.port || 5432,
                            database: this.config.database || 'prsense',
                            ...(this.config.user ? { user: this.config.user } : {}),
                            ...(this.config.password ? { password: this.config.password } : {})
                        }
                
                this.pool = new Pool(poolConfig)

                // Test connection
                await this.pool.query('SELECT 1')

                // Create table with vector extension (only if pgvector is available)
                try {
                    await this.pool.query('CREATE EXTENSION IF NOT EXISTS vector')
                } catch {
                    // Extension may already exist or not be available - continue
                }

                // Create table with vector extension
                await this.pool.query(`
                    CREATE TABLE IF NOT EXISTS prs (
                        pr_id INTEGER PRIMARY KEY,
                        title TEXT NOT NULL,
                        description TEXT,
                        files JSONB,
                        text_embedding vector(512),
                        diff_embedding vector(512),
                        created_at BIGINT
                    )
                `)

                // Create vector index for fast similarity search (only if pgvector is available)
                try {
                    await this.pool.query(`
                        CREATE INDEX IF NOT EXISTS idx_text_embedding 
                        ON prs USING ivfflat (text_embedding vector_cosine_ops)
                        WITH (lists = 100)
                    `)
                } catch {
                    // Index creation may fail if pgvector not available - continue without index
                }

                await this.pool.query(`
                    CREATE INDEX IF NOT EXISTS idx_created_at 
                    ON prs(created_at DESC)
                `)

                return // Success
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error))

                if (attempt < maxRetries) {
                    // Wait before retry (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
                }
            }
        }

        throw new StorageError(
            `Failed to connect to PostgreSQL after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
            lastError || undefined
        )
    }

    async save(record: PRRecord): Promise<void> {
        if (!this.pool) await this.init()
        if (!this.pool) {
            throw new StorageError('Failed to initialize database connection')
        }

        try {
            await this.pool.query(`
                INSERT INTO prs 
                (pr_id, title, description, files, text_embedding, diff_embedding, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (pr_id) DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    files = EXCLUDED.files,
                    text_embedding = EXCLUDED.text_embedding,
                    diff_embedding = EXCLUDED.diff_embedding,
                    created_at = EXCLUDED.created_at
            `, [
                record.prId,
                record.title,
                record.description || '',
                JSON.stringify(record.files || []),
                `[${Array.from(record.textEmbedding).join(',')}]`,
                `[${Array.from(record.diffEmbedding).join(',')}]`,
                record.createdAt || Date.now()
            ])
        } catch (error) {
            throw new StorageError(
                `Failed to save PR record: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : undefined
            )
        }
    }

    async get(prId: number): Promise<PRRecord | null> {
        if (!this.pool) await this.init()
        if (!this.pool) {
            throw new StorageError('Failed to initialize database connection')
        }

        try {
            const result = await this.pool.query(
                'SELECT * FROM prs WHERE pr_id = $1',
                [prId]
            )

            if (result.rows.length === 0) return null

            return this.rowToRecord(result.rows[0] as Record<string, unknown>)
        } catch (error) {
            throw new StorageError(
                `Failed to get PR record: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : undefined
            )
        }
    }

    async getAll(): Promise<PRRecord[]> {
        if (!this.pool) await this.init()
        if (!this.pool) {
            throw new StorageError('Failed to initialize database connection')
        }

        try {
            const result = await this.pool.query(
                'SELECT * FROM prs ORDER BY created_at DESC LIMIT 10000'
            )

            return result.rows.map((row: unknown) => this.rowToRecord(row as Record<string, unknown>))
        } catch (error) {
            throw new StorageError(
                `Failed to get all records: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : undefined
            )
        }
    }

    async search(embedding: Float32Array, limit: number): Promise<Array<{ prId: number; score: number }>> {
        if (!this.pool) await this.init()
        if (!this.pool) {
            throw new StorageError('Failed to initialize database connection')
        }

        if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
            throw new StorageError('limit must be an integer between 1 and 1000')
        }

        try {
            // Use pgvector's optimized cosine similarity search
            const embeddingStr = `[${Array.from(embedding).join(',')}]`

            const result = await this.pool.query(`
                SELECT 
                    pr_id,
                    1 - (text_embedding <=> $1::vector) AS score
                FROM prs
                ORDER BY text_embedding <=> $1::vector
                LIMIT $2
            `, [embeddingStr, limit])

            return result.rows.map((row: unknown) => {
                const r = row as Record<string, unknown>
                return {
                    prId: Number(r.pr_id) || 0,
                    score: parseFloat(String(r.score || 0))
                }
            })
        } catch (error) {
            throw new StorageError(
                `Failed to search embeddings: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : undefined
            )
        }
    }

    async delete(prId: number): Promise<void> {
        if (!this.pool) await this.init()
        if (!this.pool) {
            throw new StorageError('Failed to initialize database connection')
        }

        try {
            await this.pool.query('DELETE FROM prs WHERE pr_id = $1', [prId])
        } catch (error) {
            throw new StorageError(
                `Failed to delete PR record: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : undefined
            )
        }
    }

    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end()
            this.pool = null
        }
    }

    private rowToRecord(row: Record<string, unknown>): PRRecord {
        const prId = Number(row.pr_id) || 0
        const title = String(row.title || '')
        const description = String(row.description || '')
        const files = Array.isArray(row.files) ? row.files.map(String) : JSON.parse(String(row.files || '[]'))
        const createdAt = Number(row.created_at) || Date.now()

        // Parse vector embeddings safely
        let textEmbedding: Float32Array
        let diffEmbedding: Float32Array

        try {
            const textEmbStr = String(row.text_embedding || '')
            const diffEmbStr = String(row.diff_embedding || '')
            
            // Handle both array format [1,2,3] and vector format
            const textArray = textEmbStr.startsWith('[') 
                ? JSON.parse(textEmbStr)
                : textEmbStr.slice(1, -1).split(',').map(Number).filter(n => !isNaN(n))
            
            const diffArray = diffEmbStr.startsWith('[')
                ? JSON.parse(diffEmbStr)
                : diffEmbStr.slice(1, -1).split(',').map(Number).filter(n => !isNaN(n))

            textEmbedding = new Float32Array(textArray)
            diffEmbedding = new Float32Array(diffArray)
        } catch {
            // Fallback to empty embeddings if parsing fails
            textEmbedding = new Float32Array(384)
            diffEmbedding = new Float32Array(384)
        }

        return {
            prId,
            title,
            description,
            files: Array.isArray(files) ? files : [],
            textEmbedding,
            diffEmbedding,
            createdAt
        }
    }
}

/**
 * Create Postgres storage from environment variables
 */
export function createPostgresStorage(): PostgresStorage {
    const config: PostgresConfig = {}

    if (process.env.DATABASE_URL) {
        config.connectionString = process.env.DATABASE_URL
    }
    if (process.env.DB_HOST) {
        config.host = process.env.DB_HOST
    }
    if (process.env.DB_PORT) {
        config.port = parseInt(process.env.DB_PORT)
    }
    if (process.env.DB_NAME) {
        config.database = process.env.DB_NAME
    }
    if (process.env.DB_USER) {
        config.user = process.env.DB_USER
    }
    if (process.env.DB_PASSWORD) {
        config.password = process.env.DB_PASSWORD
    }

    return new PostgresStorage(config)
}

/**
 * Storage interface for PRSense
 */

export interface PRRecord {
    prId: number
    title: string
    description: string
    files: string[]
    textEmbedding: Float32Array
    diffEmbedding: Float32Array
    createdAt: number
}

export interface CheckResult {
    prId: number
    resultType: 'DUPLICATE' | 'POSSIBLE' | 'UNIQUE'
    originalPrId?: number
    confidence: number
    timestamp: number
}

export interface AnalyticsData {
    summary: {
        totalPRs: number
        duplicatesFound: number
        possibleDuplicates: number
        uniquePRs: number
        detectionRate: number
    }
    timeline: Array<{ date: string; duplicates: number; possible: number; unique: number }>
}

export interface StorageBackend {
    /**
     * Save a PR and its embeddings
     */
    save(record: PRRecord): Promise<void>

    /**
     * Save a check result for analytics
     */
    saveCheck(result: CheckResult): Promise<void>

    /**
     * Get analytics data
     */
    getAnalytics(): Promise<AnalyticsData>

    /**
     * Save an architectural decision extracted from PR comments (EDM)
     */
    saveDecision?(decision: import('../edm/comments.js').ArchitecturalDecision): Promise<void>

    /**
     * Search architectural decisions
     */
    searchDecisions?(queryEmbedding: Float32Array, limit: number): Promise<import('../edm/comments.js').ArchitecturalDecision[]>

    /**
     * Save a codebase text chunk (for RAG)
     */
    saveChunk?(chunk: import('../rag/astChunker.js').CodeChunk & { embedding: Float32Array }): Promise<void>

    /**
     * Search codebase chunks (for RAG)
     */
    searchChunks?(queryEmbedding: Float32Array, limit: number): Promise<Array<import('../rag/astChunker.js').CodeChunk & { embedding: Float32Array, score: number }>>

    /**
     * Get a PR by ID
     */
    get(prId: number): Promise<PRRecord | null>

    /**
     * Get all PRs (for search)
     */
    getAll(): Promise<PRRecord[]>

    /**
     * Search for similar PRs (basic implementation)
     */
    search(embedding: Float32Array, limit: number): Promise<Array<{ prId: number; score: number }>>

    /**
     * Delete a PR
     */
    delete(prId: number): Promise<void>

    /**
     * Close storage connection
     */
    close(): Promise<void>
}

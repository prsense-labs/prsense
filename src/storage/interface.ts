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

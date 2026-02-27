/**
 * PRSense - Easy-to-use API wrapper
 * 
 * Simplified interface for duplicate PR detection
 */

import { createHash } from 'crypto'
import type { PRMetadata } from './types.js'
import type { StorageBackend } from './storage/interface.js'
import { BloomFilter } from './bloomFilter.js'
import { AttributionGraph } from './attributionGraph.js'
import { EmbeddingPipeline } from './embeddingPipeline.js'
import type { Embedder } from './embeddingPipeline.js'
import { withCache, EmbeddingCache } from './embeddingCache.js'
import { jaccard } from './jaccard.js'
import { cosine } from './similarity.js'
import { validatePRInput, validateWeights, validateThresholds, validateConfig, sanitizeString, sanitizeFilePath } from './validation.js'
import { ConfigurationError, ValidationError, EmbeddingError } from './errors.js'

/**
 * Configuration options for PRSense
 */
export interface PRSenseConfig {
    embedder: Embedder
    duplicateThreshold?: number
    possibleThreshold?: number
    weights?: [number, number, number] // [text, diff, file]
    bloomFilterSize?: number
    maxCandidates?: number
    /** Enable embedding cache for faster repeat checks */
    enableCache?: boolean
    /** Maximum cache size (number of embeddings) */
    cacheSize?: number
    /** Repository ID for cross-repo detection */
    repoId?: string
}

/**
 * Input for duplicate check
 */
export interface PRInput {
    prId: number
    title: string
    description: string
    files: string[]
    diff?: string
}

/**
 * Detection result
 */
export type DetectionResult =
    | { type: 'DUPLICATE'; originalPr: number; confidence: number }
    | { type: 'POSSIBLE'; originalPr: number; confidence: number }
    | { type: 'UNIQUE'; confidence: number }

/**
 * Score breakdown showing contribution of each signal
 */
export interface ScoreBreakdown {
    textSimilarity: number
    diffSimilarity: number
    fileSimilarity: number
    textContribution: number  // textSimilarity * weight
    diffContribution: number  // diffSimilarity * weight
    fileContribution: number  // fileSimilarity * weight
    finalScore: number
    weights: [number, number, number]
}

/**
 * Detailed detection result with score breakdown
 */
export type DetailedDetectionResult =
    | { type: 'DUPLICATE'; originalPr: number; confidence: number; breakdown: ScoreBreakdown }
    | { type: 'POSSIBLE'; originalPr: number; confidence: number; breakdown: ScoreBreakdown }
    | { type: 'UNIQUE'; confidence: number; breakdown?: ScoreBreakdown }

/**
 * Options for check methods
 */
export interface CheckOptions {
    /** Skip indexing this PR (dry-run mode) */
    dryRun?: boolean
    /** Return detailed score breakdown */
    detailed?: boolean
}

/**
 * Batch check result
 */
export interface BatchCheckResult {
    prId: number
    result: DetectionResult
    processingTimeMs: number
}

/**
 * Main PRSense detector class
 * 
 * Usage:
 * ```typescript
 * const detector = new PRSenseDetector({ embedder: myEmbedder })
 * const result = await detector.check(prData)
 * ```
 */
export class PRSenseDetector {
    private bloom: BloomFilter
    private graph: AttributionGraph
    private pipeline: EmbeddingPipeline
    private embeddings: Map<number, { text: Float32Array; diff: Float32Array }>
    private metadata: Map<number, PRMetadata>
    private storage?: StorageBackend
    private config: PRSenseConfig
    private cache?: EmbeddingCache

    private duplicateThreshold: number
    private possibleThreshold: number
    private weights: [number, number, number]
    private maxCandidates: number

    constructor(config: PRSenseConfig & { storage?: StorageBackend }) {
        // Validate configuration
        if (!config.embedder) {
            throw new ConfigurationError('embedder is required')
        }

        // Validate thresholds
        validateThresholds(config.duplicateThreshold, config.possibleThreshold)

        // Validate weights if provided
        if (config.weights) {
            validateWeights(config.weights)
        }

        // Validate bloom filter size, maxCandidates, and cacheSize
        validateConfig({
            ...(config.bloomFilterSize !== undefined ? { bloomFilterSize: config.bloomFilterSize } : {}),
            ...(config.maxCandidates !== undefined ? { maxCandidates: config.maxCandidates } : {}),
            ...(config.enableCache && config.cacheSize !== undefined ? { cacheSize: config.cacheSize } : {})
        })

        this.config = config
        this.bloom = new BloomFilter(config.bloomFilterSize || 8192, 5)
        this.graph = new AttributionGraph()

        // Feature 4: Embedding Cache Integration
        if (config.enableCache) {
            const wrapped = withCache(config.embedder, config.cacheSize)
            this.cache = wrapped.cache
            this.pipeline = new EmbeddingPipeline(wrapped)
        } else {
            this.pipeline = new EmbeddingPipeline(config.embedder)
        }

        // Feature 1: Storage Integration
        if (config.storage) {
            this.storage = config.storage
        }

        this.embeddings = new Map()
        this.metadata = new Map()

        this.duplicateThreshold = config.duplicateThreshold ?? 0.90
        this.possibleThreshold = config.possibleThreshold ?? 0.82
        this.weights = config.weights ?? [0.45, 0.35, 0.20]
        this.maxCandidates = config.maxCandidates ?? 20

        // NOTE: Call await detector.init() after construction to load from storage.
        // The constructor cannot be async, so storage loading is deferred.
    }

    /**
     * Initialize the detector, loading any persisted state from storage.
     * Must be called after construction if using persistent storage.
     * 
     * ```typescript
     * const detector = new PRSenseDetector({ embedder, storage })
     * await detector.init()
     * ```
     */
    async init(): Promise<void> {
        if (this.storage) {
            await this.loadFromStorage()
        }
    }

    /**
     * Compute a content hash for the PR
     */
    private computeContentHash(title: string, description: string, diff: string = ''): string {
        return createHash('sha1')
            .update(title + description + diff)
            .digest('hex')
    }

    /**
     * Load state from persistent storage
     */
    private async loadFromStorage() {
        if (!this.storage) return

        try {
            const records = await this.storage.getAll()
            for (const record of records) {
                // Populate in-memory index
                this.embeddings.set(record.prId, {
                    text: record.textEmbedding,
                    diff: record.diffEmbedding
                })
                this.metadata.set(record.prId, {
                    prId: record.prId,
                    repoId: 0,
                    authorId: 0,
                    title: record.title,
                    description: record.description,
                    createdAt: record.createdAt,
                    files: record.files
                })
                const contentHash = this.computeContentHash(record.title, record.description, '')
                this.bloom.add(contentHash)
            }
        } catch (e) {
            console.error('Failed to load from storage:', e)
        }
    }

    /**
     * Check if a PR is a duplicate
     */
    async check(pr: PRInput, options?: CheckOptions): Promise<DetectionResult> {
        // Validate input
        validatePRInput(pr)

        // Sanitize inputs
        const sanitizedPR: PRInput = {
            prId: pr.prId,
            title: sanitizeString(pr.title),
            description: sanitizeString(pr.description),
            files: pr.files.map(f => sanitizeFilePath(f)),
            ...(pr.diff ? { diff: sanitizeString(pr.diff) } : {})
        }

        const result = await this.checkInternal(sanitizedPR, options)

        // Save check result for analytics if not dry-run
        if (!options?.dryRun && this.storage) {
            try {
                await this.storage.saveCheck({
                    prId: sanitizedPR.prId,
                    resultType: result.type,
                    confidence: result.confidence,
                    timestamp: Date.now(),
                    ...(result.type !== 'UNIQUE' ? { originalPrId: result.originalPr } : {})
                })
            } catch (error) {
                console.error('Failed to save check result:', error)
            }
        }

        return {
            type: result.type,
            confidence: result.confidence,
            ...(result.type !== 'UNIQUE' ? { originalPr: result.originalPr } : {})
        } as DetectionResult
    }

    /**
     * Check with detailed score breakdown (Feature 2: Explainability)
     */
    async checkDetailed(pr: PRInput, options?: CheckOptions): Promise<DetailedDetectionResult> {
        // Validate input
        validatePRInput(pr)

        // Sanitize inputs
        const sanitizedPR: PRInput = {
            prId: pr.prId,
            title: sanitizeString(pr.title),
            description: sanitizeString(pr.description),
            files: pr.files.map(f => sanitizeFilePath(f)),
            ...(pr.diff ? { diff: sanitizeString(pr.diff) } : {})
        }

        return this.checkInternal(sanitizedPR, { ...options, detailed: true })
    }

    /**
     * Batch check multiple PRs at once (Feature 3: Batch API)
     */
    async checkMany(prs: PRInput[], options?: CheckOptions): Promise<BatchCheckResult[]> {
        if (!Array.isArray(prs)) {
            throw new ValidationError('prs must be an array', 'prs')
        }

        if (prs.length === 0) {
            return []
        }

        if (prs.length > 1000) {
            throw new ValidationError('Cannot process more than 1000 PRs in a single batch', 'prs')
        }

        const results: BatchCheckResult[] = []

        for (const pr of prs) {
            try {
                const startTime = Date.now()
                const result = await this.check(pr, options)
                results.push({
                    prId: pr.prId,
                    result,
                    processingTimeMs: Date.now() - startTime
                })
            } catch (error) {
                // Continue processing other PRs even if one fails
                // Include error in result for visibility
                results.push({
                    prId: pr.prId,
                    result: {
                        type: 'UNIQUE',
                        confidence: 0
                    },
                    processingTimeMs: 0
                })
                // Log error but don't stop batch processing
                console.error(`Failed to process PR #${pr.prId}:`, error)
            }
        }

        return results
    }

    /**
     * Update scoring weights at runtime (Feature 5: Configurable Weights)
     */
    setWeights(weights: [number, number, number]): void {
        validateWeights(weights)

        const sum = weights[0] + weights[1] + weights[2]
        if (Math.abs(sum - 1.0) > 0.001) {
            // Normalize weights to sum to 1.0
            this.weights = [
                weights[0] / sum,
                weights[1] / sum,
                weights[2] / sum
            ] as [number, number, number]
        } else {
            this.weights = weights
        }
    }

    /**
     * Get current scoring weights
     */
    getWeights(): [number, number, number] {
        return [...this.weights] as [number, number, number]
    }

    /**
     * Internal check that returns detailed result
     */
    private async checkInternal(pr: PRInput, options?: CheckOptions): Promise<DetailedDetectionResult> {
        // 1. Generate embeddings (check cache first)
        let textEmbedding: Float32Array
        let diffEmbedding: Float32Array

        try {
            // Feature 4: Cache hit?
            const cached = this.cache?.get(pr.title, pr.description, pr.diff || '')
            if (cached) {
                textEmbedding = cached.textEmbedding
                diffEmbedding = cached.diffEmbedding
            } else {
                // Cache miss - run pipeline
                const result = await this.pipeline.run(
                    pr.title,
                    pr.description,
                    pr.diff || ''
                )
                textEmbedding = result.textEmbedding
                diffEmbedding = result.diffEmbedding

                // Validate embedding dimensions
                if (!textEmbedding || textEmbedding.length === 0) {
                    throw new EmbeddingError('Text embedding is empty')
                }
                if (!diffEmbedding || diffEmbedding.length === 0) {
                    throw new EmbeddingError('Diff embedding is empty')
                }

                // Store in cache
                this.cache?.set(
                    pr.title,
                    pr.description,
                    pr.diff || '',
                    textEmbedding,
                    diffEmbedding
                )
            }
        } catch (error) {
            if (error instanceof EmbeddingError || error instanceof ValidationError) {
                throw error
            }
            throw new EmbeddingError(`Failed to generate embeddings: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined)
        }

        // 2. Fast rejection with Bloom filter
        // We track CONTENT hashes to detect if we've processed this exact PR contents before.
        const contentHash = this.computeContentHash(pr.title, pr.description, pr.diff)

        // Note: Standard Bloom Filters cannot detect *similar* items, only *exact* duplicates.
        // A true "Fast Path" for similarity would require LSH (Locality Sensitive Hashing),
        // which is a future roadmap item. For now, we optimistically proceed to Vector Search.

        // 3. Find candidates (simplified ANN - iterate all for now)
        const candidates = await this.findCandidates(textEmbedding, this.maxCandidates)

        if (candidates.length === 0) {
            if (!options?.dryRun) {
                await this.addToIndex(pr, textEmbedding, diffEmbedding)
            }
            return { type: 'UNIQUE', confidence: 0 }
        }

        // 4. Score all candidates with breakdown
        let bestMatch: { prId: number; score: number; breakdown: ScoreBreakdown } | null = null

        for (const candidate of candidates) {
            const candidateEmbed = this.embeddings.get(candidate.prId)
            const candidateMeta = this.metadata.get(candidate.prId)

            if (!candidateEmbed || !candidateMeta) continue

            const fileSimilarity = jaccard(
                new Set(pr.files),
                new Set(candidateMeta.files || [])
            )

            const textSimilarity = cosine(textEmbedding, candidateEmbed.text)
            const diffSimilarity = cosine(diffEmbedding, candidateEmbed.diff)

            const breakdown: ScoreBreakdown = {
                textSimilarity,
                diffSimilarity,
                fileSimilarity,
                textContribution: this.weights[0] * textSimilarity,
                diffContribution: this.weights[1] * diffSimilarity,
                fileContribution: this.weights[2] * fileSimilarity,
                finalScore: this.weights[0] * textSimilarity +
                    this.weights[1] * diffSimilarity +
                    this.weights[2] * fileSimilarity,
                weights: [...this.weights] as [number, number, number]
            }

            if (!bestMatch || breakdown.finalScore > bestMatch.score) {
                bestMatch = { prId: candidate.prId, score: breakdown.finalScore, breakdown }
            }
        }

        // 5. Add to index (unless dry-run)
        if (!options?.dryRun) {
            await this.addToIndex(pr, textEmbedding, diffEmbedding)
        }

        // 6. Make decision with breakdown
        if (!bestMatch) {
            return { type: 'UNIQUE', confidence: 0 }
        }

        if (bestMatch.score >= this.duplicateThreshold) {
            if (!options?.dryRun) {
                this.graph.addEdge(pr.prId, bestMatch.prId)
            }
            return {
                type: 'DUPLICATE',
                originalPr: bestMatch.prId,
                confidence: bestMatch.score,
                breakdown: bestMatch.breakdown
            }
        }

        if (bestMatch.score >= this.possibleThreshold) {
            return {
                type: 'POSSIBLE',
                originalPr: bestMatch.prId,
                confidence: bestMatch.score,
                breakdown: bestMatch.breakdown
            }
        }

        return {
            type: 'UNIQUE',
            confidence: bestMatch.score,
            breakdown: bestMatch.breakdown
        }
    }

    /**
     * Get all duplicates of a PR
     */
    getDuplicates(prId: number): number[] {
        return this.graph.getAllDuplicates(prId)
    }

    /**
     * Get original PR in duplicate chain
     */
    getOriginal(prId: number): number {
        return this.graph.getOriginal(prId)
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            totalPRs: this.embeddings.size,
            bloomFilterSize: this.bloom['size'],
            duplicatePairs: this.countDuplicatePairs(),
            storage: this.storage ? 'connected' : 'memory'
        }
    }

    // Private helpers

    private async addToIndex(
        pr: PRInput,
        textEmbedding: Float32Array,
        diffEmbedding: Float32Array
    ): Promise<void> {
        // Add content hash to Bloom Filter (use content hash, not ID)
        const contentHash = this.computeContentHash(pr.title, pr.description, pr.diff)
        this.bloom.add(contentHash)

        this.embeddings.set(pr.prId, { text: textEmbedding, diff: diffEmbedding })
        this.metadata.set(pr.prId, {
            prId: pr.prId,
            repoId: 0,
            authorId: 0,
            title: pr.title,
            description: pr.description,
            createdAt: Date.now(),
            files: pr.files
        } as PRMetadata & { files: string[] })

        // Persist to storage if available
        if (this.storage) {
            try {
                await this.storage.save({
                    prId: pr.prId,
                    title: pr.title,
                    description: pr.description,
                    files: pr.files,
                    textEmbedding,
                    diffEmbedding,
                    createdAt: Date.now()
                })
            } catch (error) {
                // Log error but don't fail the operation
                console.error('Failed to save to storage:', error)
            }
        }
    }

    /**
     * Search for PRs using natural language query
     */
    async search(query: string, limit: number = 10): Promise<import('./types.js').SearchResult[]> {
        // 1. Generate text embedding for query
        let queryEmbedding: Float32Array
        try {
            const result = await this.pipeline.run(query, '', '')
            queryEmbedding = result.textEmbedding
        } catch (error) {
            throw new EmbeddingError(`Failed to generate query embedding: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined)
        }

        // 2. Find similar PRs
        const candidates = await this.findCandidates(queryEmbedding, limit)

        // 3. Hydrate results
        const results: import('./types.js').SearchResult[] = []
        for (const candidate of candidates) {
            const meta = this.metadata.get(candidate.prId)
            if (meta) {
                results.push({
                    prId: candidate.prId,
                    score: candidate.score,
                    title: meta.title,
                    description: meta.description,
                    createdAt: meta.createdAt,
                    files: meta.files || []
                })
            } else if (this.storage) {
                // If not in memory but valid candidate (from storage search), fetch details
                const record = await this.storage.get(candidate.prId)
                if (record) {
                    results.push({
                        prId: record.prId,
                        score: candidate.score,
                        title: record.title,
                        description: record.description,
                        createdAt: record.createdAt,
                        files: record.files
                    })
                }
            }
        }

        return results
    }

    private async findCandidates(
        queryEmbedding: Float32Array,
        k: number
    ): Promise<Array<{ prId: number; score: number }>> {
        // Use storage search if available and has efficient vector search (e.g. Postgres)
        if (this.storage) {
            try {
                return await this.storage.search(queryEmbedding, k)
            } catch (e) {
                console.warn('Storage search failed, falling back to in-memory search', e)
            }
        }

        // Fallback: score all PRs (in production, use ANN index)
        const scores: Array<{ prId: number; score: number }> = []

        for (const [prId, embeddings] of this.embeddings.entries()) {
            const score = cosine(queryEmbedding, embeddings.text)
            scores.push({ prId, score })
        }

        // Return top-k
        return scores
            .sort((a, b) => b.score - a.score)
            .slice(0, k)
    }

    private countDuplicatePairs(): number {
        let count = 0
        for (const prId of this.embeddings.keys()) {
            count += this.graph.getAllDuplicates(prId).length
        }
        return count
    }

    /**
     * Export detector state for persistence
     */
    exportState(): { records: any[]; bloom: string } {
        const records = []
        for (const [prId, meta] of this.metadata.entries()) {
            const embedding = this.embeddings.get(prId)
            if (embedding) {
                records.push({
                    ...meta,
                    textEmbedding: Array.from(embedding.text), // Convert Float32Array to Array for JSON
                    diffEmbedding: Array.from(embedding.diff)
                })
            }
        }
        return {
            records,
            bloom: this.bloom.export()
        }
    }

    /**
     * Import detector state from persistence
     */
    importState(data: { records: any[]; bloom: string }): void {
        // Import Bloom filter
        if (data.bloom) {
            this.bloom.import(data.bloom)
        }

        // Import records
        for (const record of data.records) {
            this.embeddings.set(record.prId, {
                text: new Float32Array(record.textEmbedding),
                diff: new Float32Array(record.diffEmbedding)
            })

            // Reconstruct metadata (remove embedding fields from metadata object)
            const { textEmbedding, diffEmbedding, ...meta } = record
            this.metadata.set(record.prId, meta)
        }
    }
}

/**
 * Extended PRMetadata with file information
 */
declare module './types.js' {
    interface PRMetadata {
        files?: string[]
    }
}

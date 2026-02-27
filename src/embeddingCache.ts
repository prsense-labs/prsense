/**
 * Embedding Cache - LRU cache for embeddings (Feature 4)
 * 
 * Saves OpenAI API costs by caching computed embeddings
 */

export interface CacheEntry {
    textEmbedding: Float32Array
    diffEmbedding: Float32Array
    cachedAt: number
}

/**
 * LRU (Least Recently Used) cache for embeddings
 */
export class EmbeddingCache {
    private cache: Map<string, CacheEntry>
    private maxSize: number
    private hits: number = 0
    private misses: number = 0

    constructor(maxSize: number = 1000) {
        this.cache = new Map()
        this.maxSize = maxSize
    }

    /**
     * Generate cache key from PR content
     */
    private generateKey(title: string, description: string, diff: string): string {
        // Simple hash based on content
        const content = `${title}\n${description}\n${diff}`
        let hash = 0
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash // Convert to 32bit integer
        }
        return `emb_${hash.toString(16)}`
    }

    /**
     * Get cached embeddings if available
     */
    get(title: string, description: string, diff: string): CacheEntry | null {
        const key = this.generateKey(title, description, diff)
        const entry = this.cache.get(key)

        if (entry) {
            this.hits++
            // Move to end for LRU (delete and re-add)
            this.cache.delete(key)
            this.cache.set(key, entry)
            return entry
        }

        this.misses++
        return null
    }

    /**
     * Store embeddings in cache
     */
    set(
        title: string,
        description: string,
        diff: string,
        textEmbedding: Float32Array,
        diffEmbedding: Float32Array
    ): void {
        const key = this.generateKey(title, description, diff)

        // Evict oldest entries if at capacity
        while (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value
            if (oldestKey) {
                this.cache.delete(oldestKey)
            }
        }

        this.cache.set(key, {
            textEmbedding,
            diffEmbedding,
            cachedAt: Date.now()
        })
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const total = this.hits + this.misses
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? this.hits / total : 0
        }
    }

    /**
     * Clear the cache
     */
    clear(): void {
        this.cache.clear()
        this.hits = 0
        this.misses = 0
    }

    /**
     * Export cache for persistence
     */
    export(): { entries: Array<{ key: string; entry: { textEmbedding: number[]; diffEmbedding: number[]; cachedAt: number } }> } {
        const entries: Array<{ key: string; entry: { textEmbedding: number[]; diffEmbedding: number[]; cachedAt: number } }> = []
        for (const [key, entry] of this.cache.entries()) {
            entries.push({
                key,
                entry: {
                    textEmbedding: Array.from(entry.textEmbedding),
                    diffEmbedding: Array.from(entry.diffEmbedding),
                    cachedAt: entry.cachedAt
                }
            })
        }
        return { entries }
    }

    /**
     * Import cache from persistence
     */
    import(data: { entries: Array<{ key: string; entry: { textEmbedding: number[]; diffEmbedding: number[]; cachedAt: number } }> }): void {
        this.clear()
        for (const { key, entry } of data.entries) {
            this.cache.set(key, {
                textEmbedding: new Float32Array(entry.textEmbedding),
                diffEmbedding: new Float32Array(entry.diffEmbedding),
                cachedAt: entry.cachedAt
            })
        }
    }
}

/**
 * Create a caching wrapper around any embedder.
 * Caches individual embedText and embedDiff calls by their input text.
 */
export function withCache<T extends { embedText: (text: string) => Promise<Float32Array>; embedDiff: (diff: string) => Promise<Float32Array> }>(
    embedder: T,
    cacheSize: number = 1000
): T & { cache: EmbeddingCache } {
    const cache = new EmbeddingCache(cacheSize)
    // Simple per-call text caches (separate from the PR-level composite cache)
    const textCache = new Map<string, Float32Array>()
    const diffCache = new Map<string, Float32Array>()

    return {
        ...embedder,
        cache,
        async embedText(text: string): Promise<Float32Array> {
            const cached = textCache.get(text)
            if (cached) return cached
            const result = await embedder.embedText(text)
            // Evict oldest if over capacity
            if (textCache.size >= cacheSize) {
                const firstKey = textCache.keys().next().value
                if (firstKey) textCache.delete(firstKey)
            }
            textCache.set(text, result)
            return result
        },
        async embedDiff(diff: string): Promise<Float32Array> {
            const cached = diffCache.get(diff)
            if (cached) return cached
            const result = await embedder.embedDiff(diff)
            // Evict oldest if over capacity
            if (diffCache.size >= cacheSize) {
                const firstKey = diffCache.keys().next().value
                if (firstKey) diffCache.delete(firstKey)
            }
            diffCache.set(diff, result)
            return result
        }
    }
}

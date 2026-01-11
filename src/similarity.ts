/**
 * computes cosine similarity between two vectors
 * assumes vectors are same length
 * returns value in range [-1, 1]
 */
export function cosine(
    a: Float32Array,
    b: Float32Array
): number {
    let dot = 0
    let normA = 0
    let normB = 0

    const len = Math.min(a.length,b.length)

    for (let i = 0; i < len; i++) {
        const aVal = a[i] ?? 0
        const bVal = b[i] ?? 0
        dot += aVal * bVal
        normA += aVal * aVal
        normB += bVal * bVal
        }

        if (normA === 0 || normB === 0)
            return 0

        return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}


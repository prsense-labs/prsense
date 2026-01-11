import { cosine } from "./similarity.js";

/**
 * computes final weighted similarity score between two PRs
 * 
 * all component scores must be in range [0, 1]
 */

export function rank(
    textA: Float32Array,
    textB: Float32Array,
    diffA: Float32Array,
    diffB: Float32Array,
    fileScore: number
): number {
    const textSim = cosine(textA, textB)
    const diffSim = cosine(diffA, diffB)

    return (
        0.45 * textSim +
        0.35 * diffSim +
        0.20 * fileScore
    )
}


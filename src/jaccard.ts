/**
 *  computes jaccard similarity between two sets 
 * 
 * used for file-path overlap scoring 
 * 
 * returns value in range [0, 1]
 */
export function jaccard(
    a: Set<string>,
    b: Set<string>
): number {
    if (a.size === 0 && b.size === 0)
        return 1
    if (a.size === 0 || b.size === 0)
        return 0

    let intersection = 0

    // iterate over smaller set for efficiency
    const [small, large] = a.size < b.size ? [a, b] : [b, a]

    for (const value of small) {
        if (large.has(value)) intersection++
    }

    const union = a.size + b.size - intersection
    return union === 0 ? 0 : intersection / union
}

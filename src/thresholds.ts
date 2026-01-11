/**
 * Classifies a similarity score into a confidence tier
 * 
 * Thresholds are intentionally conservative to avoid spam
 */
export function classify(
    score: number
): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (score >= 0.9) return 'HIGH'
    if (score >= 0.82) return 'MEDIUM'
    return 'LOW'
}

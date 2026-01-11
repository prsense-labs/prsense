/**
 * structured output of PR classification
 * 
 */

import type { Decision } from './types.js'

/***
 * centralized decision logic based on final score
 * 
 * thresholds are conservative to prevent spam
 * 
 */

export function decide(
    score: number,
    originalPr: number
): Decision {
    if (score >= 0.9) return { type: 'DUPLICATE', originalPr }

    if (score >= 0.82) return { type: 'POSSIBLE', originalPr }

    return { type: 'IGNORE' }
}

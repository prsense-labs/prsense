/*
Core metadata describing a pull request 

used across indexing attribution and decision layers 
*/

export interface PRMetadata {
    prId: number
    repoId: number
    authorId: number
    title: string
    description: string
    createdAt: number
    mergedAt?: number 
}

/**
 * canonical embedding bundle for a pr
 * text: title + description 
 * diff: code changes
 */

export interface EmbeddingSet {
    text: Float32Array
    diff: Float32Array
}

/**
 * Lightweight representation of a pr candidate
 * Used during ANN + reranking
 */
export interface PRCandidate {
    prId: number
    scoreHint?: number
}
/**
 * file-level signal extracted from PR diff
 */
export type FilePathSet = Set<string>
/**
 * final similarity classification levels
 */
export type MatchLevel = 'HIGH' | 'MEDIUM' | 'LOW'

/**
 * Decision output consumed by bot / API layer
 */

export type Decision = 
| { type: 'DUPLICATE'; originalPr: number }
| { type: 'POSSIBLE'; originalPr: number }
| { type: 'IGNORE' }



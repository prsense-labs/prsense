import { BloomFilter } from "./bloomFilter.js";

/**
 * Lightweight candidate returned from ANN search
 */

export interface Candidate {
    prId: number
    scoreHint: number
}

/**
 * connects bloom filter rejection with ANN retrieval
 * 
 */

export class CandidateRetriever {
    constructor(
        private bloom: BloomFilter, 
        private ann: {
            search(vector: Float32Array, k:number): Candidate[]
        }
    ){}

    /**
     * RETURNS CANDIDATE PRs for reranking
     */

    retrieve(
        key: string,
        vector: Float32Array,
        k = 20 
    ): Candidate[] {
        if (!this.bloom.mightContain(key))
        {
            return []
        }
        return this.ann.search(vector, k)
    }
}

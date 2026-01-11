import { cosine } from './similarity.js'
import { jaccard } from './jaccard.js'
import { rank } from './ranker.js'
import { classify } from './thresholds.js'
import { BloomFilter } from './bloomFilter.js'
import { AttributionGraph } from './attributionGraph.js'
import { EmbeddingPipeline } from './embeddingPipeline.js'
import type { Embedder } from './embeddingPipeline.js'
import { CandidateRetriever } from './candidateRetriever.js'
import type { Candidate } from './candidateRetriever.js'
import { decide } from './decisionEngine.js'

// Simple sanity checks
const a = new Float32Array([1, 2, 3])
const b = new Float32Array([2, 3, 4])

console.log('cosine:', cosine(a, b))
console.log('jaccard:', jaccard(new Set(['a', 'b']), new Set(['b', 'c'])))
console.log('rank:', rank(a, b, a, b, 0.5))
console.log('classify 0.91:', classify(0.91))
console.log('classify 0.85:', classify(0.85))
console.log('classify 0.8:', classify(0.8))

const bloom = new BloomFilter()
bloom.add('test')
console.log('bloom test:', bloom.mightContain('test'), bloom.mightContain('not-there'))

const graph = new AttributionGraph()
graph.addEdge(2, 1)
graph.addEdge(3, 1)
console.log('original of 2:', graph.getOriginal(2))
console.log('all duplicates of 1:', graph.getAllDuplicates(1))

// Minimal dummy Embedder
const dummyEmbedder: Embedder = {
  embedText: async (t: string) => new Float32Array([t.length, 0, 1]),
  embedDiff: async (d: string) => new Float32Array([d.length, 0, 1])
}
const pipeline = new EmbeddingPipeline(dummyEmbedder)
pipeline.run('title', 'body', 'diff').then((e) => console.log('embeddingPipeline:', e))

const candidates: Candidate[] = [{ prId: 1, scoreHint: 0.9 }]
const retriever = new CandidateRetriever(bloom, { search: (v: Float32Array, k: number) => candidates })
console.log('candidateRetriever:', retriever.retrieve('test', a))

console.log('decisionEngine DUPLICATE:', decide(0.95, 1))
console.log('decisionEngine POSSIBLE:', decide(0.85, 1))
console.log('decisionEngine IGNORE:', decide(0.8, 1))
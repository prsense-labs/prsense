# Data Structures

## Overview

PRSense uses carefully chosen data structures to balance **performance**, **accuracy**, and **maintainability**.

---

## 1. Bloom Filter

### Purpose
Probabilistic set for O(1) duplicate rejection.

### Implementation
```typescript
class BloomFilter {
  private bits: Uint8Array      // Bit array
  private size: number           // Array size
  private hashes: number         // Number of hash functions
}
```

### Properties
- **Space**: 8192 bytes (8 KB) by default
- **False positive rate**: ~1% with 5 hash functions
- **False negatives**: 0% (guaranteed)

### Tuning
```
m = -n * ln(p) / (ln(2)^2)
k = (m / n) * ln(2)
```
Where:
- **m** = bit array size
- **n** = expected number of PRs
- **p** = target false positive rate
- **k** = optimal number of hash functions

### Example
For 1000 PRs with 1% FP rate:
- m ≈ 9585 bits
- k ≈ 7 hash functions

---

## 2. Attribution Graph

### Purpose
Directed acyclic graph (DAG) tracking PR duplication lineage.

### Structure
```typescript
class AttributionGraph {
  private parent: Map<number, number>           // child → parent
  private children: Map<number, Set<number>>    // parent → children
}
```

### Invariants
1. **Acyclic**: No PR can be its own ancestor
2. **Single parent**: Each PR has at most one original
3. **Multiple children**: Original PR can have many duplicates

### Visual Example
```
PR #100 (original)
  ├── PR #101 (duplicate)
  ├── PR #102 (duplicate)
  └── PR #103 (duplicate)
        └── PR #104 (duplicate of duplicate)
```

### Operations
| Operation | Time | Description |
|-----------|------|-------------|
| `addEdge(dup, orig)` | O(1) | Link duplicate to original |
| `getOriginal(pr)` | O(depth) | Find root ancestor |
| `getAllDuplicates(pr)` | O(n) | Get all descendants |

---

## 3. Embedding Storage

### Format
```typescript
interface EmbeddingSet {
  text: Float32Array    // 384-768 dimensions
  diff: Float32Array    // 384-768 dimensions
}
```

### Memory Considerations
For 1M PRs with 768-dim embeddings:
```
storage = 1M × 2 embeddings × 768 dims × 4 bytes/float
        = 6.1 GB
```

### Optimization Strategies
1. **Quantization**: 4-byte float → 1-byte int8 (4× smaller)
2. **PCA reduction**: 768 dims → 256 dims (3× smaller)
3. **Sparse storage**: Only store non-zero values

---

## 4. Candidate Queue

### Purpose
Priority queue for re-ranking ANN results.

### Structure
```typescript
interface Candidate {
  prId: number
  scoreHint: number    // Initial ANN score
}
```

### Usage
```typescript
// ANN returns candidates with approximate scores
const candidates = annIndex.search(embedding, k=20)

// Re-rank with exact multi-signal scoring
candidates.sort((a, b) => 
  exactScore(b) - exactScore(a)
)
```

### Batch Results (Feature 3)
```typescript
interface BatchResult {
  prId: number
  bestMatch?: {
    originalPrId: number
    confidence: number
    type: 'DUPLICATE' | 'POSSIBLE'
  }
  processingTimeMs: number
}
```

---

## 5. File Path Set

### Purpose
Fast file overlap computation.

### Implementation
```typescript
type FilePathSet = Set<string>
```

### Why Set?
- **O(1) membership test**: `set.has(path)`
- **Native deduplication**: No manual handling
- **Memory efficient**: Stores unique paths only

### Example
```typescript
const files1 = new Set(['auth/login.ts', 'auth/utils.ts'])
const files2 = new Set(['auth/login.ts', 'auth/session.ts'])

// Jaccard similarity
const intersection = [...files1].filter(f => files2.has(f)).length
const union = files1.size + files2.size - intersection
const score = intersection / union  // 0.33
```

---

## 6. Score Explanation (Feature 2)

### Breakdown Structure
```typescript
interface ScoreBreakdown {
  total: number          // 0.0 - 1.0
  components: {
    text: number         // Weighted text similarity
    diff: number         // Weighted diff similarity
    files: number        // Weighted file overlap
  }
  weights: {
    text: number
    diff: number
    files: number
  }
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}
```

### Configurable Weights (Feature 5)
```typescript
interface WeightConfig {
  textWeight: number     // Default: 0.45
  diffWeight: number     // Default: 0.35
  fileWeight: number     // Default: 0.20
  // Sum must equal 1.0
}
```

---

## 7. Cross-Repo Detection (Feature 8)

### Match Structure
```typescript
interface CrossRepoMatch {
  sourcePr: {
    repoId: string
    prId: number
  }
  targetPr: {
    repoId: string
    prId: number
  }
  score: number
}
```

---

## 8. PR Metadata Cache

### Purpose
Avoid re-fetching PR data during scoring.

### Structure
```typescript
interface PRMetadata {
  prId: number
  repoId: number
  authorId: number
  title: string
  description: string
  createdAt: number
  mergedAt?: number
}
```

### Indexing
```typescript
const prCache = new Map<number, PRMetadata>()
```

### Eviction Policy
- **LRU** (Least Recently Used): Keep hot PRs in memory
- **TTL** (Time To Live): Expire old PRs after N days
- **Size-based**: Cap at max memory usage

---

## 9. ANN Index

### Interface
```typescript
interface ANNIndex {
  search(vector: Float32Array, k: number): Candidate[]
}
```

### Implementation Options

#### HNSW (Hierarchical Navigable Small World)
- **Build time**: O(n log n)
- **Query time**: O(log n)
- **Memory**: ~20 bytes per vector
- **Best for**: <10M vectors

#### IVF (Inverted File Index)
- **Build time**: O(n · k) for k clusters
- **Query time**: O(n_probe + k)
- **Memory**: ~8 bytes per vector
- **Best for**: >10M vectors

---

## Memory Layout Summary

For **1M PRs** in a production system:

| Component | Size | Notes |
|-----------|------|-------|
| Bloom filter | 1 MB | 8192 bits |
| Embeddings | 6 GB | 768-dim float32 |
| Attribution graph | 20 MB | ~20 edges per PR |
| PR metadata | 200 MB | Cached subset |
| ANN index | 20 MB | HNSW overhead |
| **Total** | **~6.2 GB** | Fits in single machine |

---

## Design Tradeoffs

### Bloom Filter
- ✅ **Pro**: Fast O(1) rejection
- ❌ **Con**: False positives possible
- **Choice**: Acceptable for early filtering

### In-Memory Storage
- ✅ **Pro**: Low latency
- ❌ **Con**: Memory constraints
- **Choice**: Optimize for <10M PRs

### Float32 Embeddings
- ✅ **Pro**: Better accuracy than quantized
- ❌ **Con**: 4× larger than int8
- **Choice**: Accuracy over space (for now)

---

## Future Optimizations

1. **Disk-backed storage** for cold PRs
2. **GPU acceleration** for batch scoring
3. **Distributed index** for >100M PRs
4. **Compressed embeddings** (Product Quantization)

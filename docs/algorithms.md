# Algorithms

## Overview

PRSense uses a **multi-stage pipeline** combining probabilistic data structures, approximate nearest neighbor search, and weighted scoring. It is designed for both real-time interactive use and high-throughput **batch processing** in CI/CD pipelines.

---

## 1. Bloom Filter (Fast Rejection)

### Purpose
Early rejection of obviously unrelated PRs in O(1) time.

### Algorithm
```
BloomFilter.add(key):
  for i in [1..k]:
    index = hash(key, seed=i) % size
    bits[index] = 1

BloomFilter.mightContain(key):
  for i in [1..k]:
    index = hash(key, seed=i) % size
    if bits[index] == 0:
      return false
  return true
```

### Properties
- **False positives**: Allowed (conservatively passes PRs to next stage)
- **False negatives**: Forbidden (never rejects a potential match)
- **Space**: O(n) where n = number of PRs
- **Time**: O(k) where k = number of hash functions (typically 5)

### Hash Function
Simple polynomial rolling hash for deterministic behavior across environments.

---

## 2. Embedding Generation

### Purpose
Convert PR text and diff into fixed-size vectors for similarity comparison.

### Pipeline
```
EmbeddingPipeline.run(title, description, diff):
  text = title + "\n" + description
  textEmbedding = embedder.embedText(text)
  diffEmbedding = embedder.embedDiff(diff)
  return { textEmbedding, diffEmbedding }
```

### Supported Backends
PRSense supports pluggable embedders:
1.  **OpenAI** (Default): Uses `text-embedding-3-small` for high accuracy.
2.  **ONNX** (Offline): Uses `all-MiniLM-L6-v2` running locally via ONNX Runtime. **Privacy-first** option requiring no API keys or external data transfer (Feature 7).

### Optimization
- **Caching**: LRU cache stores computed embeddings to reduce API costs and latency for repeated checks (Feature 4).

---

## 3. Approximate Nearest Neighbor (ANN) Search

### Purpose
Find top-k candidate PRs similar to the query PR.

### Interface
```
ANNIndex.search(vector, k) → Candidate[]
```

### Implementation Options
- **Memory (Default)**: Exact brute-force search (fast for <10k PRs).
- **PostgreSQL**: Uses `pgvector` with HNSW indexing for efficient similarity search at scale.
- **SQLite**: Uses vector extensions when available.

### HNSW (Hierarchical Navigable Small World)
HNSW is a graph-based algorithm for approximate nearest neighbor search:
- Builds a multi-layer graph where higher layers contain fewer, well-connected nodes
- Search starts from the top layer and greedily descends to find nearest neighbors
- Provides O(log n) query time with high recall (>95%)

### Complexity
- **Build**: O(n log n)
- **Query**: O(log n) expected with HNSW/IVF

---

## 4. Multi-Signal Scoring (Ranker)

### Purpose
Combine multiple similarity signals into a single confidence score.

### Formula
```
score = w₁ · cosine(text₁, text₂) 
      + w₂ · cosine(diff₁, diff₂)
      + w₃ · jaccard(files₁, files₂)
```

### Configurable Weights
Weights can be tuned via `setWeights()` to adapt to different repository styles (Feature 5).

| Component | Default Weight | Represents |
|-----------|----------------|------------|
| **w₁ Text** | **0.45** | Intent matching (What is this trying to do?) |
| **w₂ Diff** | **0.35** | Implementation matching (How does it do it?) |
| **w₃ Files**| **0.20** | Structural similarity (Where is it changing?) |

### Cosine Similarity
```
cosine(a, b) = (a · b) / (||a|| × ||b||)
```
- Range: [-1, 1], normalized to [0, 1] for scoring.

### Jaccard Similarity
```
jaccard(A, B) = |A ∩ B| / |A ∪ B|
```
- Measures overlap of touched files.

---

## 5. Threshold Classification

### Purpose
Convert continuous score into discrete confidence levels.

### Thresholds
```
classify(score):
  if score >= 0.90: return HIGH
  if score >= 0.82: return MEDIUM
  return LOW
```

### Rationale
- **0.90**: Very high confidence (safe for automated labels/comments).
- **0.82**: Medium confidence (requires human review).
- **<0.82**: Low confidence (ignored to prevent noise).

---

## 6. Decision Engine

### Purpose
Map confidence levels to concrete actions.

### Rules
```
decide(score, originalPrId):
  if score >= 0.90:
    return { type: 'DUPLICATE', originalPr }
  if score >= 0.82:
    return { type: 'POSSIBLE', originalPr }
  return { type: 'IGNORE' }
```

### Explainability
Using `checkDetailed()`, the engine provides a full breakdown of *why* a decision was made, including the individual contribution of text, diff, and file signals (Feature 2).

### Batch Mode
For CI/CD pipelines processing multiple PRs, use `checkBatch()` (Feature 3):
```
checkBatch(prs: PRData[]) → BatchResult[]
```
- Processes PRs in parallel for throughput
- Returns individual results for each PR
- Ideal for scheduled jobs scanning open PRs

---

## 7. Cross-Repository Detection

### Purpose
Detect duplicates across multiple repositories within an organization (Feature 8).

### Algorithm
```
CrossRepoDetector.check(pr, repos[]):
  for repo in repos:
    candidates = repo.index.search(pr.embedding, k=10)
    for candidate in candidates:
      score = ranker.score(pr, candidate)
      if score >= threshold:
        yield { repo, candidate, score }
```

### Use Cases
- Monorepo migrations (detect duplicate fixes across packages)
- Organization-wide PR deduplication
- Fork synchronization

---

## 8. Attribution Graph

### Purpose
Track duplicate lineage to preserve authorship credit.

### Data Structure
```
class AttributionGraph:
  parent: Map<prId, originalPrId>
  children: Map<prId, Set<duplicatePrIds>>
```

Enables O(1) duplicate grouping and O(depth) lookup of original PRs.

---

## Complexity Summary

| Operation | Time | Space |
|-----------|------|-------|
| Bloom filter check | O(k) | O(m) bits |
| Embedding generation | O(text_length) | O(d) per PR |
| ANN search | O(log n) | O(n·d) |
| Scoring | O(d) | O(1) |
| Attribution graph | O(depth) | O(edges) |

Where:
- **k** = hash functions (5)
- **m** = bloom filter size (8192)
- **n** = number of PRs
- **d** = embedding dimension (384-1536)

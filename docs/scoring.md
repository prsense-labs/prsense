# Scoring System

## Multi-Signal Approach

PRSense combines **three independent signals** to detect duplicate PRs:

1. **Text Similarity** (title + description)
2. **Diff Similarity** (code changes)
3. **File Overlap** (modified files)

---

## Scoring Formula

```
final_score = w₁ · text_sim + w₂ · diff_sim + w₃ · file_sim
```

### Default Weights
```
w₁ = 0.45  (text)
w₂ = 0.35  (diff)
w₃ = 0.20  (files)
```

### Rationale

#### Text Weight (45%)
- **Captures intent**: Same bug description = likely duplicate
- **Language-agnostic**: Works across all repos
- **Early signal**: Available before code is written

#### Diff Weight (35%)
- **Captures implementation**: Similar code changes
- **High precision**: Exact matches are strong signals
- **Language-specific**: Better for detecting copy-paste

#### File Weight (20%)
- **Captures structure**: Same files modified
- **Fast to compute**: No ML needed
- **Hard signal**: Same files + high text sim = very likely duplicate

---

## Signal 1: Text Similarity

### Input
```
text = title + "\n" + description
```

### Method
Cosine similarity of embeddings:
```
text_sim = cosine(embed(text₁), embed(text₂))
```

### Example
```typescript
PR #1: "Fix login bug when password is empty"
PR #2: "Resolve authentication issue with blank passwords"

// Same intent, different wording
text_sim = 0.87  // High similarity
```

### Edge Cases
- **Empty description**: Use title only
- **Very long text**: Truncate to 512 tokens
- **Non-English**: Use multilingual embeddings

---

## Signal 2: Diff Similarity

### Input
```diff
diff --git a/auth/login.ts b/auth/login.ts
@@ -10,7 +10,7 @@
function login(password: string) {
-  if (password) {
+  if (password && password.length > 0) {
     authenticate()
   }
}
```

### Method
Cosine similarity of diff embeddings:
```
diff_sim = cosine(embed(diff₁), embed(diff₂))
```

### Preprocessing
1. Remove whitespace-only changes
2. Normalize variable names
3. Focus on structural changes

### Example
```typescript
// Similar fix, different variable names
diff1: "if (password) → if (password && password.length > 0)"
diff2: "if (pwd) → if (pwd && pwd.length > 0)"

diff_sim = 0.92  // Very high similarity
```

---

## Signal 3: File Overlap

### Input
```
files = Set of modified file paths
```

### Method
Jaccard similarity:
```
file_sim = |files₁ ∩ files₂| / |files₁ ∪ files₂|
```

### Example
```typescript
PR #1 files: ['auth/login.ts', 'auth/utils.ts']
PR #2 files: ['auth/login.ts', 'auth/session.ts']

intersection = 1  // auth/login.ts
union = 3         // all unique files
file_sim = 1/3 = 0.33
```

### Edge Cases
- **Refactors**: Low file overlap, but high diff similarity
- **Renames**: Track file moves via git history
- **New files**: Contribute to union, not intersection

---

## Score Interpretation

### Range
All scores normalized to **[0, 1]**:
- **1.0** = Identical
- **0.5** = Moderately similar
- **0.0** = Completely unrelated

### Thresholds

| Range | Level | Action |
|-------|-------|--------|
| ≥ 0.90 | HIGH | Auto-flag as DUPLICATE |
| 0.82 - 0.89 | MEDIUM | Suggest to maintainer (POSSIBLE) |
| < 0.82 | LOW | Ignore |

### Examples

#### Case 1: Exact Duplicate
```
text_sim  = 0.95  (same wording)
diff_sim  = 0.98  (identical code)
file_sim  = 1.00  (same files)

final = 0.45(0.95) + 0.35(0.98) + 0.20(1.00) = 0.97
→ HIGH (DUPLICATE)
```

#### Case 2: Different Implementation
```
text_sim  = 0.88  (similar description)
diff_sim  = 0.60  (different approach)
file_sim  = 0.50  (some overlap)

final = 0.45(0.88) + 0.35(0.60) + 0.20(0.50) = 0.70
→ LOW (IGNORE)
```

#### Case 3: Edge Case
```
text_sim  = 0.92  (clear duplicate)
diff_sim  = 0.85  (minor variations)
file_sim  = 0.70  (mostly same files)

final = 0.45(0.92) + 0.35(0.85) + 0.20(0.70) = 0.85
→ MEDIUM (POSSIBLE)
```

---

## Weight Tuning

### Methodology
1. **Collect labeled data**: 1000+ PR pairs marked as duplicate/not-duplicate
2. **Grid search**: Try weight combinations in 0.05 steps
3. **Optimize F1 score**: Balance precision and recall
4. **Validate**: Test on held-out set

### Results (Example)
```
Weights: [0.45, 0.35, 0.20]
Precision: 92%
Recall: 78%
F1: 0.84
```

### Alternative Weights

**Conservative (fewer false positives)**
```
w₁ = 0.50, w₂ = 0.40, w₃ = 0.10
→ Higher threshold on text/diff, less weight on files
```

**Aggressive (fewer false negatives)**
```
w₁ = 0.40, w₂ = 0.30, w₃ = 0.30
→ More weight on file overlap
```

**Cross-Repository (Feature 8)**
When checking across repos, file paths often differ. We recommend lower file weight:
```
w₁ = 0.50, w₂ = 0.45, w₃ = 0.05
→ Rely on text/diff, ignore file paths
```

> **Note**: Use `detector.setWeights()` to adjust these dynamically (Feature 5).

---

## Normalization

### Cosine Similarity
Already normalized to [-1, 1], clamped to [0, 1]:
```typescript
cosine_norm = max(0, cosine(a, b))
```

### Jaccard Similarity
Naturally in [0, 1], no normalization needed.

---

## Explainability

### Score Breakdown
```json
{
  "prId": 101,
  "candidate": 100,
  "score": 0.87,
  "breakdown": {
    "text": { "value": 0.92, "weight": 0.45, "contribution": 0.414 },
    "diff": { "value": 0.85, "weight": 0.35, "contribution": 0.298 },
    "file": { "value": 0.70, "weight": 0.20, "contribution": 0.140 }
  }
}
```

### Visualization
```
Text:  ████████████████████ (0.92)
Diff:  ████████████████     (0.85)
Files: ██████████           (0.70)
       ───────────────────
Final: ████████████████▌    (0.87) → MEDIUM
```

---

## Performance

### Latency
- **Embedding lookup**: 1ms (cached)
- **Cosine computation**: 
  - 0.1ms (OpenAI: 1536-dim)
  - 0.05ms (ONNX: 384-dim)
- **Jaccard computation**: 0.01ms (sets)
- **Total**: ~2ms per candidate

### Throughput
- **Single-threaded**: 500 candidates/sec
- **Parallelized**: 5000 candidates/sec (10 cores)

---

## Future Improvements

1. **Learned weights**: Train a small MLP to combine signals
2. **Temporal decay**: Weight recent PRs higher (Planned v1.1)
3. **Graph Neural Networks**: Model dependency graphs (Planned v1.2)

# PRSense - Quick Start Guide

> [!TIP]
> **First time?** If you haven't installed PRSense yet, see [install.md](install.md) for full setup instructions.

## 🚀 5-Minute Setup

### Prerequisites
```bash
node >= 18.0.0
npm >= 9.0.0
```

### Instant Start (CLI)
```bash
# Check a PR directly
npx prsense check --title "Fix login" --files "auth.ts"

# Dry run (no indexing)
npx prsense check --title "Test PR" --files "test.ts" --dry-run
```

**Output**:
```
📦 Using ONNX local embeddings (no API key found)
🔍 Checking PR #173822...
✅ UNIQUE (Confidence: 0.000)
```

> [!TIP]
> **No API key?** PRSense auto-detects ONNX and runs 100% locally. No setup needed!

---

## 🎯 Basic Usage

### 1. Create Your Own Detector

```typescript
import { PRSenseDetector } from 'prsense'
import { createOpenAIEmbedder } from 'prsense'

const detector = new PRSenseDetector({
  // Use built-in OpenAI embedder
  embedder: createOpenAIEmbedder({ apiKey: process.env.OPENAI_API_KEY }),
  
  // Adjust thresholds
  duplicateThreshold: 0.90,
  possibleThreshold: 0.82
})

// Check if PR is duplicate
const result = await detector.check({
  prId: 123,
  title: 'Fix authentication bug',
  description: 'Handle empty passwords',
  files: ['auth/login.ts']
})

console.log(result)
// { type: 'DUPLICATE', originalPr: 100, confidence: 0.95 }
```

---

## 🔧 Common Use Cases

### Use Case 1: GitHub Bot Integration

```typescript
// In your GitHub webhook handler
app.post('/webhook/pull_request', async (req, res) => {
  const pr = req.body.pull_request
  
  const result = await detector.check({
    prId: pr.number,
    title: pr.title,
    description: pr.body,
    files: pr.changed_files.map(f => f.filename)
  })
  
  if (result.type === 'DUPLICATE') {
    await github.issues.createComment({
      body: `This PR appears to be a duplicate of #${result.originalPr}`
    })
  }
})
```

### Use Case 2: Pre-Submit Check

```typescript
// CLI tool for contributors
async function checkBeforeSubmit(prDraft) {
  const result = await detector.check(prDraft)
  
  if (result.type === 'DUPLICATE') {
    console.warn(`⚠️  Similar PR already exists: #${result.originalPr}`)
    console.log('Would you like to continue anyway? (y/n)')
  } else {
    console.log('✅ No duplicates found. Safe to submit!')
  }
}
```

### Use Case 3: Batch Analysis

```typescript
// Analyze all recent PRs
const recentPRs = await fetchRecentPRs(repo, days=30)
const duplicates = []

for (const pr of recentPRs) {
  const result = await detector.check(pr)
  if (result.type === 'DUPLICATE') {
    duplicates.push({ pr, original: result.originalPr })
  }
}

console.log(`Found ${duplicates.length} duplicates in last 30 days`)
```

---

## ⚙️ Configuration

### Tuning for Your Repo

**Conservative (fewer false positives)**:
```typescript
const detector = new PRSenseDetector({
  duplicateThreshold: 0.95,  // Very high confidence only
  possibleThreshold: 0.88,   // Higher bar for suggestions
  weights: [0.50, 0.40, 0.10] // More weight on text/diff
})
```

**Aggressive (catch more duplicates)**:
```typescript
const detector = new PRSenseDetector({
  duplicateThreshold: 0.85,  // Lower threshold
  possibleThreshold: 0.75,   
  weights: [0.40, 0.30, 0.30] // More weight on file overlap
})
```

---

## 🐛 Troubleshooting

### "Module not found" errors
```bash
# Make sure you built the project
npm run build

# Check dist/ folder exists
ls dist/
```

### "Embedding backend not defined"
```typescript
// Use one of the built-in embedders:
import { createOpenAIEmbedder } from 'prsense' // For accuracy
import { createONNXEmbedder } from 'prsense'   // For free/local

const detector = new PRSenseDetector({
  embedder: createONNXEmbedder()
})
```

### High memory usage
```typescript
// Use smaller bloom filter for small repos
const detector = new PRSenseDetector({
  bloomFilterSize: 1024,  // Default: 8192
  maxCandidates: 10       // Default: 20
})
```

---

## 📊 Monitoring

### Track Performance
```typescript
detector.on('check', (event) => {
  console.log(`PR #${event.prId}: ${event.latency}ms`)
})

detector.on('duplicate-found', (event) => {
  metrics.increment('prsense.duplicates')
})
```

---

## 🎓 Next Steps

1. **Install CLI**: See `docs/cli-usage.md`
2. **Deploy as a service**: See `docs/deployment.md`
3. **Integrate with GitHub**: See `docs/GITHUB_ACTION.md`

---

## 💡 Pro Tips

✅ **Start conservative**: High thresholds (0.90+) to build trust  
✅ **Monitor feedback**: Track when maintainers dismiss alerts  
✅ **Tune per-repo**: Different repos have different patterns  
✅ **Cache embeddings**: Compute once, reuse forever  
✅ **Test on historical data**: Use past PRs to validate accuracy  

---

## 🆘 Getting Help

- 📖 Read the docs: `/docs`
- 🐛 Found a bug? Open an issue
- 💬 Questions? Start a discussion
- 📧 Email: support@prsense.dev (example)

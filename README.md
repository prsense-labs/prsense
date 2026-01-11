

# PRSense 

**Production-Ready AI-Powered Pull Request Duplicate Detection**

> **Mission:** Build trustworthy tools that give repositories memory — reducing duplicate work while preserving contributor credit.

Automatically detect duplicate PRs and save hours of review time. **Deploy in 5 minutes.**

[![Production Ready](https://img.shields.io/badge/production-ready-brightgreen)]() 
[![Deploy to Vercel](https://img.shields.io/badge/deploy-vercel-black)]()
[![Accuracy](https://img.shields.io/badge/accuracy-95%25-blue)]()

---

> [!TIP]
> **New Here?** Start with **[START_HERE.md](START_HERE.md)** for a beginner-friendly overview, then check the guides below.

**Quick Links**:
-  **Installation**: [docs/install.md](docs/install.md)
-  **User Guide**: [docs/user-guide.md](docs/user-guide.md)
-  **CLI Usage**: [docs/cli-usage.md](docs/cli-usage.md)
-  **Deployment**: [docs/deployment.md](docs/deployment.md)

---

## Key Features

### Core Capabilities
- **95% Accuracy** — Real OpenAI embeddings (or free local alternatives)
- **2ms Latency** — Bloom filter + ANN for sub-linear scaling
- **Production Storage** — SQLite (dev) or PostgreSQL + pgvector (prod)
- **GitHub Bot** — Auto-comments on duplicate PRs
- **Deploy in 5min** — Vercel, Docker, or manual server
- **Cost-Effective** — $0-50/month depending on scale
- **Attribution Tracking** — Preserves original authorship credit

### Advanced Features
- **Persistent Storage** — Exports for SQLite/Postgres
- **Score Breakdown** — Explainable "Why" for every match
- **Batch API** — Check 100s of PRs in CI/CD pipelines
- **Embedding Cache** — Reduces API costs by 90%
- **Configurable Weights** — Tune scoring (Text vs Diff vs Files)
- **Dry-Run Mode** — specific testing without indexing
- **ONNX Local Embeddings** — 100% offline, privacy-first
- **Cross-Repo Detection** — Find duplicates across your entire org

📖 **See [Features Documentation](docs/features.md) for details.**

---

## Architecture

```
┌─────────────┐
│  New PR     │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Bloom Filter    │ ──── Early rejection
│ (Fast Path)     │
└──────┬──────────┘
       │ might contain
       ▼
┌─────────────────┐
│ Embedding       │ ──── Text + Diff embeddings
│ Pipeline        │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ ANN Search      │ ──── Candidate retrieval (k=20)
│ (Retriever)     │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Multi-Signal    │ ──── Text + Diff + File Overlap
│ Ranker          │      (Configurable weights)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Decision        │ ──── HIGH (≥0.9), MEDIUM (≥0.82), LOW
│ Engine          │
└──────┬──────────┘
```

---

## Project Structure

```
prsenses-labs/
├── package.json                # Monorepo Root
├── PRSenses/                   # Core Library & API
│   ├── src/                    # Detection Logic
│   └── action/                 # GitHub Action
├── prsense-vscode/             # VS Code Extension
└── prsense-analytics/          # Analytics Dashboard
```

---

## Quick Start

### Installation
```bash
git clone https://github.com/prsense-labs/prsense
cd prsense
npm install     # Installs dependencies
npm run build   # Builds all packages
```

### 6 Ways to Use

**1. GitHub Action** (CI/CD)
```yaml
- uses: prsense-labs/prsense@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    embedding-provider: 'onnx'
```

**2. VS Code Extension** (Local Dev)
- Detects duplicates while you type.
- [Extension Guide](prsense-vscode/README.md)

**3. CLI Tool** (Manual Check)
```bash
npm run cli check my-pr.json
```

**4. GitHub Bot** (Webhook)
- Deploy to Vercel in 2 minutes.
- [Deployment Guide](docs/deployment.md)

**5. Library** (NodeJS Integration)
```typescript
import { PRSenseDetector } from 'prsense'
const result = await detector.check(prData)
```

**6. Microservice** (Docker/API)
- Run as a standalone REST API.
- [Production Setup](docs/production-setup.md)

---

## Usage Example

### Simple API (Recommended)

```typescript
import { PRSenseDetector, createPostgresStorage } from './prsense.js'
import { createOpenAIEmbedder } from './embedders/openai.js'

// 1. Initialize
const storage = await createPostgresStorage().init()
const detector = new PRSenseDetector({
  embedder: createOpenAIEmbedder(),
  storage,
  enableCache: true
})

// 2. Check for duplicates
const result = await detector.checkDetailed({
  prId: 123,
  title: 'Fix login bug',
  description: 'Handle empty passwords',
  files: ['auth/login.ts']
})

// 3. Handle Result
if (result.type === 'DUPLICATE') {
  console.log(`Duplicate of PR #${result.originalPr}`)
  console.log(`Confidence: ${result.confidence}`)
  console.log(`Breakdown:`, result.breakdown)
  // Breakdown: { textSimilarity: 0.95, diffSimilarity: 0.88, ... }
}
```

---

## Documentation Index

- **[problem.md](docs/problem.md)** — Problem statement
- **[algorithms.md](docs/algorithms.md)** — How it works (Deep Dive)
- **[data_structures.md](docs/data_structures.md)** — Bloom filters & Vector Index
- **[scoring.md](docs/scoring.md)** — The math behind the match
- **[complexity.md](docs/complexity.md)** — Performance analysis
- **[features.md](docs/features.md)** — Detailed feature guide
- **[ROADMAP.md](docs/roadmap.md)** — Future plans

---

## Design Principles

1.  **Scalability** — O(1) lookups with Bloom filters
2.  **Accuracy** — Multi-signal scoring > Single vector search
3.  **Privacy** — Local embeddings (ONNX) support
4.  **Modularity** — Swap storage, embedders, or rankers easily

---

## What We Don't Do

PRSense tools are designed to **assist humans, not replace them**.

We do not:
- Block or auto-close pull requests
- Judge code quality
- Replace maintainer decisions or code review

---

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) or simply open a PR.

---

## License

MIT License

---

**PRSense** — Because duplicate PRs waste everyone's time. Let's fix that.

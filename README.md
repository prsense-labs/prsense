

# PRSense 

**The Infrastructure for Repository Memory**

> **Mission:** Transform chaotic engineering scaling into streamlined execution. We use organizational knowledge graphs and cross-repo vector search to prevent duplicate engineering work, calculate true developer expertise, and automatically triage high-risk code changes for enterprise teams.

**Not just an AI coding assistant. The memory layer for your entire engineering organization.**

[![GitHub stars](https://img.shields.io/github/stars/prsense-labs/prsense?style=social)](https://github.com/prsense-labs/prsense/stargazers)
[![npm version](https://img.shields.io/npm/v/prsense?color=blue)](https://www.npmjs.com/package/prsense)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-189%20passed-brightgreen)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Deploy to Vercel](https://img.shields.io/badge/deploy-vercel-black?logo=vercel&logoColor=white)](docs/deployment.md)
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
- **Organizational Knowledge Graph** — Maps `Author -> PR -> File` relationships to dynamically calculate "Bus Factor" and "True Expertise"
- **Cross-Repo Intelligence** — Instantly flags duplicate work across hundreds of microservices and repositories
- **Risk Triage Engine** — Automatically scores PR impact and routes high-risk changes to the right senior engineers
- **Repository Memory** — Vector-indexes every PR, issue, and decision for long-term semantic recall
- **Production Storage** — SQLite (dev) or PostgreSQL + pgvector (prod)
- **Attribution Tracking** — Preserves original authorship credit across the organization
- **Cost-Effective** — Extremely scalable architecture using Bloom filters and ONNX local embeddings

### Advanced Features
- **Persistent Storage** — Exports for SQLite/Postgres
- **Score Breakdown** — Explainable "Why" for every match
- **Batch API** — Check 100s of PRs in CI/CD pipelines
- **Embedding Cache** — Reduces API costs by 90%
- **Configurable Weights** — Tune scoring (Text vs Diff vs Files)
- **Dry-Run Mode** — specific testing without indexing
- **ONNX Local Embeddings** — 100% offline, privacy-first
- **Cross-Repo Detection** — Find duplicates across your entire org
- **Custom Rules Engine** — Programmable PR blocking and warning rules
- **Knowledge Graph** — Complete historical file and author relationship mappings
- **AI PR Descriptions** — Auto-generated descriptions based on local semantic history
- **Stale PR Detection** — Identify inactive PRs natively
- **Multi-Provider Support** — GitHub, GitLab, and Bitbucket out of the box
- **BYOK (Bring Your Own Key)** — Users supply their own OpenAI API keys
- **Webhook Alerts** — Real-time Slack/Discord notifications for duplicates
- **API Key Management** — Organization-scoped key creation and revocation

📖 **See [Features Documentation](docs/features.md) for details.**

> **v2.0.0** — The Multi-Provider Infrastructure Release. [See CHANGELOG](CHANGELOG.md) for full details.

---

## Architecture

PRSense is built on a **Repository Memory** architecture with three key layers:

### 1. Memory Layer (Storage)
- **Ingestion**: Captures PRs, issues, and decisions.
- **Storage**: Persists data in PostgreSQL (pgvector) or SQLite.
- **Embeddings**: Converts code and text into vector semantic meaning.

### 2. Recall Layer (Intelligence)
- **Semantic Search**: Natural language query interface.
- **Duplicate Detection**: The core pipeline for finding similar work.
- **Cross-Repo**: Connects memory across multiple repositories.

### 3. Operations Layer (Performance)
- **Bloom Filters**: Instant rejection of unique items.
- **Batch Processing**: Rapid historical backfilling.

#### Detection Pipeline (Recall Detail)

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
prsense-labs/
├── package.json                # Monorepo Root
├── prsense/                    # Core Library (npm package)
│   ├── src/                    # Detection Logic, Rules, Graph, Triage
│   ├── bin/                    # CLI (prsense command)
│   ├── action/                 # GitHub Action
│   └── docs/                   # API Reference & Guides
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

> [!TIP]
> **Zero setup mode**: After building, the CLI works immediately using local ONNX embeddings. No API key required.

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
import { PRSenseDetector, createPostgresStorage } from 'prsense'
import { createOpenAIEmbedder } from 'prsense'

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

// 4. Semantic Search
const searchResults = await detector.search("fix login authentication race condition")
console.log('Similar PRs:', searchResults)
```

See the [API Reference](docs/api.md) for full documentation.

---

## Features

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

Contributions welcome! Please read **[CONTRIBUTING.md](CONTRIBUTING.md)** before submitting a PR.

- 💬 **Questions?** Start a [Discussion](https://github.com/prsense-labs/prsense/discussions)
- 🐛 **Found a bug?** Open an [Issue](https://github.com/prsense-labs/prsense/issues)
- 📋 **What's new?** See the [CHANGELOG](CHANGELOG.md)

---

## License

MIT License

---

**PRSense v1.1.0** — The Repository Memory Infrastructure. Because your codebase deserves a brain.

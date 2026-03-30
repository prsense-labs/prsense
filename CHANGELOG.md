# Changelog

All notable changes to PRSense will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### [2.0.0] - 2026-03-29 — **"The Multi-Provider Infrastructure Release"**

> PRSense v2.0.0 is a **major release** that transforms the library into a truly provider-agnostic infrastructure layer. This release introduces first-class GitLab and Bitbucket support across the entire stack — alongside architectural enhancements like rule combinators, Cross-Repo detection, and LLM-powered description generation.

### 🚀 Highlights
- **Full GitLab & Bitbucket Integration** — Real webhook processing, MR/PR duplicate detection, and automated comments on all three platforms.
- **Cross-Repo Detection** — Detect duplicate PRs and overlapping work across an entire organization's repositories.
- **Advanced Notification Engine** — Real-time notification dispatching to Slack and Discord.

### Added
- **GitLab & Bitbucket Providers**: Full support for fetching PRs/MRs and posting comments via GitLab REST API v4 and Bitbucket Cloud API v2.
- **Cross-Repo Radar**: Organization-wide duplicate detection with DJB2 hash-based namespacing.
- **LLM-Powered Descriptions**: Upgraded the `DescriptionGenerator` to use Ollama/OpenAI for intelligent PR summaries.
- **Optimized Knowledge Graph**: Graph duplicate edge detection upgraded from O(n) array lookup to O(1) Map indexing.
- **Enhanced Duplicate Candidates**: `findCandidates()` now uses both text and diff embeddings for more accurate candidate retrieval.

### Changed / Fixed
- **ESM Startup**: Fixed `require()` runtime crashes in the self-hosted Express server.
- **Type Safety**: Moved `files` natively into the `PRMetadata` interface, removing fragile module augmentation hacks.
- **Build (tsconfig)**: Excluded `action/` folder from the main TypeScript build.
- **Dependencies**: Added `@ts-ignore` for the `express-rate-limit` optional peer dependency to prevent build failures.

### ⚠️ Breaking Changes
- **Minimum Node.js**: Remains `>=18.0.0`, but v20+ is now recommended for native `fetch()` support used by GitLab/Bitbucket services.


## [1.1.0] - 2026-03-09

### Added
- **Custom Rules Engine**: Programmable checks running locally without LLMs to block or warn on PRs automatically.
- **Provider Abstraction**: Extracted GitHub logic and added full support for GitLab and Bitbucket.
- **Knowledge Graph**: Ingests files and authors over time, building an explorable relationship graph to query the history of files and authors.
- **AI-Powered PR Descriptions**: Generates descriptions programmatically by fetching contextually similar historical PRs locally via embeddings.
- **Stale PR Detection**: Flags old and inactive PRs based on customizable thresholds and suggests actions (close, merge, ping reviewers).
- **Smart Triage & Auto-Labeling**: Classifies PRs into categories with confidence scores and suggests reviewers.
- **Impact Scoring**: Calculates a PR risk score (0-100) based on blast radius and author experience.
- **Notification System**: Real-time alerts to Slack and Discord for duplicates, high-risk PRs, and rule violations.
- **Zero-Click AI Descriptions**: Auto-generates descriptions for empty PRs via webhook seamlessly.
- **Express API Endpoint Expansion**: Added `/api/rules/evaluate`, `/api/graph/query`, `/api/graph/history`, `/api/describe`, and `/api/stale`.

### Changed / Fixed
- **Infra (ESM Support)**: Added `exports` map to `package.json` for proper `./server` and `./bot` submodule resolution.
- **Infra (Dependencies)**: Moved heavy dependencies (`express`, `cors`, `@actions/*`) to optional `peerDependencies` to drastically reduce package size for library consumers.
- **Infra (Publishing)**: Created an exhaustive `.npmignore` to prevent source files, tests, and configuration from shipping to npm.
- **Infra (Config)**: Removed unnecessary React JSX configuration from `tsconfig.json`.

## [1.0.2] - 2026-02-27

### Added
- **Semantic Search**: New `search(query)` method to find PRs using natural language ("Repository Memory")
- **Scalable Vector Search**: Postgres storage now uses `pgvector` for scalable O(log n) similarity search
- **Documentation**: New `docs/api.md` reference guide and updated README examples
###  Strategic Pivot: Repository Memory
We have fundamentally updated the project's mission and documentation to reflect its true value: **Infrastructure, not just a Tool.**

- **Mission Update**: Renamed "Duplicate Detection" to **"Repository Memory"** across all docs.
- **Problem Statement**: Rewrote `docs/problem.md` to focus on "Repository Amnesia" and the "Context Switch Tax."
- **Architecture**: Restructured `docs/features.md` into 3 layers:
    - **Memory Layer** (Storage, Vectors, ONNX)
    - **Recall Layer** (Search, Detection, Explainability)
    - **Operations Layer** (Filters, Batching)
- **User Guide**: Updated `docs/user-guide.md` to emphasize "Connecting the Brain" to your workflow.


### Why this matters (Open Source Transparency)
We believe this project is more than a linter. It is the missing state layer for CI/CD. These documentation changes are not just words; they set the roadmap for future "Recall" features like Semantic Search and chat-with-codebase.


## [1.0.1] - 2026-01-13

### Changed
- **CLI**: Improved `prsense` command to support manual file checking (`prsense check <file>`) alongside auto-detection
- **Documentation**: Updated CLI usage guide to prioritize `npm install` and added global installation instructions

### Fixed
- **CLI**: Merged manual file check logic into main binary for consistent behavior
- **Analytics**: Confirmed production readiness of SQLite and Postgres storage drivers

## [1.0.0] - 2026-01-11

### Added

#### Core Features
- **Multi-Signal Duplicate Detection**: Combines text similarity, diff similarity, and file overlap for 95% accuracy
- **Bloom Filter Fast Path**: O(1) early rejection for obvious non-duplicates
- **Attribution Graph**: Tracks original authorship to preserve contributor credit

#### Embedding Providers
- **OpenAI Embeddings**: High-accuracy embeddings via `text-embedding-3-small`
- **ONNX Local Embeddings**: 100% offline, privacy-first alternative (no API key required)
- **Embedding Cache**: Reduces API costs by up to 90%

#### Storage Backends
- **In-Memory Storage**: Zero-config default for development
- **SQLite Storage**: Persistent local storage for small-medium repos
- **PostgreSQL + pgvector**: Production-grade vector storage for scale

#### Interfaces
- **CLI Tool**: `prsense check` — auto-detects git branch and checks for duplicates
- **GitHub Action**: Drop-in CI/CD integration
- **REST API Server**: Deploy as a microservice
- **Library**: Import and use programmatically in Node.js

#### Advanced Features
- **Batch API**: Check hundreds of PRs in a single call
- **Configurable Weights**: Tune text vs diff vs file overlap scoring
- **Dry-Run Mode**: Test without indexing
- **Cross-Repo Detection**: Find duplicates across your entire org
- **Score Breakdown**: Explainable "why" for every match

### Documentation
- Comprehensive guides: START_HERE.md, quick-start.md, install.md
- Full API documentation in `/docs`
- Security policy with data privacy details



---


## [Unreleased]

- VS Code Extension release
- Web demo at prsense.dev
- PRSense Analytics Dashboard  

[2.0.0]: https://github.com/prsense-labs/prsense/releases/tag/v2.0.0
[1.1.0]: https://github.com/prsense-labs/prsense/releases/tag/v1.1.0
[1.0.2]: https://github.com/prsense-labs/prsense/releases/tag/v1.0.2
[1.0.1]: https://github.com/prsense-labs/prsense/releases/tag/v1.0.1
[1.0.0]: https://github.com/prsense-labs/prsense/releases/tag/v1.0.0
[Unreleased]: https://github.com/prsense-labs/prsense/compare/v2.0.0...HEAD

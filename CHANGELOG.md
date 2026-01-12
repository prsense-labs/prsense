# Changelog

All notable changes to PRSense will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/prsense-labs/prsense/releases/tag/v1.0.0
[Unreleased]: https://github.com/prsense-labs/prsense/compare/v1.0.0...HEAD

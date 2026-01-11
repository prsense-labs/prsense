# 🚀 PRSense Roadmap: The Future of Duplicate Detection

We are building the smartest, fastest, and most privacy-focused duplicate detection engine. Here is what's coming next.

## ✅ Recently Completed Features

### 🌟 Local Embeddings (Feature 7) ✅ COMPLETE
**Status**: ✅ Implemented
**Goal**: Make PRSense **100% Free & Private**.
- **No OpenAI Key Required**: Run entirely on your machine or CI runner.
- **Privacy First**: Your code never leaves your environment.
- **Zero Cost**: No API bills, ever.
- **Tech**: Powered by ONNX Runtime and quantized models (e.g., `all-MiniLM-L6-v2`).
- **Implementation**: `src/embedders/onnx.ts` with fallback support

### 🌐 Cross-Repository Detection (Feature 8) ✅ COMPLETE
**Status**: ✅ Implemented
**Goal**: Find duplicates across your entire organization.
- Detect if a feature in `frontend-repo` duplicates logic in `mobile-repo`.
- Unified vector index for all organization code.
- **Implementation**: `src/crossRepo.ts` with `CrossRepoDetector` class

### 📊 Additional Completed Features
- ✅ **Feature 1**: SQLite/Postgres storage exports
- ✅ **Feature 2**: Score breakdown/explainability (`checkDetailed` method)
- ✅ **Feature 3**: Batch check API (`checkMany` method)
- ✅ **Feature 4**: Embedding caching (LRU cache for cost savings)
- ✅ **Feature 5**: Configurable weights (`setWeights` method)
- ✅ **Feature 6**: Dry-run mode (test without indexing)

## 🔮 Future Capabilities (v1.1+)

### 1. 🧠 Temporal Modeling
**Goal**: Account for time decay in duplication.
- PRs from 2 years ago are less likely to be relevant duplicates.
- **Method**: Introduce time-decay factor `$e^{-\lambda t}$` into scoring.

### 2. 🕸️ Graph Neural Networks (GNN)
**Goal**: Model dependency relationships.
- Go beyond text/diff similarity.
- Model file import graphs to detect "structural duplicates" (different code, same dependencies).

### 3. � Active Learning
**Goal**: Learn from user feedback.
- If a user marks "Not a Duplicate", update weights automatically.
- Personalized tuning for each repository.

### 4. 📊 Analytics Dashboard
**Goal**: Visualize wasted effort.
- "You saved 40 hours of dev time this month by catching 5 duplicate PRs."
- Leaderboard of "Most Original Contributors".

---

## 🤝 Want to help?
We are looking for contributors! Check out [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

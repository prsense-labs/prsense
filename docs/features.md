# System Capabilities

PRSense is built on a layered architecture designed to give your repository a persistent memory.

## Layer 1: Memory (Storage & Ingestion)

These components are responsible for capturing and storing the "state" of your engineering history.

### 1. Persistent Memory Store (Storage)
*   **What it does**: Stores the vectorized meaning of every PR, Issue, and Decision.
*   **Tech**: Supports **PostgreSQL** (Production) with pgvector for finding semantic similarities in milliseconds, and **SQLite** (Development) for easy setup.
*   **Why it matters**: Unlike a linter that runs and dies, this memory persists forever.

### 2. Semantic Indexing (Embeddings)
*   **What it does**: Converts code changes (Diffs) and natural language (Descriptions) into mathematical vectors.
*   **Privacy First**:
    *   **OpenAI**: Best for accuracy (95%).
    *   **ONNX (Local)**: Runs 100% offline on your machine. No code ever leaves your server.
*   **Why it matters**: Enables finding "similar intent" even if the words are completely different.

### 3. Cross-Repo Awareness
*   **What it does**: Connects the memory of multiple repositories (e.g., `frontend`, `backend`, `microservices`).
*   **Why it matters**: Detects when a change in one repo contradicts or duplicates work in another.

---

## Layer 2: Recall (Intelligence & Search)

These components allow humans and agents to query the memory.

### 4. Duplicate Detection
*   **What it does**: Automatically flags incoming PRs that look like previous work.
*   **Precision**: Uses a multi-stage funnel (Bloom Filter -> Vector Search -> Reranking) to ensure <5% false positives.

### 5. Explainable "Why" (Score Breakdown)
*   **What it does**: It doesn't just say "Duplicate". It proves it.
*   **Output**: "92% Similarity: Text matches 'Fix login' (0.95), File overlap 'auth.ts' (0.80)".
*   **Why it matters**: Builds trust with engineers. Black boxes get ignored; Explainable AI gets adopted.

### 6. Semantic Search API
*   **What it does**: A natural language interface for your codebase history.
*   **Query**: "Have we ever properly fixed the race condition in the payment webhook?"
*   **Result**: "Yes, see PR #402 and PR #891."

---

## Layer 3: Operations (Performance & Integration)

### 7. The Bloom Filter Guard
*   **What it does**: A probabilistic data structure that instantly rejects (in 2ms) any unique PRs.
*   **Why it matters**: Ensures the system adds **zero latency** to 90% of your CI/CD runs.

### 8. Batch Processing
*   **What it does**: Allows backfilling history (indexing the last 5 years of PRs) in minutes.
*   **Why it matters**: Day 1 value. You don't have to wait for new data; you learn from the past immediately.

---

## Advanced Configuration

Fine-tune the system for your specific needs.

### 9. Embedding Cache
*   **What it does**: Caches embeddings to avoid re-computing identical PRs.
*   **Why it matters**: Reduces OpenAI API costs by 90% and speeds up indexing.

### 10. Configurable Weights
*   **What it does**: Tune the importance of Text vs. Code Diff vs. File Paths.
*   **Why it matters**: Customize detection behavior (e.g., "Ignore descriptions, focus only on code").

### 11. Dry-Run Mode
*   **What it does**: Simulate detection without saving to the database.
*   **Why it matters**: Safely test configuration changes in CI/CD before deploying.

---

## Layer 4: Application & Workflows (New in v1.1.0)

Built on top of the Repository Memory, v1.1.0 introduces powerful new workflows.

### 12. Knowledge Graph
*   **What it does**: Maps the relationships between Authors, Files, and PRs over time.
*   **Why it matters**: Allows you to instantly query "Who owns this file?" or "What parts of the codebase does this author usually touch?" without scraping git blames.

### 13. AI-Powered PR Descriptions (Local Context)
*   **What it does**: Auto-generates PR descriptions based on Diff heuristics and *local* embedded search of similar historical PRs.
*   **Why it matters**: Better descriptions without sending your proprietary code to a 3rd party LLM.

### 14. Custom Rules Engine
*   **What it does**: Allows defining YAML/JSON rules to block or warn on PRs (e.g. `require security team review for auth/*`).
*   **Why it matters**: Moves from "detection" to "enforcement" natively in the PR lifecycle.

### 15. Stale PR Detection
*   **What it does**: Automatically flags inactive PRs based on customizable thresholds.
*   **Why it matters**: Keeps the repository clean and ensures reviews don't slip through the cracks.

### 16. Smart Triage & Auto-Labeling
*   **What it does**: Classifies incoming PRs into categories (bug, feature, refactor, docs, etc.) with confidence scores, and suggests reviewers based on file ownership history.
*   **Why it matters**: Saves maintainers 5-10 minutes per PR on manual triage. Labels applied automatically via webhook.

### 17. Impact Scoring
*   **What it does**: Calculates a risk score (0-100) for each PR based on factors like files changed, lines modified, blast radius, and author experience.
*   **Why it matters**: Surfaces high-risk PRs that need extra review, preventing production incidents.

### 18. Multi-Provider Support
*   **What it does**: Full provider abstraction supporting **GitHub**, **GitLab**, and **Bitbucket** out of the box.
*   **Why it matters**: PRSense works wherever your team hosts code — not locked to GitHub.

### 19. Notification System
*   **What it does**: Sends real-time alerts to **Slack** and **Discord** when duplicates, high-risk PRs, or rule violations are detected.
*   **Why it matters**: Teams get notified in their existing workflow tools, not just in GitHub comments.

### 20. Zero-Click AI Descriptions
*   **What it does**: When a PR is opened with an empty description, the webhook automatically generates one using the `DescriptionGenerator` and posts it as a comment.
*   **Why it matters**: Every PR gets a meaningful description — no developer friction required.

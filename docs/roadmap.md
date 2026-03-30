# 🚀 PRSense Roadmap: The System of Record for Engineering Intelligence

PRSense started as a tool to find duplicate Pull Requests. 

With v1.1.0, it became **Repository Memory**—indexing PRs, files, and authors. 

With **v2.0.0**, it became **Multi-Provider Infrastructure**—supporting GitHub, GitLab, and Bitbucket with real-time webhook processing, BYOK, and organizational API management.

For **v3.0**, our vision is the **Self-Evolving Codebase Engine** — a repository that improves itself automatically.

---

## ✅ Shipped in v2.0.0

- ✅ **Full GitLab & Bitbucket Webhook Processing** — Real MR/PR duplicate detection across all three platforms.
- ✅ **GitLab Service & Bitbucket Service** — Dedicated API clients for fetching details, posting comments, listing projects.
- ✅ **Cross-Repo Radar** — Detect duplicates across an entire org's repositories.
- ✅ **Webhook Alerts** — Slack/Discord notifications for detected duplicates.
- ✅ **BYOK (Bring Your Own Key)** — Users supply their own OpenAI keys.
- ✅ **API Key Management** — Organization-scoped key creation, listing, and revocation.
- ✅ **Webhook Management** — CRUD endpoints for notification webhook configuration.
- ✅ **Production Auth** — Dev mode bypasses removed, production-only OAuth flow.

---

## 🔮 The v3.0 Vision: Self-Evolving Codebase Engine

### Phase 1: Code Intelligence (v2.1.0)
*   **AST Parsing**: Parse TypeScript/JavaScript code using Tree-sitter to understand structure, not just text.
*   **Code Health Score**: Dashboard page showing repository health metrics — dead code, duplicate logic blocks, circular imports, complexity hotspots.
*   **Style Learning**: Analyze naming conventions, architecture patterns, error handling to build a "Codebase Style Profile" per repository.

### Phase 2: Refactor Engine (v2.2.0)
*   **Safe Refactors**: Generate provably safe transformations — remove dead code, extract duplicated logic, flag outdated dependencies.
*   **Dry-Run Mode**: Show what the engine *would* change before opening any PRs.
*   **Auto-PRs**: Automatically open refactoring PRs on GitHub, GitLab, and Bitbucket with detailed explanations.

### Phase 3: Full Autonomy (v3.0.0)
*   **Learning Loop**: If user merges a suggested PR → boost confidence. If user closes → learn to avoid.
*   **Complex Refactors**: Rename variables, replace algorithms, restructure modules.
*   **Scheduled Scans**: Weekly, per-commit, or on-demand codebase analysis.

---

## 🧠 Beyond v3.0

### Engineering Decision Memory (EDM)
Ingest **PR Comments**, **Code Review Discussions**, and integrate with **Slack**, **Discord**, and **Linear** so PRSense can answer "Why did we choose Postgres over MySQL?" by extracting the exact comment from a closed PR discussion.

### Universal Knowledge Graph
Build an advanced recursive graph linking: `Author` → `PR` → `File` → `Function` → `Issue` → `Slack Thread` to compute **Bus Factor** and **True Expertise**.

### Cross-Platform Omnipresence
Expand ingestion to **Jira**, **Linear**, **Notion**, and chat tools. A developer types `/prsense why did this breaking change happen?` in Slack and gets a complete answer.

### Codebase RAG (Chat Interface)
Full Retrieval-Augmented Generation — embed the entire codebase alongside PR history for a natural language chat interface.

### Enterprise Privacy (Local LLMs)
Add `OllamaProvider` for `DescriptionGenerator` and `Smart Triage` — enabling 100% air-gapped AI code review for banks, healthcare, and defense.

---

## 🤝 The Future is Open
We are building this in the open because developers deserve tools that understand them.
If you want to help us build the "Second Brain" for engineering teams, check out [CONTRIBUTING.md](CONTRIBUTING.md).


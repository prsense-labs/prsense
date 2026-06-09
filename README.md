<div align="center">
  <h1>PRSense</h1>
  <p>The omniscient memory engine for your repositories. Stop redundant engineering execution.</p>

  [![npm version](https://img.shields.io/npm/v/prsense.svg?style=flat)](https://www.npmjs.com/package/prsense)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
  [![Tests](https://img.shields.io/badge/tests-202_passing-brightgreen.svg)](https://vitest.dev/)

  <a href="https://prsense.dev">Website</a> &nbsp;·&nbsp;
  <a href="https://app.prsense.dev">Dashboard</a> &nbsp;·&nbsp;
  <a href="https://prsense.dev/docs">Documentation</a>

  <br/><br/>
</div>

PRSense is an active context engine that vector-indexes your repositories. It acts as an enforcer to stop duplicate Pull Requests, instantly surface historical decisions, and prevent architectural drift across your engineering teams.

---

##  What's New in v2.2.0 — Phase 2: Refactor Engine

PRSense has evolved into a **Self-Evolving Codebase Engine**. Not only does it *detect* problems, it now *fixes* them.

- **Agentic Refactoring**: Pass two duplicate files to `prsense refactor` and the AI generates a single, clean, unified utility.
- **Auto-PR Agent**: The engine branches your repository, commits the refactored code, and opens a fully-described Pull Request using the GitHub CLI — all automatically.
- **Dynamic Versioning**: The CLI version now always matches `package.json` automatically.

### Phase 1 (v2.1.0) — Code Intelligence Engine

- **AST Parsing Engine** (`src/ast/`): Native TypeScript Compiler API integration — accurate parsing without flaky native binaries.
- **Cyclomatic Complexity Tracking**: PRSense calculates code complexity scores for all functions.
- **Code Health Score** (`src/health/`): A 0-100 metric based on duplicate blocks and cyclomatic complexity.
- **Style Learner** (`src/style/`): Uses an LLM to actively analyze the codebase and generate a `CodebaseStyleProfile` (naming conventions, error handling, etc.) enforced on future PRs.

---

##  CLI Quick Start

### 1. Install

```bash
# Install globally from npm
npm install -g prsense
```

> **Git Bash users:** If you get `prsense: command not found` after installing, the npm global bin folder isn't in your Git Bash PATH. Fix it permanently by running:
> ```bash
> echo 'export PATH="$PATH:$APPDATA/npm"' >> ~/.bashrc && source ~/.bashrc
> ```
> Then try `prsense` again.

### 2. Set up your API key (optional but recommended)

```bash
# DeepSeek (affordable & powerful — recommended)
export DEEPSEEK_API_KEY="sk-..."

# OR OpenAI
export OPENAI_API_KEY="sk-..."

# No key? PRSense uses local ONNX embeddings automatically — no cost, no internet needed.
```

### 3. Use the CLI

```bash
# Check your current branch for duplicate PRs
prsense check

# Auto-generate an AI PR description from your diff
prsense describe

# Semantic search across all indexed PRs
prsense search "fix auth bug"

# [NEW v2.2.0] Generate a unified refactor from two duplicate files
prsense refactor src/utils/helperA.ts src/utils/helperB.ts

# [NEW v2.2.0] Generate refactor AND automatically open a Pull Request
prsense refactor src/utils/helperA.ts src/utils/helperB.ts --auto-pr

# Preview refactor output without touching any files
prsense refactor src/utils/helperA.ts src/utils/helperB.ts --dry-run

# Interactive setup wizard (first-time configuration)
prsense setup

# View all available commands
prsense help
```

---

##  All CLI Commands

| Command | Description |
|---|---|
| `prsense check` | Auto-detect duplicates against current git branch |
| `prsense check <file.json>` | Check a specific PR file for duplicates |
| `prsense search "query"` | Semantic search over all indexed PRs |
| `prsense describe` | Generate an AI-powered PR description from your git diff |
| `prsense refactor <f1> <f2>` | **[New]** Generate unified refactored code from two duplicate files |
| `prsense refactor ... --auto-pr` | **[New]** Generate refactor + automatically open a GitHub PR |
| `prsense refactor ... --dry-run` | **[New]** Show generated refactor without touching files |
| `prsense stats` | Show memory statistics (PRs indexed, duplicates found) |
| `prsense setup` | Run the interactive first-time setup wizard |
| `prsense quick` | Interactive check with manual input |
| `prsense help` | Show all available commands |

---

## Running Tests

PRSense uses [Vitest](https://vitest.dev/) for all unit tests. The test suite covers the full engine pipeline  duplicate detection, AST parsing, health metrics, style learning, and the new Phase 2 refactor engine. **All 202 tests are currently passing!**

```bash
# Run the full test suite once
npm test

# Run tests in watch mode (reruns on file changes)
npm run test:watch

# Run tests with a full code coverage report
npm run test:coverage

# Open the Vitest interactive UI
npm run test:ui
```

**Test files are co-located with their source files:**

| Test File | What it covers |
|---|---|
| `src/prsense.test.ts` | Core duplicate detection engine |
| `src/prsense.enterprise.test.ts` | Enterprise-grade edge cases |
| `src/ast/parser.test.ts` | AST parsing & cyclomatic complexity |
| `src/health/metrics.test.ts` | Code health scoring (0-100) |
| `src/style/learner.test.ts` | LLM-based style profile learning |
| `src/refactor/engine.test.ts` | **[New]** Refactor Engine unit tests |
| `src/refactor/auto-pr.test.ts` | **[New]** Auto-PR agent unit tests |
| `src/impactScore.test.ts` | PR impact scoring |
| `src/triage.test.ts` | PR triage logic |
| `src/rules.test.ts` | Custom rule engine |

---

## 📚 Documentation

Full documentation is at **[prsense.dev/docs](https://prsense.dev/docs)**:

- [Quick Start Guide](https://prsense.dev/docs/quick-start)
- [Installing the GitHub Action](https://prsense.dev/docs/GITHUB_ACTION)
- [CLI Reference](https://prsense.dev/docs/cli-usage)
- [Deploying as a Microservice](https://prsense.dev/docs/deployment)
- [How our Semantic Scoring works](https://prsense.dev/docs/scoring)

---

## Roadmap

| Version | Phase | Status |
|---|---|---|
| v2.0.0 | Multi-Provider (GitHub, GitLab, Bitbucket) | ✅ Shipped |
| v2.1.0 | Code Intelligence Engine (AST, Health, Style) | ✅ Shipped |
| v2.2.0 | Refactor Engine + Auto-PR Agent | ✅ Shipped |
| v3.0.0 | Full Autonomy (Learning Loop, Scheduled Scans) |  Planned |

---

## License

MIT © [PRSense Labs](https://prsense.dev)

# The Core Problem: Repository Amnesia

## The "Memory Leak" in Modern Engineering

Every day, your team solves problems. They fix bugs, debate architecture, and reject bad approaches.
But the moment that work is merged (or closed), it is **forgotten**.

CI/CD pipelines are **stateless**. They treat every Pull Request as the first line of code ever written.
- They don't know that `auth.ts` was refactored 3 times last year.
- They don't know that this exact bug fix was tried (and reverted) 6 months ago.
- They don't know that 3 other people are writing the exact same function right now.

**We call this "Repository Amnesia."**

## The Symptoms

### 1. The Duplicate Work (The Obvious Pain)
*   **Symptom**: Contributors submit PRs for bugs/features that were already addressed.
*   **Cost**: Wasted review cycles and frustration.
*   **Why it happens**: No one has perfect recall of 5,000 closed PRs.

### 2. The "Chesterton's Fence" Violation (The Hidden Pain)
*   **Symptom**: A new hire removes a "weird check" in the code, not knowing it prevents a rare race condition discovered 2 years ago.
*   **Cost**: Production outages and regressions.
*   **Why it happens**: The *context* of the code (the "why") is buried in a closed PR from 2022.

### 3. The Context Switch Tax
*   **Symptom**: "Wait, didn't we discuss this API design already?"
*   **Cost**: Senior engineers spend hours digging through Slack/Jira to find old decisions.

## Why Current Tools Fail

| Tool | Focus | The Gap |
| :--- | :--- | :--- |
| **Linters/CI** | **Syntax** | Checks *current* code. Knows nothing of *history*. |
| **GitHub Search** | **Keywords** | Fails on "fix login" vs "auth patch" (semantic mismatch). |
| **Copilot** | **Generation** | Generates *new* code. Has no knowledge of *your* specific architectural history. |

## The Solution: A Repository Brain

PRSense is **Stateful Infrastructure**. It indexes your entire history—code, diffs, descriptions, comments—into a searchable **Memory Layer**.

Instead of asking "Does this pass the linter?", PRSense asks:
**"Has this been done before? And what did we learn?"**

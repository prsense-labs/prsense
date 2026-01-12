# START HERE - Absolute Beginner's Guide

## What is PRSense?

**PRSense = Bot that detects duplicate Pull Requests**

Think of it like:
- Gmail's spam filter, but for duplicate PRs
- Shazam for code contributions
- "You already have this" detector

---

## Why Do I Need This?

### Problem
You maintain a repo. People submit the **same bug fix 10 times**:

```
Monday:    PR #1 - "Fix login crash"
Tuesday:   PR #2 - "Resolve login issue"
Wednesday: PR #3 - "Login bug fix"
...
```

You waste **hours** reviewing duplicates.

### Solution
PRSense **automatically detects** duplicates:

```
PR #2 opened → PRSense checks → Comments:
"🔍 This is a duplicate of PR #1"

You save 30 minutes! ✨
```

---

## ⚡ Try It Now (Zero Config)

```bash
# Clone, install, and run in 60 seconds
git clone https://github.com/prsense-labs/prsense
cd prsense && npm install && npm run build

# Check for duplicates immediately — no API key needed!
npx prsense check --title "Fix login bug" --files "auth.ts"
```

> [!TIP]
> **No setup required.** PRSense auto-detects that no API key is present and uses local ONNX AI embeddings.

---

## How Do I Use It?

Choose the method that fits your workflow:

### 1. GitHub Action (Recommended for CI/CD)
✅ **Best for:** Most repositories. Runs automatically on every PR.
👉 **[Go to Setup Guide](docs/GITHUB_ACTION.md)**

### 2. VS Code Extension (Recommended for Devs)
✅ **Best for:** Checking for duplicates *while you code*, before you even push.
👉 **[Go to Extension Guide](prsense-vscode/README.md)**

### 3. CLI Tool (Manual Check)
✅ **Best for:** Running local checks or integrating into custom scripts.
👉 **[Go to CLI Guide](docs/cli-usage.md)**

### 4. GitHub Bot (Webhook Deployment)
✅ **Best for:** Org-wide deployments or when you can't use Actions.
👉 **[Go to Deployment Guide](docs/deployment.md)**

### 5. Code Library
✅ **Best for:** Building your own tools using PRSense's logic.
👉 **[Go to Library Examples](docs/library-examples.md)**
### 6. Microservice / API Server
✅ **Best for:** Microservices, Docker deployments, or non-Node environments.
👉 **[Go to Deployment Guide](docs/production-setup.md)**

---

## How Much Does It Cost?

### Small Repo (100 PRs/month)
```
OpenAI:  $0.01/month (or $0 with ONNX)
Vercel:  Free
Total:   ~FREE ✨
```

### Medium Repo (1,000 PRs/month)
```
OpenAI:  $0.10/month (or $0 with ONNX)
Vercel:  Free
Total:   ~FREE ✨
```

### Large Repo (10,000 PRs/month)
```
OpenAI:  $1/month (or $0 with ONNX)
Vercel:  $20/month
Total:   $21/month 💸 (or $20 with ONNX)
```

**vs. Hiring a maintainer**: $4,000-8,000/month

**Savings**: 99.5% 🤯

---

## Common Questions

### "Is it hard to set up?"
No! 2-5 minutes for most methods.

### "Do I need to code?"
Nope! Just copy-paste the configuration.

### "Will it work on private repos?"
Yes! Just use a GitHub token with `repo` access.

### "What if it makes mistakes?"
- 95% accuracy with real embeddings
- Maintainer always has final say
- Can adjust thresholds (make stricter/looser)

---

## Still Confused?

### Watch the Flow

```
┌─────────────┐
│  PR Opened  │  Developer submits "Fix login bug"
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  PRSense        │  Analyzes title, description, files
│  Analyzes       │  Compares to 1000s of past PRs
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Is it similar  │  Uses AI to check semantic similarity
│  to anything?   │  (not just exact text match)
└──────┬──────────┘
       │
    ┌──┴──┐
    │     │
    ▼     ▼
┌─────┐ ┌─────┐
│ YES │ │ NO  │
└──┬──┘ └──┬──┘
   │       │
   ▼       ▼
┌─────────────┐  ┌─────────────┐
│ Bot Comments│  │ PR Approved │
│ "Duplicate  │  │ ✅         │
│  of #100"   │  │             │
└─────────────┘  └─────────────┘
```

---

## Help & Support

- 📖 **Full Docs**: See [README.md](README.md)
- 💬 **Questions**: Open [GitHub Discussion](https://github.com/prsense-labs/prsense/discussions)
- 🐛 **Bug Report**: Open [GitHub Issue](https://github.com/prsense-labs/prsense/issues)

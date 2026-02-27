#  Connecting the Repository Brain

> [!TIP]
> **New here?** Start with [START_HERE.md](../START_HERE.md) for a quick overview.

PRSense is not just a CLI tool; it is a **Memory Layer**. This guide explains how to connect that memory to your existing workflows.

## 6 Ways to Connect

### 1️⃣ **GitHub Action** (Easiest)
Drop into any workflow in seconds

### 2️⃣ **GitHub Bot** (Webhook)
Deploy to Vercel for auto-comments

### 3️⃣ **CLI Tool**
Check PRs locally or in hooks

### 4️⃣ **Library**
Import into your NodeJS code

### 5️⃣ **Microservice (API)**
Run as a Docker container or Express server

### 6️⃣ **VS Code Extension**
Check duplicates while you type (see prsense-vscode)

---

## 1️⃣ **GitHub Action Usage** (Easiest)

Add this to your `.github/workflows/prsense.yml`:

```yaml
steps:
  - uses: prsense-labs/prsense@v1
    with:
      github-token: ${{ secrets.GITHUB_TOKEN }}
      embedding-provider: 'onnx' # Free & Fast!
```

---

## 2️⃣ **GitHub Bot Usage** (Webhook)

### What Users See

**When someone opens a duplicate PR:**

```
🤖 PRSense Bot commented:

## 🔍 Duplicate PR Detected

This PR appears to be a duplicate of #1234 (94% confidence).

### What this means:
- ✅ The original PR (#1234) already addresses this issue
- 🔄 Please review #1234 before proceeding

**Actions:**
- Review the original PR
- Close this PR if it's truly a duplicate
- Or explain how this PR differs

---
Powered by PRSense
```

### Setup (5 Minutes)

```bash
# 1. Install
npm install

# 2. Get API key
# https://platform.openai.com/api-keys

# 3. Deploy
npm i -g vercel
vercel

# 4. Add secrets
vercel env add OPENAI_API_KEY
vercel env add GITHUB_TOKEN
vercel env add GITHUB_WEBHOOK_SECRET

# 5. Configure webhook in GitHub
# Settings → Webhooks → Add webhook
# URL: https://your-app.vercel.app/webhook
# Events: Pull requests
```

**Done!** Bot automatically checks all new PRs.

---

## 3️⃣ **CLI Tool Usage**

### Installation

```bash
# Clone repo
git clone https://github.com/prsense-labs/prsense
cd prsense

# Install dependencies
npm install

# Build
npm run build
```

### Check a PR Before Submitting

```bash
# Create PR data file
cat > my-pr.json << 'EOF'
{
  "prId": 123,
  "title": "Fix authentication bug",
  "description": "Handle empty passwords correctly",
  "files": ["auth/login.ts", "auth/utils.ts"]
}
EOF

# Check for duplicates
npm run cli check my-pr.json
```

**Output:**
```
🔍 Checking PR #123: Fix authentication bug

📊 Result:
❌ DUPLICATE of PR #100
   Confidence: 94.2%
```

### Quick Check (No JSON needed)

```bash
npx prsense check --title "Fix login" --files "auth/login.ts"
```

### View Stats

```bash
npm run cli stats
```

**Output:**
```
📊 PRSense Statistics

Total PRs indexed: 1,247
Duplicate pairs found: 89
Bloom filter size: 8192 bits
```

---

## 4️⃣ **Library Usage** (For Developers)

### Installation

```bash
npm install express pg
# or
npm install express better-sqlite3
```

### Basic Usage

```typescript
import { PRSenseDetector } from './src/prsense.js'
import { createOpenAIEmbedder } from './src/embedders/openai.js'

// 1. Create detector
const embedder = createOpenAIEmbedder()
const detector = new PRSenseDetector({ embedder })

// 2. Check a PR
const result = await detector.check({
  prId: 123,
  title: 'Fix login bug',
  description: 'Handle empty passwords',
  files: ['auth/login.ts']
})

// 3. Handle result
if (result.type === 'DUPLICATE') {
  console.log(`Duplicate of PR #${result.originalPr}`)
  console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`)
}
```

### With Storage

```typescript
import { SQLiteStorage } from './src/storage/sqlite.js'

// Initialize storage
const storage = new SQLiteStorage('./prsense.db')
await storage.init()

// Use in your app
const detector = new PRSenseDetector({ 
  embedder,
  // storage will be integrated in next version
})
```

---

## 5️⃣ **Microservice Usage** (API)

Run PRSense as a standalone API server.

### Start Server (Express/Docker)

```typescript
import express from 'express'
import { PRSenseDetector } from './prsense.js'
import { createOpenAIEmbedder } from './embedders/openai.js'

const app = express()
app.use(express.json())

const detector = new PRSenseDetector({
  embedder: createOpenAIEmbedder()
})

app.post('/api/check-duplicate', async (req, res) => {
  const result = await detector.check({ ...req.body, prId: Date.now() })
  res.json(result)
})

app.listen(3000, () => console.log('API running on :3000'))
```

### Call API
```bash
curl -X POST http://localhost:3000/api/check-duplicate \
  -H "Content-Type: application/json" \
  -d '{ "title": "Fix bug", "files": ["auth.ts"] }'
```

---

## 6️⃣ **VS Code Extension Usage**

Detect duplicate PRs directly in your editor before you even push!

### Features
- ⚡ **Real-time Detection**: Checks as you commit
- 📊 **Sidebar View**: Browse similar PRs
- 🔔 **Alerts**: Notifications for high-confidence duplicates

### Setup
1. Install **"PRSense"** from VS Code Marketplace
2. Open Settings (`Ctrl+,`) → Search "PRSense"
3. Set `prsense.openaiApiKey` (or use ONNX default)

### Usage
- Click **PRSense** in the status bar
- Or run command: `PRSense: Check for Duplicate PRs`

---

## Real-World Examples

### Example 1: Pre-Commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-push

echo "🔍 Checking for duplicate PRs..."

# Create PR data from git
cat > /tmp/pr-check.json << EOF
{
  "prId": $(git rev-parse --short HEAD),
  "title": "$(git log -1 --pretty=%s)",
  "description": "$(git log -1 --pretty=%b)",
  "files": $(git diff --name-only origin/main | jq -R . | jq -s .)
}
EOF

# Check
prsense check /tmp/pr-check.json

if [ $? -eq 1 ]; then
  echo "⚠️  Possible duplicate detected. Continue? (y/n)"
  read answer
  if [ "$answer" != "y" ]; then
    exit 1
  fi
fi
```

### Example 2: CI/CD Integration

```yaml
# .github/workflows/check-duplicate.yml
name: Check for Duplicate PR

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  check-duplicate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install PRSense
        run: |
          git clone https://github.com/prsense-labs/prsense
          cd prsense
          npm install
          npm run build
      
      - name: Check for duplicates
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          cd prsense
          echo '{
            "prId": ${{ github.event.pull_request.number }},
            "title": "${{ github.event.pull_request.title }}",
            "description": "${{ github.event.pull_request.body }}",
            "files": ["example.ts"]
          }' > pr.json
          
          npm run cli check pr.json
```



---

## NPM Dependencies

### Required (Always Needed)

```json
{
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "@types/node": "^22.0.0"
  }
}
```

### Optional (Choose Based on Use Case)

```bash
# For SQLite storage (small projects)
npm install better-sqlite3

# For PostgreSQL storage (production)
npm install pg

# For Vercel deployment
npm install @vercel/node

# For Local Embeddings (Fast & Free)
npm install onnxruntime-node
```

### Install Everything

```bash
# Quick install all dependencies
npm install

# Or manually:
npm install express typescript @types/node
npm install better-sqlite3 pg @vercel/node
```

---

## Environment Variables Needed

```bash
# Embedding Provider
EMBEDDING_PROVIDER=openai     # 'openai' or 'onnx'

# Required (if provider is openai)
OPENAI_API_KEY=sk-...           # Get from OpenAI

# For GitHub bot
GITHUB_TOKEN=ghp_...            # Get from GitHub
GITHUB_WEBHOOK_SECRET=random123  # Make up random string

# Optional (for storage)
DATABASE_URL=postgresql://...   # PostgreSQL connection
# Or leave empty to use SQLite

# Optional (tuning)
DUPLICATE_THRESHOLD=0.90
POSSIBLE_THRESHOLD=0.82
```

**Create `.env` file:**
```bash
cp .env.example .env
nano .env  # Edit with your keys
```

---

## Quick Start Cheat Sheet

### For GitHub Bot
```bash
npm install
vercel
vercel env add OPENAI_API_KEY
# Configure webhook in GitHub
```

### For CLI
```bash
npm install
npm run build
npm run cli check pr.json
```

### For Library
```bash
npm install
npm run build
# Use in your code:
import { PRSenseDetector } from './src/prsense.js'
```

---

## Common Questions

### "Do I need OpenAI API?"
**Option 1**: Yes, for best accuracy (95%)
**Option 2**: No, use **ONNX** (free, local, private, and fast!)

### "What databases work?"
- **Development**: SQLite (no setup)
- **Production**: PostgreSQL with pgvector

### "How much does it cost?"
- **100 PRs/month**: ~$0 (free tier)
- **1,000 PRs/month**: ~$0
- **10,000 PRs/month**: ~$50

### "Can I run it locally?"
Yes! Just run: `npm run server`

### "Does it work with private repos?"
Yes, just use GitHub token with `repo` scope

---

## Troubleshooting

### "Module not found"
```bash
npm install
npm run build
```

### "OpenAI API error"
```bash
# Check key is valid
echo $OPENAI_API_KEY

# Check you have credits
# https://platform.openai.com/account/billing
```

### "Database error"
```bash
# Use SQLite (no setup needed)
# Just leave DATABASE_URL empty

# Or install PostgreSQL
npm install pg
```

---

## What's Next?

After setup:
1. ✅ Open a test PR → See bot comment
2. ✅ Check webhook deliveries in GitHub
3. ✅ Adjust thresholds if needed
4. ✅ Monitor for a week
5. ✅ Measure time saved

**Need help?** See [production-setup.md](production-setup.md)

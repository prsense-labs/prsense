# 📦 Installation Guide

## Quick Install

```bash
# 1. Clone
git clone https://github.com/prsense-labs/prsense
cd prsense

# 2. Install dependencies
npm install

# 3. Build
npm run build

# 4. Configure
cp .env.example .env
# Edit .env with your API keys

# 5. Run
npm run server
```

---

## ⚡ Zero Config Mode (Fastest Start)

> [!TIP]
> **No API key? No problem!** PRSense works immediately using local ONNX embeddings.

```bash
# 1. Clone & install
git clone https://github.com/prsense-labs/prsense
cd prsense
npm install
npm run build

# 2. Run immediately — no API key needed!
npx prsense check --title "Fix login bug" --files "auth.ts"
```

**Output:**
```
📦 Using ONNX local embeddings (no API key found)
🔍 Checking PR...
✅ UNIQUE (Confidence: 0.000)
```

This uses:
- **SQLite** (auto-created, no setup)
- **ONNX embeddings** (runs 100% locally, privacy-first)

**Want higher accuracy?** Add an OpenAI key (see below). **Need scale?** Use PostgreSQL (see [production-setup.md](production-setup.md)).

---

## Detailed Installation

### Prerequisites

- **Node.js**: v18+ (v20 recommended)
- **npm**: v9+
- **Git**: For cloning

**Check versions:**
```bash
node --version   # Should be v18+
npm --version    # Should be v9+
```

---

## Step 1: Get the Code

### Option A: Clone from GitHub
```bash
git clone https://github.com/prsense-labs/prsense
cd prsense
```

### Option B: Download ZIP
```bash
# Download from: https://github.com/prsense-labs/prsense/archive/main.zip
unzip prsense-main.zip
cd prsense-main
```

---

## Step 2: Install Dependencies

### Basic (Minimum)
```bash
npm install
```

This installs:
- TypeScript
- Express
- Type definitions

### With Database Support
```bash
# For SQLite (development)
npm install better-sqlite3

# For PostgreSQL (production)
npm install pg
```

### For Vercel Deployment
```bash
npm install @vercel/node
```

### For Local Embeddings (ONNX)
```bash
npm install onnxruntime-node
```

### Install Everything
```bash
npm install
npm install better-sqlite3 pg @vercel/node
```

---

## Step 3: Build TypeScript

```bash
npm run build
```

**Output:**
```
> prsense@1.0.0 build
> tsc

# Creates dist/ folder with compiled JS
```

**Verify build:**
```bash
ls dist/
# Should see: src/ bin/ examples/ api/
```

---

## Step 4: Configure Environment

### Create `.env` file
```bash
cp .env.example .env
```

### Edit with your keys
```bash
nano .env
# or
code .env
# or
notepad .env
```

### Minimum required:
```bash
# .env
OPENAI_API_KEY=sk-your-key-here
```

### Full production config:
```bash
# .env

# Embedding Provider (openai or onnx)
EMBEDDING_PROVIDER=openai

# OpenAI (required if provider is openai)
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=text-embedding-3-small

# ONNX (optional - defaults used if not set)
# ONNX_MODEL_PATH=./models/all-MiniLM-L6-v2.onnx

# Database (optional - uses SQLite if not set)
DATABASE_URL=postgresql://user:pass@localhost:5432/prsense

# GitHub (for bot)
GITHUB_TOKEN=ghp_your-token
GITHUB_WEBHOOK_SECRET=random-secret-123

# Thresholds (optional)
DUPLICATE_THRESHOLD=0.90
POSSIBLE_THRESHOLD=0.82

# Server (optional)
PORT=3000
NODE_ENV=production
```

---

## Step 5: Get API Keys

### OpenAI API Key (Optional - for higher accuracy)

> [!NOTE]
> This is **optional**. Without an API key, PRSense uses local ONNX embeddings automatically.

1. Go to: https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy key (starts with `sk-...`)
4. Add to `.env`:
   ```bash
   OPENAI_API_KEY=sk-proj-...
   ```

**Cost**: ~$0.0001 per PR (very cheap)

### GitHub Token (For Bot)

1. Go to: https://github.com/settings/tokens
2. Generate new token (classic)
3. Select scopes:
   - ✅ `repo` (full control)
   - ✅ `write:discussion`
4. Copy token (starts with `ghp_...`)
5. Add to `.env`:
   ```bash
   GITHUB_TOKEN=ghp_...
   ```

---

## Step 6: Test Installation

### Test basic functionality
```bash
npm run demo
```

**Expected output:**
```
🔍 PRSense Demo

Submitting PR #1...
Result: { type: 'UNIQUE', confidence: 0 }

📊 Statistics:
{ totalPRs: 3, bloomFilterSize: 8192, duplicatePairs: 0 }
```

### Test CLI
```bash
npm run cli help
```

**Expected output:**
```
PRSense - Duplicate PR Detection

USAGE:
  prsense <command> [options]

COMMANDS:
  check <file>    Check if a PR is a duplicate
  stats           Show detector statistics
```

### Test server (optional)
```bash
npm run server
```

**Expected output:**
```
🚀 PRSense server running on port 3000
📝 Webhook URL: http://localhost:3000/webhook
❤️  Health check: http://localhost:3000/health
```

Test health:
```bash
curl http://localhost:3000/health
# {"status":"healthy","timestamp":1234567890}
```

---

## Verification Checklist

✅ **Node.js installed** (v18+)  
✅ **Dependencies installed** (`npm install` succeeded)  
✅ **TypeScript built** (`dist/` folder exists)  
✅ **`.env` configured** (OPENAI_API_KEY set)  
✅ **Demo runs** (`npm run demo` works)  

**If all ✅, you're ready!**

---

## Next Steps

### For GitHub Bot
→ See [deployment.md](deployment.md)

### For CLI Usage
→ See [cli-usage.md](cli-usage.md)

### For Library Integration
→ See [quick-start.md](quick-start.md)

---

## Troubleshooting

### "Cannot find module"
```bash
# Rebuild
npm run rebuild
```

### "Permission denied"
```bash
# On Unix/Mac
chmod +x node_modules/.bin/*

# Or use npm scripts instead of direct commands
npm run build  # Instead of: tsc
```

### "TypeScript errors"
```bash
# Update TypeScript
npm install typescript@latest

# Check tsconfig.json is present
ls tsconfig.json
```

### "OPENAI_API_KEY not set"
```bash
# Check .env exists
ls .env

# Check it's loaded
node -e "require('dotenv').config(); console.log(process.env.OPENAI_API_KEY)"
```

---

## Uninstall

```bash
# Remove all
cd ..
rm -rf prsense

# Or keep code, remove deps
cd prsense
rm -rf node_modules dist
```

---

## Alternative: Docker Install

```bash
# 1. Clone
git clone https://github.com/prsense-labs/prsense
cd prsense

# 2. Configure
cp .env.example .env
nano .env

# 3. Build & run
docker-compose up -d

# 4. Check health
curl http://localhost:3000/health
```

**No npm needed!** Docker handles everything.

---

## Platform-Specific Notes

### Windows
```cmd
# Use Git Bash or PowerShell
npm install
npm run build
npm run demo
```

### macOS
```bash
# May need to install build tools
xcode-select --install

# Then install
npm install
```

### Linux
```bash
# Install build essentials (for better-sqlite3)
sudo apt-get install build-essential python3

# Then install
npm install
```

---

## Getting Help

**Installation issues?**
1. Check [Troubleshooting](#troubleshooting) above
2. Read [docs/cli-usage.md](docs/cli-usage.md)
3. Open issue: https://github.com/prsense-labs/prsense/issues

**Ready to use?**
→ See [docs/cli-usage.md](docs/cli-usage.md) for usage examples


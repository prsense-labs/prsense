# 💻 PRSense Library - Code Examples

## Basic Usage

```typescript
import { PRSenseDetector } from './prsense.js'
import { createOpenAIEmbedder } from './embedders/openai.js'

// Create detector
const detector = new PRSenseDetector({
  embedder: createOpenAIEmbedder()
})

// Check a PR
const result = await detector.check({
  prId: 123,
  title: "Fix login bug",
  description: "Handle empty passwords",
  files: ["auth/login.ts"]
})

// Use result
if (result.type === 'DUPLICATE') {
  console.log(`Duplicate of #${result.originalPr}`)
}
```

```

---

## 🚀 Real-World Examples

### Example 1: Express API

```typescript
import express from 'express'
import { PRSenseDetector } from './prsense.js'
import { createOpenAIEmbedder } from './embedders/openai.js'

const app = express()
app.use(express.json())

// Create detector once
const detector = new PRSenseDetector({
  embedder: createOpenAIEmbedder()
})

// API endpoint
app.post('/api/check-duplicate', async (req, res) => {
  const { title, description, files } = req.body
  
  const result = await detector.check({
    prId: Date.now(),
    title,
    description,
    files
  })
  
  res.json({
    isDuplicate: result.type === 'DUPLICATE',
    originalPr: result.type !== 'UNIQUE' ? result.originalPr : null,
    confidence: result.confidence
  })
})

app.listen(3000, () => {
  console.log('API running on :3000')
})
```

**Usage:**
```bash
curl -X POST http://localhost:3000/api/check-duplicate \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix bug",
    "description": "Details",
    "files": ["file.ts"]
  }'
```

---

### Example 1+: Explainability (New!)

```typescript
const result = await detector.checkDetailed({
  prId: 123,
  title: "Fix login",
  description: "...",
  files: ["auth.ts"]
})

if (result.type === 'DUPLICATE') {
  console.log('Why is this a duplicate?')
  console.log(`Text match: ${result.breakdown.textSimilarity}`) // e.g. 0.95
  console.log(`Diff match: ${result.breakdown.diffSimilarity}`) // e.g. 0.88
  console.log(`File match: ${result.breakdown.fileSimilarity}`) // e.g. 0.20
}
```

---

### Example 2: GitHub Action

```typescript
import { PRSenseDetector } from './prsense.js'
import { createOpenAIEmbedder } from './embedders/openai.js'
import { Octokit } from '@octokit/rest'

const detector = new PRSenseDetector({
  embedder: createOpenAIEmbedder()
})

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

// Get PR info from GitHub Actions
const pr = {
  prId: parseInt(process.env.PR_NUMBER!),
  title: process.env.PR_TITLE!,
  description: process.env.PR_BODY!,
  files: [] // Fetch from GitHub API
}

// Check
const result = await detector.check(pr)

// Comment on PR if duplicate
if (result.type === 'DUPLICATE') {
  await octokit.issues.createComment({
    owner: 'your-org',
    repo: 'your-repo',
    issue_number: pr.prId,
    body: `🔍 This PR appears to be a duplicate of #${result.originalPr}`
  })
}
```

---

### Example 3: Slack Bot

```typescript
import { App } from '@slack/bolt'
import { PRSenseDetector } from './prsense.js'
import { createOpenAIEmbedder } from './embedders/openai.js'

const detector = new PRSenseDetector({
  embedder: createOpenAIEmbedder()
})

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
})

// Slash command: /check-pr Fix login bug
app.command('/check-pr', async ({ command, ack, respond }) => {
  await ack()
  
  const result = await detector.check({
    prId: Date.now(),
    title: command.text,
    description: '',
    files: []
  })
  
  if (result.type === 'DUPLICATE') {
    await respond({
      text: `⚠️ Possible duplicate of PR #${result.originalPr} (${(result.confidence * 100).toFixed(1)}% confidence)`
    })
  } else {
    await respond({
      text: `✅ No duplicates found! Safe to submit.`
    })
  }
})

app.start(3000)
```

---

### Example 4: VS Code Extension

```typescript
import * as vscode from 'vscode'
import { PRSenseDetector } from './prsense.js'
import { createOpenAIEmbedder } from './embedders/openai.js'

const detector = new PRSenseDetector({
  embedder: createOpenAIEmbedder()
})

export function activate(context: vscode.ExtensionContext) {
  
  const command = vscode.commands.registerCommand('prsense.check', async () => {
    // Get git info
    const git = vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)
    const repo = git.repositories[0]
    const head = repo.state.HEAD
    
    // Check
    const result = await detector.check({
      prId: Date.now(),
      title: head?.commit || 'Current changes',
      description: '',
      files: repo.state.workingTreeChanges.map((c: any) => c.uri.path)
    })
    
    // Show result
    if (result.type === 'DUPLICATE') {
      vscode.window.showWarningMessage(
        `Duplicate of PR #${result.originalPr}`,
        'View Original'
      )
    } else {
      vscode.window.showInformationMessage('✅ No duplicates found!')
    }
  })
  
  context.subscriptions.push(command)
}
```

---

### Example 5: Discord Bot

```typescript
import { Client, GatewayIntentBits } from 'discord.js'
import { PRSenseDetector } from './prsense.js'
import { createOpenAIEmbedder } from './embedders/openai.js'

const detector = new PRSenseDetector({
  embedder: createOpenAIEmbedder()
})

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
})

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('!checkpr')) return
  
  const title = message.content.replace('!checkpr', '').trim()
  
  const result = await detector.check({
    prId: Date.now(),
    title,
    description: '',
    files: []
  })
  
  if (result.type === 'DUPLICATE') {
    await message.reply(`⚠️ Possible duplicate of PR #${result.originalPr}`)
  } else {
    await message.reply(`✅ No duplicates found!`)
  }
})

client.login(process.env.DISCORD_TOKEN)
```

---

### Example 6: Pre-Commit Hook

```typescript
#!/usr/bin/env node
import { execSync } from 'child_process'
import { PRSenseDetector } from './prsense.js'
import { createOpenAIEmbedder } from './embedders/openai.js'

const detector = new PRSenseDetector({
  embedder: createOpenAIEmbedder()
})

// Get git info
const title = execSync('git log -1 --pretty=%s', { encoding: 'utf-8' }).trim()
const files = execSync('git diff --name-only HEAD~1', { encoding: 'utf-8' })
  .trim().split('\n')

// Check
const result = await detector.check({
  prId: Date.now(),
  title,
  description: '',
  files
})

if (result.type === 'DUPLICATE') {
  console.error(`❌ Duplicate of PR #${result.originalPr}`)
  console.log('Override? Type "yes" to continue:')
  
  // Wait for input
  const stdin = process.stdin
  stdin.setRawMode(true)
  stdin.resume()
  
  // Check user input
  // If not "yes", exit 1
}

console.log('✅ No duplicates. Proceeding with commit.')
```

---

### Example 7: Next.js API Route

```typescript
// pages/api/check-duplicate.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { PRSenseDetector } from '@/lib/prsense.js'
import { createOpenAIEmbedder } from '@/lib/embedders/openai.js'

const detector = new PRSenseDetector({
  embedder: createOpenAIEmbedder()
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const { title, description, files } = req.body
  
  const result = await detector.check({
    prId: Date.now(),
    title,
    description,
    files
  })
  
  res.status(200).json({
    duplicate: result.type === 'DUPLICATE',
    originalPr: result.type !== 'UNIQUE' ? result.originalPr : null,
    confidence: result.confidence
  })
}
```

---

### Example 8: Custom CLI Tool

```typescript
#!/usr/bin/env node
import { PRSenseDetector } from './prsense.js'
import { createOpenAIEmbedder } from './embedders/openai.js'
import { program } from 'commander'

const detector = new PRSenseDetector({
  embedder: createOpenAIEmbedder()
})

program
  .name('myapp-pr-check')
  .description('Check if PR is duplicate')
  .argument('<title>', 'PR title')
  .option('-d, --description <desc>', 'PR description')
  .option('-f, --files <files>', 'Changed files (comma-separated)')
  .action(async (title, options) => {
    const result = await detector.check({
      prId: Date.now(),
      title,
      description: options.description || '',
      files: options.files ? options.files.split(',') : []
    })
    
    if (result.type === 'DUPLICATE') {
      console.log(`❌ Duplicate of #${result.originalPr}`)
      process.exit(1)
    } else {
      console.log(`✅ Unique`)
      process.exit(0)
    }
  })

program.parse()
```

**Usage:**
```bash
myapp-pr-check "Fix bug" --files "auth.ts,login.ts"
```

---

### Example 9: React Hook

```typescript
// useCheckDuplicate.ts
import { useState } from 'react'
import { PRSenseDetector } from './prsense.js'
import { createOpenAIEmbedder } from './embedders/openai.js'

const detector = new PRSenseDetector({
  embedder: createOpenAIEmbedder()
})

export function useCheckDuplicate() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  
  const check = async (title: string, description: string, files: string[]) => {
    setLoading(true)
    try {
      const res = await detector.check({
        prId: Date.now(),
        title,
        description,
        files
      })
      setResult(res)
    } finally {
      setLoading(false)
    }
  }
  
  return { check, loading, result }
}

// Component usage:
function PRForm() {
  const { check, loading, result } = useCheckDuplicate()
  
  const handleSubmit = async (e: any) => {
    e.preventDefault()
    await check(title, description, files)
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      {result?.type === 'DUPLICATE' && (
        <div className="alert">
          ⚠️ Duplicate of PR #{result.originalPr}
        </div>
      )}
    </form>
  )
}
```

---

### Example 10: Batch Processing

```typescript
import { PRSenseDetector } from './prsense.js'
import { createOpenAIEmbedder } from './embedders/openai.js'
import fs from 'fs'

const detector = new PRSenseDetector({
  embedder: createOpenAIEmbedder()
})

// Load PRs from JSON file
const prs = JSON.parse(fs.readFileSync('prs.json', 'utf-8'))

// Use optimized batch processing
const results = await detector.checkMany(prs)

// Find duplicates
const duplicates = results.filter(r => r.result.type === 'DUPLICATE')

console.log(`Found ${duplicates.length} duplicates out of ${prs.length} PRs`)
console.log(`Total processing time: ${results.reduce((acc, r) => acc + r.processingTimeMs, 0)}ms`)
```

---

## 🎨 Advanced Usage

### Custom Thresholds

```typescript
const detector = new PRSenseDetector({
  embedder: createOpenAIEmbedder(),
  duplicateThreshold: 0.95,  // Stricter
  possibleThreshold: 0.85
})
```

### Custom Weights

```typescript
const detector = new PRSenseDetector({
  embedder: createOpenAIEmbedder(),
  weights: [0.50, 0.30, 0.20]  // More weight on text
})
```

### With Storage

```typescript
import { SQLiteStorage } from './storage/sqlite.js'
import { createPostgresStorage } from './storage/postgres.js'

// Option A: SQLite (Simpler)
const storage = new SQLiteStorage('./prsense.db')
await storage.init()

// Option B: Postgres (Production)
// const storage = createPostgresStorage()
// await storage.init()

const detector = new PRSenseDetector({
  embedder: createOpenAIEmbedder(),
  storage // Persistence enabled!
})
```

### Local Embeddings (Free!)

```typescript
import { createONNXEmbedder } from './embedders/onnx.js'

const detector = new PRSenseDetector({
  // Runs 100% locally with ONNX Runtime
  embedder: createONNXEmbedder()
})
```

---

## 🔥 Why The Library API Is So Good

### ✅ Simple Import
```typescript
import { PRSenseDetector } from './prsense.js'
```
One line. Clean.

### ✅ Single Method
```typescript
const result = await detector.check(pr)
```
One method. Simple.

### ✅ Clear Results
```typescript
if (result.type === 'DUPLICATE') {
  // Handle duplicate
}
```
Easy to understand.

### ✅ TypeScript Support
Full type safety with IntelliSense!

### ✅ Pluggable Backends
Swap embedders, storage, etc. without changing code.

---

## 📖 Full API Reference

### `PRSenseDetector`

```typescript
class PRSenseDetector {
  constructor(config: {
    embedder: Embedder
    duplicateThreshold?: number  // Default: 0.90
    possibleThreshold?: number   // Default: 0.82
    weights?: [number, number, number]  // Default: [0.45, 0.35, 0.20]
    maxCandidates?: number       // Default: 20
  })
  
  async check(pr: {
    prId: number
    title: string
    description: string
    files: string[]
    diff?: string
  }): Promise<DetectionResult>
  
  getDuplicates(prId: number): number[]
  getOriginal(prId: number): number
  getStats(): { totalPRs, duplicatePairs, bloomFilterSize }
}
```

### `DetectionResult`

```typescript
type DetectionResult = 
  | { type: 'DUPLICATE', originalPr: number, confidence: number }
  | { type: 'POSSIBLE', originalPr: number, confidence: number }
  | { type: 'UNIQUE', confidence: number }
```

---

## 🚀 Quick Start

```bash
npm install
```

```typescript
import { PRSenseDetector } from './prsense.js'
import { createOpenAIEmbedder } from './embedders/openai.js'

const detector = new PRSenseDetector({
  embedder: createOpenAIEmbedder()
})

const result = await detector.check({
  prId: 123,
  title: "Your PR title",
  description: "Description",
  files: ["file1.ts", "file2.ts"]
})

console.log(result)
```

**That's it!** 🎉

---

## 💡 Tips

### Reuse Detector Instance
```typescript
// Create once
const detector = new PRSenseDetector({ embedder })

// Use many times
await detector.check(pr1)
await detector.check(pr2)
await detector.check(pr3)
```

### Handle Errors
```typescript
try {
  const result = await detector.check(pr)
} catch (error) {
  console.error('Detection failed:', error)
}
```

### Batch Operations
```typescript
const results = await detector.checkMany(prs)
```

---

## 📚 More Examples

See:
- `examples/simple-usage.ts` - Basic example
- `examples/github-bot.ts` - GitHub integration
- `src/prsense.ts` - Full implementation

---

**Conclusion**

The API is designed to be simple, clean, and powerful.

1. Import
2. Create detector
3. Call `check()`
4. Use result

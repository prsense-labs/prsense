#!/usr/bin/env node
/**
 * PRSense CLI - Repository Memory Infrastructure v1.0.2
 *
 * Usage:
 *   prsense check <pr-file.json> [--dry-run] [--detailed]
 *   prsense search "query" [--limit=10]
 *   prsense stats
 *   prsense help
 */

import { PRSenseDetector } from '../src/prsense.js'
import type { Embedder } from '../src/embeddingPipeline.js'
import { createOpenAIEmbedder } from '../src/embedders/openai.js'
import { createONNXEmbedder } from '../src/embedders/onnx.js'
import { readFileSync, existsSync } from 'fs'

// ─── Parse CLI flags ─────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const dryRunFlag = args.includes('--dry-run')
const detailedFlag = args.includes('--detailed')
const limitArg = args.find(a => a.startsWith('--limit='))
const limitVal = limitArg ? (() => {
  const parts = limitArg.split('=')
  const value = parts[1]
  return value !== undefined ? parseInt(value, 10) : 10
})() : 10
const filteredArgs = args.filter(arg => !arg.startsWith('--'))

// ─── Colors ──────────────────────────────────────────────────────────────────

const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
}

// ─── Mock embedder (dry-run only) ────────────────────────────────────────────

const dummyEmbedder: Embedder = {
    embedText: async (text: string) => {
        const vec = new Float32Array(384)
        for (let i = 0; i < text.length && i < 384; i++) vec[i] = text.charCodeAt(i) / 255
        return vec
    },
    embedDiff: async (diff: string) => {
        const vec = new Float32Array(384)
        for (let i = 0; i < diff.length && i < 384; i++) vec[i] = diff.charCodeAt(i) / 255
        return vec
    }
}

// ─── Embedder selection ───────────────────────────────────────────────────────

function createEmbedder(): Embedder {
    if (dryRunFlag) {
        console.log(`${c.dim}🧪 Dry-run mode: using mock embedder (no API calls)${c.reset}`)
        return dummyEmbedder
    }
    const apiKey = process.env.OPENAI_API_KEY
    if (apiKey && apiKey.startsWith('sk-')) {
        console.log(`${c.dim}🔑 Using OpenAI embeddings (text-embedding-3-small)${c.reset}`)
        return createOpenAIEmbedder()
    }
    console.log(`${c.dim}📦 Using ONNX local embeddings — set OPENAI_API_KEY for higher accuracy${c.reset}`)
    return createONNXEmbedder()
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bar(score: number): string {
    const filled = Math.round(Math.max(0, Math.min(1, score)) * 10)
    return `${c.green}${'█'.repeat(filled)}${c.dim}${'░'.repeat(10 - filled)}${c.reset}`
}

function pct(n: number): string {
    return (n * 100).toFixed(1) + '%'
}

function printResult(result: any) {
    if (result.type === 'DUPLICATE') {
        console.log(`  ${c.red}${c.bold}❌ DUPLICATE${c.reset} of PR #${result.originalPr}`)
        console.log(`  Confidence: ${c.red}${pct(result.confidence)}${c.reset}`)
        process.exitCode = 1
    } else if (result.type === 'POSSIBLE') {
        console.log(`  ${c.yellow}${c.bold}⚠️  POSSIBLY SIMILAR${c.reset} to PR #${result.originalPr}`)
        console.log(`  Confidence: ${c.yellow}${pct(result.confidence)}${c.reset}`)
    } else {
        console.log(`  ${c.green}${c.bold}✅ UNIQUE${c.reset} — No duplicates found`)
        console.log(`  Confidence: ${c.dim}${pct(result.confidence)}${c.reset}`)
    }
    console.log('')
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function checkCommand(detector: PRSenseDetector, filePath?: string) {
    if (!filePath) {
        console.error(`${c.red}Error: Please provide a JSON file with PR data${c.reset}`)
        console.log('Usage: prsense check <pr-file.json> [--dry-run] [--detailed]')
        process.exit(1)
    }

    if (!existsSync(filePath)) {
        console.error(`${c.red}Error: File not found: ${filePath}${c.reset}`)
        process.exit(1)
    }

    let prData: any
    try {
        prData = JSON.parse(readFileSync(filePath, 'utf-8'))
    } catch {
        console.error(`${c.red}Error: Invalid JSON in ${filePath}${c.reset}`)
        process.exit(1)
    }

    console.log(`\n${c.bold}🔍 Checking PR #${prData.prId}: ${prData.title}${c.reset}`)
    if (prData.files?.length) {
        const shown = prData.files.slice(0, 5).join(', ')
        const more = prData.files.length > 5 ? ` +${prData.files.length - 5} more` : ''
        console.log(`${c.dim}   Files: ${shown}${more}${c.reset}`)
    }

    if (detailedFlag) {
        const result = await detector.checkDetailed(prData, { dryRun: dryRunFlag })
        console.log('\n📊 Detailed Result:')
        printResult(result)

        if (result.breakdown) {
            const b = result.breakdown
            console.log(`${c.bold}Score Breakdown:${c.reset}`)
            console.log(`  Text similarity:  ${bar(b.textSimilarity)} ${pct(b.textSimilarity)}  (weight ${pct(b.weights[0])}) → ${pct(b.textContribution)}`)
            console.log(`  Diff similarity:  ${bar(b.diffSimilarity)} ${pct(b.diffSimilarity)}  (weight ${pct(b.weights[1])}) → ${pct(b.diffContribution)}`)
            console.log(`  File similarity:  ${bar(b.fileSimilarity)} ${pct(b.fileSimilarity)}  (weight ${pct(b.weights[2])}) → ${pct(b.fileContribution)}`)
            console.log(`  ${c.bold}Final score:      ${bar(b.finalScore)} ${pct(b.finalScore)}${c.reset}`)
            console.log('')
        }
    } else {
        const result = await detector.check(prData, { dryRun: dryRunFlag })
        console.log('\n📊 Result:')
        printResult(result)
    }
}

async function searchCommand(detector: PRSenseDetector, query?: string) {
    if (!query) {
        console.error(`${c.red}Error: Please provide a search query${c.reset}`)
        console.log('Usage: prsense search "your query" [--limit=10]')
        process.exit(1)
    }

    console.log(`\n${c.bold}🔍 Searching:${c.reset} "${query}" ${c.dim}(limit: ${limitVal})${c.reset}\n`)

    const results = await detector.search(query, limitVal)

    if (results.length === 0) {
        console.log(`${c.yellow}No matching PRs found. Index some PRs first with: prsense check <file.json>${c.reset}\n`)
        process.exit(0)
    }

    console.log(`${c.bold}Found ${results.length} result${results.length > 1 ? 's' : ''}:${c.reset}\n`)

    results.forEach((r, i) => {
        console.log(`${c.bold}${i + 1}. PR #${r.prId}${c.reset} — ${r.title}`)
        console.log(`   ${bar(r.score)} ${pct(r.score)} similarity`)
        if (r.description) {
            const desc = r.description.length > 100 ? r.description.slice(0, 97) + '...' : r.description
            console.log(`   ${c.dim}${desc}${c.reset}`)
        }
        if (r.files?.length) {
            const shown = r.files.slice(0, 3).join(', ')
            const more = r.files.length > 3 ? ` +${r.files.length - 3} more` : ''
            console.log(`   📂 ${shown}${more}`)
        }
        console.log('')
    })
}

async function statsCommand(detector: PRSenseDetector) {
    const stats = detector.getStats()
    console.log(`\n${c.bold}📊 PRSense v1.0.2 — Repository Memory Statistics${c.reset}\n`)
    console.log(`  Total PRs indexed:     ${c.cyan}${stats.totalPRs}${c.reset}`)
    console.log(`  Duplicate pairs found: ${c.cyan}${stats.duplicatePairs}${c.reset}`)
    console.log(`  Bloom filter size:     ${c.dim}${stats.bloomFilterSize} bits${c.reset}`)
    console.log(`  Storage backend:       ${c.dim}${stats.storage ?? 'in-memory'}${c.reset}\n`)
}

function printHelp() {
    console.log(`
${c.bold}${c.cyan}PRSense v1.0.2 — Repository Memory Infrastructure${c.reset}

${c.bold}USAGE:${c.reset}
  prsense <command> [options]

${c.bold}COMMANDS:${c.reset}
  ${c.green}check${c.reset} <file.json>   Check if a PR is a duplicate
  ${c.green}search${c.reset} "query"      Semantic search over indexed PRs
  ${c.green}stats${c.reset}               Show memory statistics
  ${c.green}help${c.reset}                Show this help

${c.bold}OPTIONS:${c.reset}
  --dry-run           Use mock embedder (no API calls, for CI/testing)
  --detailed          Show full score breakdown (text / diff / file weights)
  --limit=N           Max results for search (default: 10)

${c.bold}EMBEDDER SELECTION:${c.reset}
  OPENAI_API_KEY set  → OpenAI text-embedding-3-small (recommended)
  No API key          → ONNX local embeddings (offline, no cost)
  --dry-run           → Mock embedder (for testing)

${c.bold}EXAMPLES:${c.reset}
  prsense check pr.json                   # Check for duplicates
  prsense check pr.json --detailed        # With score breakdown
  prsense check pr.json --dry-run         # No API calls
  prsense search "fix auth bug"           # Semantic search
  prsense search "database migration" --limit=5
  prsense stats

${c.bold}PR FILE FORMAT (JSON):${c.reset}
  {
    "prId": 123,
    "title": "Fix login bug",
    "description": "Handle empty passwords in auth flow",
    "files": ["src/auth/login.ts", "src/auth/session.ts"],
    "diff": "optional unified diff content"
  }

${c.bold}DOCS:${c.reset}  https://github.com/prsense-labs/prsense
`.trim())
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const command = filteredArgs[0]

    if (!command || command === 'help' || command === '--help' || command === '-h') {
        printHelp()
        process.exit(command ? 0 : 1)
    }

    const embedder = createEmbedder()
    const detector = new PRSenseDetector({ embedder })
    // v1.0.2: must await init() to load persisted state from storage
    await detector.init()

    switch (command) {
        case 'check':
            await checkCommand(detector, filteredArgs[1])
            break
        case 'search':
            await searchCommand(detector, filteredArgs[1])
            break
        case 'stats':
            await statsCommand(detector)
            break
        default:
            console.error(`${c.red}Unknown command: ${command}${c.reset}`)
            printHelp()
            process.exit(1)
    }
}

main().catch((error) => {
    console.error(`\n${c.red}Error: ${error instanceof Error ? error.message : String(error)}${c.reset}`)
    console.log(`${c.dim}Run: prsense help${c.reset}\n`)
    process.exit(1)
})

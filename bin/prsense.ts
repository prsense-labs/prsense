#!/usr/bin/env node
/**
 * PRSense CLI tool
 * 
 * Usage:
 *   prsense check <pr-file.json> [--dry-run]
 *   prsense stats
 */

import { PRSenseDetector } from '../src/prsense.js'
import type { Embedder } from '../src/embeddingPipeline.js'
import { createOpenAIEmbedder } from '../src/embedders/openai.js'
import { createONNXEmbedder } from '../src/embedders/onnx.js'
import { readFileSync, existsSync } from 'fs'

// Parse CLI flags
const args = process.argv.slice(2)
const dryRunFlag = args.includes('--dry-run')
const filteredArgs = args.filter(arg => arg !== '--dry-run')

// Dummy embedder for dry-run mode only
const dummyEmbedder: Embedder = {
    embedText: async (text: string) => {
        const vec = new Float32Array(384)
        for (let i = 0; i < text.length && i < 384; i++) {
            vec[i] = text.charCodeAt(i) / 255
        }
        return vec
    },
    embedDiff: async (diff: string) => {
        const vec = new Float32Array(384)
        for (let i = 0; i < diff.length && i < 384; i++) {
            vec[i] = diff.charCodeAt(i) / 255
        }
        return vec
    }
}

/**
 * Create the appropriate embedder based on environment and flags
 */
function createEmbedder(): Embedder {
    // Dry-run mode uses dummy embedder (no API calls)
    if (dryRunFlag) {
        console.log('🧪 Dry-run mode: using mock embedder (no API calls)')
        return dummyEmbedder
    }

    // Try OpenAI first (recommended for production)
    const apiKey = process.env.OPENAI_API_KEY
    if (apiKey && apiKey.startsWith('sk-')) {
        console.log('🔑 Using OpenAI embeddings')
        return createOpenAIEmbedder()
    }

    // Fall back to ONNX (local, offline-capable)
    console.log('📦 Using ONNX local embeddings (no API key found)')
    console.log('   Tip: Set OPENAI_API_KEY for better accuracy')
    return createONNXEmbedder()
}

const embedder = createEmbedder()
const detector = new PRSenseDetector({ embedder })

async function main() {
    const command = filteredArgs[0]

    if (!command) {
        printHelp()
        process.exit(1)
    }

    switch (command) {
        case 'check':
            await checkCommand(filteredArgs[1])
            break
        case 'stats':
            await statsCommand()
            break
        case 'help':
        case '--help':
        case '-h':
            printHelp()
            break
        default:
            console.error(`Unknown command: ${command}`)
            printHelp()
            process.exit(1)
    }
}

async function checkCommand(filePath?: string) {
    if (!filePath) {
        console.error('Error: Please provide a JSON file with PR data')
        console.log('Usage: prsense check <pr-file.json> [--dry-run]')
        process.exit(1)
    }

    if (!existsSync(filePath)) {
        console.error(`Error: File not found: ${filePath}`)
        process.exit(1)
    }

    const prData = JSON.parse(readFileSync(filePath, 'utf-8'))

    console.log(`🔍 Checking PR #${prData.prId}: ${prData.title}`)

    const result = await detector.check(prData)

    console.log('\n📊 Result:')
    if (result.type === 'DUPLICATE') {
        console.log(`❌ DUPLICATE of PR #${result.originalPr}`)
        console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`)
    } else if (result.type === 'POSSIBLE') {
        console.log(`⚠️  POSSIBLY similar to PR #${result.originalPr}`)
        console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`)
    } else {
        console.log(`✅ UNIQUE - No duplicates found`)
    }
}

async function statsCommand() {
    const stats = detector.getStats()

    console.log('📊 PRSense Statistics\n')
    console.log(`Total PRs indexed: ${stats.totalPRs}`)
    console.log(`Duplicate pairs found: ${stats.duplicatePairs}`)
    console.log(`Bloom filter size: ${stats.bloomFilterSize} bits`)
}

function printHelp() {
    console.log(`
PRSense - Duplicate PR Detection

USAGE:
  prsense <command> [options]

COMMANDS:
  check <file>    Check if a PR is a duplicate
  stats           Show detector statistics
  help            Show this help message

OPTIONS:
  --dry-run       Use mock embedder (no API calls)

EMBEDDER SELECTION:
  - With OPENAI_API_KEY: Uses OpenAI embeddings (recommended)
  - Without API key: Falls back to ONNX local embeddings
  - With --dry-run: Uses mock embedder for testing

EXAMPLES:
  prsense check pr.json              # Uses real embedder
  prsense check pr.json --dry-run    # Dry run (no APIs)
  prsense stats

PR FILE FORMAT (JSON):
  {
    "prId": 123,
    "title": "Fix login bug",
    "description": "Handle empty passwords",
    "files": ["auth/login.ts"],
    "diff": "optional diff content"
  }
    `.trim())
}

main().catch(console.error)

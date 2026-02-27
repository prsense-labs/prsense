/**
 * PRSense v1.0.2 — Advanced Usage Examples
 *
 * Demonstrates the full feature set of PRSense as a
 * Repository Memory Infrastructure library.
 *
 * Run with:
 *   npx tsx examples/advanced-usage.ts
 *
 * Set OPENAI_API_KEY for real embeddings, or the script
 * falls back to a deterministic mock embedder automatically.
 */

import { PRSenseDetector } from '../src/prsense.js'
import { CrossRepoDetector } from '../src/crossRepo.js'
import { withCache } from '../src/embeddingCache.js'
import { FileStorage } from '../src/storage/file.js'
import { InMemoryStorage } from '../src/storage/memory.js'
import type { Embedder } from '../src/embeddingPipeline.js'
import type { StorageBackend } from '../src/storage/interface.js'

// ─── Mock embedder (used when no OPENAI_API_KEY is set) ──────────────────────

function hashEmbed(text: string, dims = 1536): Float32Array {
    const vec = new Float32Array(dims)
    for (let i = 0; i < text.length; i++) {
        const idx = i % dims
        vec[idx] = (vec[idx] ?? 0) + text.charCodeAt(i) / 255
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
    return vec.map(v => v / norm) as Float32Array
}

const mockEmbedder: Embedder = {
    embedText: async (text) => hashEmbed(text),
    embedDiff: async (diff) => hashEmbed(diff || 'empty'),
}

function getEmbedder(): Embedder {
    if (process.env.OPENAI_API_KEY) {
        const { createOpenAIEmbedder } = require('../src/embedders/openai.js')
        console.log('🔑 Using OpenAI embeddings\n')
        return createOpenAIEmbedder()
    }
    console.log('📦 Using mock embedder (set OPENAI_API_KEY for real embeddings)\n')
    return mockEmbedder
}

// ─── Sample PR data ───────────────────────────────────────────────────────────

const prs = [
    {
        prId: 1001,
        title: 'Fix authentication bypass in login flow',
        description: 'Patch critical security issue where empty passwords bypass validation. Adds length check and trim before comparison.',
        files: ['src/auth/login.ts', 'src/auth/session.ts', 'src/middleware/auth.ts'],
        diff: `-  if (password) {\n+  if (password && password.trim().length > 0) {`
    },
    {
        prId: 1002,
        title: 'Add dark mode support to dashboard UI',
        description: 'Implement CSS custom properties for theming. Adds toggle button to navbar, persists preference to localStorage.',
        files: ['src/ui/theme.css', 'src/components/Navbar.tsx', 'src/hooks/useTheme.ts'],
        diff: `+.dark-mode { --bg: #1a1a2e; --text: #e0e0e0; }\n+.light-mode { --bg: #ffffff; --text: #1a1a1a; }`
    },
    {
        prId: 1003,
        title: 'Optimize database query performance for analytics',
        description: 'Add composite indexes on (repo_id, created_at). Rewrite N+1 queries in analytics endpoint using JOIN. 10x speedup on large datasets.',
        files: ['src/db/migrations/0012_add_indexes.sql', 'src/api/analytics.ts', 'src/db/queries.ts'],
        diff: `+CREATE INDEX CONCURRENTLY idx_prs_repo_date ON pull_requests(repo_id, created_at DESC);`
    },
    {
        prId: 1004,
        title: 'Refactor authentication module to use JWT',
        description: 'Replace session-based auth with stateless JWT tokens. Improves scalability for distributed deployments.',
        files: ['src/auth/login.ts', 'src/auth/jwt.ts', 'src/middleware/auth.ts'],
        diff: `+import { sign, verify } from 'jsonwebtoken'\n-import { sessions } from './session'`
    },
    {
        prId: 1005,
        title: 'Fix empty password security vulnerability in auth',
        description: 'Security fix: empty passwords were bypassing the login check. Added validation before password comparison.',
        files: ['src/auth/login.ts', 'tests/auth.test.ts'],
        diff: `-  if (password) {\n+  if (password?.trim()) {`
    },
]

// ─── Example 1: Basic duplicate detection ────────────────────────────────────

async function example1_basicDetection() {
    console.log('═'.repeat(60))
    console.log('Example 1: Basic Duplicate Detection')
    console.log('═'.repeat(60))

    const embedder = getEmbedder()
    const detector = new PRSenseDetector({
        embedder,
        duplicateThreshold: 0.90,
        possibleThreshold: 0.82,
    })
    await detector.init()

    // Index the first 3 PRs
    console.log('Indexing PRs 1001, 1002, 1003...')
    for (const pr of prs.slice(0, 3)) {
        await detector.check(pr)
        console.log(`  ✅ Indexed PR #${pr.prId}: ${pr.title}`)
    }

    console.log('\nChecking PR #1005 (similar to #1001 — same auth bug)...')
    const pr1005 = prs[4]
    if (!pr1005) throw new Error('PR #1005 not found')
    const result = await detector.check(pr1005)

    console.log(`\nResult: ${result.type}`)
    if (result.type !== 'UNIQUE') {
        console.log(`  Similar to: PR #${result.originalPr}`)
        console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`)
    }
    console.log('')
}

// ─── Example 2: Explainability — detailed score breakdown ────────────────────

async function example2_explainability() {
    console.log('═'.repeat(60))
    console.log('Example 2: Explainability (Score Breakdown)')
    console.log('═'.repeat(60))

    const embedder = getEmbedder()
    const detector = new PRSenseDetector({
        embedder,
        duplicateThreshold: 0.85,
        possibleThreshold: 0.75,
        // Custom weights: text=50%, diff=35%, files=15%
        weights: [0.50, 0.35, 0.15],
    })
    await detector.init()

    const pr1001 = prs[0]
    if (!pr1001) throw new Error('PR #1001 not found')
    await detector.check(pr1001) // Index PR #1001

    console.log('Checking PR #1005 with detailed breakdown...\n')
    const pr1005 = prs[4]
    if (!pr1005) throw new Error('PR #1005 not found')
    const result = await detector.checkDetailed(pr1005)

    console.log(`Result: ${result.type}`)
    if (result.breakdown) {
        const b = result.breakdown
        const bar = (n: number) => '█'.repeat(Math.round(n * 10)) + '░'.repeat(10 - Math.round(n * 10))
        console.log('\nScore Breakdown:')
        console.log(`  Text similarity:  [${bar(b.textSimilarity)}] ${(b.textSimilarity * 100).toFixed(1)}%  → contributes ${(b.textContribution * 100).toFixed(1)}%`)
        console.log(`  Diff similarity:  [${bar(b.diffSimilarity)}] ${(b.diffSimilarity * 100).toFixed(1)}%  → contributes ${(b.diffContribution * 100).toFixed(1)}%`)
        console.log(`  File similarity:  [${bar(b.fileSimilarity)}] ${(b.fileSimilarity * 100).toFixed(1)}%  → contributes ${(b.fileContribution * 100).toFixed(1)}%`)
        console.log(`  ─────────────────────────────────────────────────────`)
        console.log(`  Final score:      [${bar(b.finalScore)}] ${(b.finalScore * 100).toFixed(1)}%`)
        console.log(`  Weights used:     text=${(b.weights[0] * 100).toFixed(0)}%  diff=${(b.weights[1] * 100).toFixed(0)}%  files=${(b.weights[2] * 100).toFixed(0)}%`)
    }
    console.log('')
}

// ─── Example 3: Batch API ────────────────────────────────────────────────────

async function example3_batchAPI() {
    console.log('═'.repeat(60))
    console.log('Example 3: Batch Processing (checkMany)')
    console.log('═'.repeat(60))

    const embedder = getEmbedder()
    const detector = new PRSenseDetector({ embedder })
    await detector.init()

    // Index first PR as baseline
    const baselinePr = prs[0]
    if (!baselinePr) throw new Error('Baseline PR not found')
    await detector.check(baselinePr)

    console.log('Batch-checking PRs 1002–1005...\n')
    const results = await detector.checkMany(prs.slice(1))

    results.forEach((r, i) => {
        const pr = prs[i + 1]
        if (!pr) {
            console.warn(`Skipping result at index ${i}: PR data not found`)
            return
        }
        const { result } = r
        const icon = result.type === 'DUPLICATE' ? '❌' : result.type === 'POSSIBLE' ? '⚠️ ' : '✅'
        const detail = result.type !== 'UNIQUE' ? ` (similar to #${result.originalPr}, ${(result.confidence * 100).toFixed(1)}%)` : ''
        console.log(`  ${icon} PR #${pr.prId}: ${result.type}${detail}  [${r.processingTimeMs}ms]`)
    })
    console.log('')
}

// ─── Example 4: Semantic search ──────────────────────────────────────────────

async function example4_semanticSearch() {
    console.log('═'.repeat(60))
    console.log('Example 4: Semantic Search (Repository Memory)')
    console.log('═'.repeat(60))

    const embedder = getEmbedder()
    const detector = new PRSenseDetector({ embedder })
    await detector.init()

    // Index all PRs
    for (const pr of prs) {
        await detector.check(pr)
    }

    const queries = [
        'authentication security vulnerability',
        'database performance optimization',
        'UI theme dark mode',
    ]

    for (const query of queries) {
        console.log(`\n🔍 Query: "${query}"`)
        const results = await detector.search(query, 2)
        results.forEach((r, i) => {
            console.log(`  ${i + 1}. PR #${r.prId} — ${r.title}`)
            console.log(`     Score: ${(r.score * 100).toFixed(1)}%`)
        })
    }
    console.log('')
}

// ─── Example 5: Configurable weights ─────────────────────────────────────────

async function example5_configurableWeights() {
    console.log('═'.repeat(60))
    console.log('Example 5: Configurable Weights')
    console.log('═'.repeat(60))

    const embedder = getEmbedder()
    const basePr = prs[0]
    const similarAuthPr = prs[4]
    if (!basePr || !similarAuthPr) throw new Error('Required PRs for example5 not found')

    const configs = [
        { label: 'Default (balanced)', weights: [0.45, 0.35, 0.20] as [number, number, number] },
        { label: 'Text-heavy (PR titles)', weights: [0.70, 0.20, 0.10] as [number, number, number] },
        { label: 'Diff-heavy (code focus)', weights: [0.20, 0.70, 0.10] as [number, number, number] },
        { label: 'File-heavy (monorepo)', weights: [0.30, 0.30, 0.40] as [number, number, number] },
    ]

    for (const cfg of configs) {
        const detector = new PRSenseDetector({ embedder, weights: cfg.weights, duplicateThreshold: 0.80 })
        await detector.init()
        await detector.check(basePr) // index auth PR

        const result = await detector.check(similarAuthPr) // check similar auth PR
        console.log(`  ${cfg.label}:`)
        console.log(`    Weights: text=${(cfg.weights[0] * 100).toFixed(0)}% diff=${(cfg.weights[1] * 100).toFixed(0)}% files=${(cfg.weights[2] * 100).toFixed(0)}%`)
        console.log(`    Result:  ${result.type} (confidence: ${(result.confidence * 100).toFixed(1)}%)`)
    }
    console.log('')
}

// ─── Example 6: Embedding cache ──────────────────────────────────────────────

async function example6_embeddingCache() {
    console.log('═'.repeat(60))
    console.log('Example 6: Embedding Cache (withCache)')
    console.log('═'.repeat(60))

    let apiCallCount = 0
    const countingEmbedder: Embedder = {
        embedText: async (text) => { apiCallCount++; return hashEmbed(text) },
        embedDiff: async (diff) => { apiCallCount++; return hashEmbed(diff) },
    }

    // Wrap with cache — repeated identical text/diff won't re-call the embedder
    const cachedEmbedder = withCache(countingEmbedder, 500)

    const detector = new PRSenseDetector({
        embedder: cachedEmbedder,
        enableCache: true,
        cacheSize: 500,
    })
    await detector.init()

    const pr0 = prs[0]
    if (!pr0) throw new Error('PR #1001 not found for cache example')

    // Check the same PR twice — second call should use cache
    await detector.check(pr0)
    const callsAfterFirst = apiCallCount

    await detector.check({ ...pr0, prId: 9999 }) // same content, different ID
    const callsAfterSecond = apiCallCount

    console.log(`  API calls after 1st check: ${callsAfterFirst}`)
    console.log(`  API calls after 2nd check: ${callsAfterSecond}`)
    console.log(`  Cache saved: ${callsAfterFirst - (callsAfterSecond - callsAfterFirst)} calls`)

    const cacheStats = cachedEmbedder.cache.getStats()
    console.log(`  Cache hit rate: ${(cacheStats.hitRate * 100).toFixed(1)}%  (${cacheStats.hits} hits / ${cacheStats.misses} misses)`)
    console.log('')
}

// ─── Example 7: State export/import (persistence without a DB) ───────────────

async function example7_stateExportImport() {
    console.log('═'.repeat(60))
    console.log('Example 7: State Export / Import (Portable Snapshots)')
    console.log('═'.repeat(60))

    const embedder = getEmbedder()

    // Detector A: index some PRs and export state
    const detectorA = new PRSenseDetector({ embedder })
    await detectorA.init()

    for (const pr of prs.slice(0, 3)) {
        await detectorA.check(pr)
    }

    const snapshot = detectorA.exportState()
    console.log(`  Exported state: ${snapshot.records.length} PR records, bloom=${snapshot.bloom.length} chars`)

    // Detector B: import state and continue detection
    const detectorB = new PRSenseDetector({ embedder, duplicateThreshold: 0.80 })
    await detectorB.init()
    detectorB.importState(snapshot)

    console.log(`  Imported into fresh detector: ${detectorB.getStats().totalPRs} PRs loaded`)

    const pr1005 = prs[4]
    if (!pr1005) throw new Error('PR #1005 not found for state import example')
    const result = await detectorB.check(pr1005) // should detect as similar to #1001
    console.log(`  Checking PR #1005 after import: ${result.type}`)
    if (result.type !== 'UNIQUE') {
        console.log(`  → Similar to PR #${result.originalPr} (${(result.confidence * 100).toFixed(1)}% confidence)`)
    }
    console.log('')
}

// ─── Example 8: Storage backend (MemoryStorage) ──────────────────────────────

async function example8_storageBackend() {
    console.log('═'.repeat(60))
    console.log('Example 8: Persistent Storage Backend')
    console.log('═'.repeat(60))

    const embedder = getEmbedder()

    // Use InMemoryStorage (swap for SQLiteStorage or PostgresStorage in production)
    const storage: StorageBackend = new InMemoryStorage()

    const detector = new PRSenseDetector({ embedder, storage })
    // v1.0.2: init() loads persisted records from storage
    await detector.init()

    console.log('  Indexing PRs into storage backend...')
    for (const pr of prs) {
        const result = await detector.check(pr)
        console.log(`    PR #${pr.prId}: ${result.type}`)
    }

    const stats = detector.getStats()
    console.log(`\n  Storage stats:`)
    console.log(`    Total PRs:      ${stats.totalPRs}`)
    console.log(`    Duplicate pairs: ${stats.duplicatePairs}`)
    console.log(`    Storage:        ${stats.storage ?? 'memory'}`)
    console.log('')
}

// ─── Example 9: Cross-repository detection ───────────────────────────────────

async function example9_crossRepo() {
    console.log('═'.repeat(60))
    console.log('Example 9: Cross-Repository Detection')
    console.log('═'.repeat(60))

    const embedder = getEmbedder()

    const crossDetector = new CrossRepoDetector({
        embedder,
        duplicateThreshold: 0.85,
        possibleThreshold: 0.75,
    })

    // Register two repositories
    crossDetector.addRepository({ repoId: 'org/backend', name: 'Backend API' })
    crossDetector.addRepository({ repoId: 'org/frontend', name: 'Frontend App' })

    console.log('  Indexing PRs across repositories...')

    const authPr = prs[0]
    const uiPr = prs[1]
    const similarAuthPr = prs[4]
    if (!authPr || !uiPr || !similarAuthPr) throw new Error('Required PRs for cross-repo example not found')

    // Index auth PR in backend repo
    const r1 = await crossDetector.check({ ...authPr, repoId: 'org/backend' })
    console.log(`    PR #1001 (org/backend):  ${r1.type}`)

    // Index UI PR in frontend repo
    const r2 = await crossDetector.check({ ...uiPr, repoId: 'org/frontend' })
    console.log(`    PR #1002 (org/frontend): ${r2.type}`)

    // Check similar auth PR in frontend repo — should detect cross-repo duplicate
    const r3 = await crossDetector.check({ ...similarAuthPr, prId: 2001, repoId: 'org/frontend' })
    console.log(`    PR #2001 (org/frontend): ${r3.type}${r3.isCrossRepo ? ' [CROSS-REPO]' : ''}`)
    if (r3.type !== 'UNIQUE') {
        console.log(`    → Similar to PR #${r3.originalPr} (${(r3.confidence * 100).toFixed(1)}% confidence)`)
    }

    const stats = crossDetector.getStats()
    console.log(`\n  Cross-repo stats:`)
    console.log(`    Repositories:   ${stats.repositories}`)
    console.log(`    Total PRs:      ${stats.totalPRs}`)
    console.log(`    Duplicate pairs: ${stats.totalDuplicatePairs}`)
    console.log('')
}

// ─── Example 10: Dry-run mode (CI/testing) ───────────────────────────────────

async function example10_dryRun() {
    console.log('═'.repeat(60))
    console.log('Example 10: Dry-Run Mode (CI / Testing)')
    console.log('═'.repeat(60))

    const embedder = getEmbedder()
    const detector = new PRSenseDetector({ embedder })
    await detector.init()

    const pr0 = prs[0]
    const pr1 = prs[1]
    const pr2 = prs[2]
    const pr3 = prs[3]
    if (!pr0 || !pr1 || !pr2 || !pr3) throw new Error('Required PRs for dry-run example not found')

    // Index some PRs normally
    await detector.check(pr0)
    await detector.check(pr1)
    const statsBefore = detector.getStats()

    // Dry-run: check without adding to index
    console.log('  Running dry-run check (should not modify index)...')
    await detector.check(pr2, { dryRun: true })
    await detector.check(pr3, { dryRun: true })

    const statsAfter = detector.getStats()
    console.log(`  PRs before dry-run: ${statsBefore.totalPRs}`)
    console.log(`  PRs after dry-run:  ${statsAfter.totalPRs}  (unchanged ✅)`)
    console.log('')
}

// ─── Run all examples ─────────────────────────────────────────────────────────

async function main() {
    console.log('\n' + '═'.repeat(60))
    console.log('  PRSense v1.0.2 — Advanced Usage Examples')
    console.log('  Repository Memory Infrastructure')
    console.log('═'.repeat(60) + '\n')

    await example1_basicDetection()
    await example2_explainability()
    await example3_batchAPI()
    await example4_semanticSearch()
    await example5_configurableWeights()
    await example6_embeddingCache()
    await example7_stateExportImport()
    await example8_storageBackend()
    await example9_crossRepo()
    await example10_dryRun()

    console.log('═'.repeat(60))
    console.log('  All examples complete!')
    console.log('═'.repeat(60) + '\n')
}

main().catch((err) => {
    console.error('Example failed:', err)
    process.exit(1)
})

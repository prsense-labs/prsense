/**
 * PRSense v1.0.2 — Advanced Integration Test Script
 *
 * Run with: npx tsx src/test.ts
 *
 * Tests the full detection pipeline end-to-end using a mock embedder.
 * Covers: duplicate detection, batch API, semantic search, explainability,
 * configurable weights, cross-repo detection, cache, and state export/import.
 */

import { PRSenseDetector } from './prsense.js'
import { CrossRepoDetector } from './crossRepo.js'
import { cosine } from './similarity.js'
import { jaccard } from './jaccard.js'
import { BloomFilter } from './bloomFilter.js'
import { AttributionGraph } from './attributionGraph.js'
import { EmbeddingPipeline } from './embeddingPipeline.js'
import type { Embedder } from './embeddingPipeline.js'
import { EmbeddingCache, withCache } from './embeddingCache.js'
import { ValidationError, ConfigurationError } from './errors.js'
import { validatePRInput, validateWeights, validateThresholds } from './validation.js'

// ─── Helpers ────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve(fn()).then(() => {
    console.log(`  ✅ ${name}`)
    passed++
  }).catch((err) => {
    console.log(`  ❌ ${name}`)
    console.log(`     ${err instanceof Error ? err.message : String(err)}`)
    failed++
  })
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`)
}

function assertClose(a: number, b: number, tol = 0.001, msg = '') {
  if (Math.abs(a - b) > tol) throw new Error(`Expected ${a} ≈ ${b} (tol ${tol}) ${msg}`)
}

// ─── Deterministic mock embedder ────────────────────────────────────────────
// Produces embeddings based on content hash so similar text → similar vectors

function hashEmbed(text: string, dims = 64): Float32Array {
  const vec = new Float32Array(dims)
  for (let i = 0; i < text.length; i++) {
    const idx = i % dims
    vec[idx] = (vec[idx] ?? 0) + text.charCodeAt(i) / 255
  }
  // Normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map(v => v / norm) as Float32Array
}

const mockEmbedder: Embedder = {
  embedText: async (text: string) => hashEmbed(text, 64),
  embedDiff: async (diff: string) => hashEmbed(diff || 'empty', 64)
}

// ─── Test data ───────────────────────────────────────────────────────────────

const PR_AUTH_FIX = {
  prId: 1,
  title: 'Fix authentication bug in login flow',
  description: 'Handle edge case where empty password bypasses validation in the auth module',
  files: ['src/auth/login.ts', 'src/auth/session.ts', 'tests/auth.test.ts'],
  diff: '-if (password) {\n+if (password && password.length > 0) {'
}

const PR_AUTH_DUPLICATE = {
  prId: 2,
  title: 'Fix authentication bug in login flow',
  description: 'Handle edge case where empty password bypasses validation in the auth module',
  files: ['src/auth/login.ts', 'src/auth/session.ts', 'tests/auth.test.ts'],
  diff: '-if (password) {\n+if (password && password.length > 0) {'
}

const PR_UNRELATED = {
  prId: 3,
  title: 'Add dark mode support to dashboard',
  description: 'Implement CSS variables for theming, add toggle button to navbar',
  files: ['src/ui/theme.css', 'src/components/Navbar.tsx'],
  diff: '+.dark { background: #1a1a1a; color: #fff; }'
}

const PR_SIMILAR = {
  prId: 4,
  title: 'Fix auth login empty password bug',
  description: 'Patch authentication to reject empty passwords',
  files: ['src/auth/login.ts'],
  diff: '-if (password) {\n+if (password?.trim()) {'
}

// ─── Test Suites ─────────────────────────────────────────────────────────────

async function testSimilarityFunctions() {
  console.log('\n📐 Similarity Functions')

  await test('cosine: identical vectors → 1.0', () => {
    const a = new Float32Array([1, 0, 0])
    assertClose(cosine(a, a), 1.0)
  })

  await test('cosine: orthogonal vectors → 0.0', () => {
    const a = new Float32Array([1, 0, 0])
    const b = new Float32Array([0, 1, 0])
    assertClose(cosine(a, b), 0.0)
  })

  await test('cosine: zero vector → 0.0', () => {
    const a = new Float32Array([0, 0, 0])
    const b = new Float32Array([1, 2, 3])
    assertClose(cosine(a, b), 0.0)
  })

  await test('cosine: similar vectors → high score', () => {
    const a = new Float32Array([0.9, 0.1, 0.0])
    const b = new Float32Array([0.85, 0.15, 0.0])
    assert(cosine(a, b) > 0.99, `expected > 0.99, got ${cosine(a, b)}`)
  })

  await test('jaccard: identical sets → 1.0', () => {
    assertClose(jaccard(new Set(['a', 'b', 'c']), new Set(['a', 'b', 'c'])), 1.0)
  })

  await test('jaccard: disjoint sets → 0.0', () => {
    assertClose(jaccard(new Set(['a', 'b']), new Set(['c', 'd'])), 0.0)
  })

  await test('jaccard: both empty → 1.0', () => {
    assertClose(jaccard(new Set(), new Set()), 1.0)
  })

  await test('jaccard: partial overlap', () => {
    // intersection={b}, union={a,b,c} → 1/3
    assertClose(jaccard(new Set(['a', 'b']), new Set(['b', 'c'])), 1 / 3)
  })
}

async function testBloomFilter() {
  console.log('\n🌸 Bloom Filter')

  await test('add and mightContain: true for added items', () => {
    const bf = new BloomFilter(8192, 5)
    bf.add('hello')
    bf.add('world')
    assert(bf.mightContain('hello'), 'should contain hello')
    assert(bf.mightContain('world'), 'should contain world')
  })

  await test('mightContain: false for items never added', () => {
    const bf = new BloomFilter(8192, 5)
    bf.add('hello')
    // Not guaranteed (false positives exist), but with a fresh filter and distinct key this should be false
    assert(!bf.mightContain('definitely-not-added-xyz-123'), 'should not contain unseen key')
  })

  await test('export/import round-trip preserves state', () => {
    const bf1 = new BloomFilter(8192, 5)
    bf1.add('test-key')
    const exported = bf1.export()

    const bf2 = new BloomFilter(8192, 5)
    bf2.import(exported)
    assert(bf2.mightContain('test-key'), 'imported filter should contain test-key')
  })

  await test('import with wrong size throws', () => {
    const bf1 = new BloomFilter(8192, 5)
    const bf2 = new BloomFilter(4096, 5)
    let threw = false
    try { bf2.import(bf1.export()) } catch { threw = true }
    assert(threw, 'should throw on size mismatch')
  })
}

async function testAttributionGraph() {
  console.log('\n🕸️  Attribution Graph')

  await test('getOriginal: returns root of chain', () => {
    const g = new AttributionGraph()
    g.addEdge(2, 1)
    g.addEdge(3, 2)
    assert(g.getOriginal(3) === 1, 'root of 3→2→1 should be 1')
    assert(g.getOriginal(2) === 1, 'root of 2→1 should be 1')
    assert(g.getOriginal(1) === 1, 'root of 1 should be 1')
  })

  await test('getAllDuplicates: returns all transitive children', () => {
    const g = new AttributionGraph()
    g.addEdge(2, 1)
    g.addEdge(3, 1)
    g.addEdge(4, 2)
    const dupes = g.getAllDuplicates(1).sort()
    assert(dupes.length === 3, `expected 3 duplicates, got ${dupes.length}`)
    assert(dupes.includes(2) && dupes.includes(3) && dupes.includes(4), 'should include 2, 3, 4')
  })

  await test('getAllDuplicates: returns empty for leaf node', () => {
    const g = new AttributionGraph()
    g.addEdge(2, 1)
    assert(g.getAllDuplicates(2).length === 0, 'leaf should have no duplicates')
  })
}

async function testEmbeddingCache() {
  console.log('\n💾 Embedding Cache')

  await test('cache hit returns same array', async () => {
    const cache = new EmbeddingCache(100)
    const emb = new Float32Array([1, 2, 3])
    cache.set('t', 'd', 'x', emb, emb)
    const hit = cache.get('t', 'd', 'x')
    assert(hit !== null, 'should hit')
    assert(hit!.textEmbedding[0] === 1, 'should return correct embedding')
  })

  await test('cache miss returns null', () => {
    const cache = new EmbeddingCache(100)
    assert(cache.get('missing', '', '') === null, 'should miss')
  })

  await test('cache evicts oldest when full', () => {
    const cache = new EmbeddingCache(2)
    const e = new Float32Array([1])
    cache.set('a', '', '', e, e)
    cache.set('b', '', '', e, e)
    cache.set('c', '', '', e, e) // evicts 'a'
    assert(cache.get('a', '', '') === null, 'a should be evicted')
    assert(cache.get('c', '', '') !== null, 'c should be present')
  })

  await test('getStats tracks hits and misses', () => {
    const cache = new EmbeddingCache(100)
    const e = new Float32Array([1])
    cache.set('t', 'd', 'x', e, e)
    cache.get('t', 'd', 'x') // hit
    cache.get('miss', '', '') // miss
    const stats = cache.getStats()
    assert(stats.hits === 1, `expected 1 hit, got ${stats.hits}`)
    assert(stats.misses === 1, `expected 1 miss, got ${stats.misses}`)
    assertClose(stats.hitRate, 0.5)
  })

  await test('withCache wrapper actually caches embedText calls', async () => {
    let callCount = 0
    const countingEmbedder: Embedder = {
      embedText: async (t) => { callCount++; return hashEmbed(t) },
      embedDiff: async (d) => hashEmbed(d)
    }
    const cached = withCache(countingEmbedder, 100)
    await cached.embedText('hello')
    await cached.embedText('hello') // should hit cache
    assert(callCount === 1, `expected 1 call, got ${callCount} (cache not working)`)
  })
}

async function testValidation() {
  console.log('\n🛡️  Validation')

  await test('validatePRInput: rejects negative prId', () => {
    let threw = false
    try { validatePRInput({ prId: -1, title: 'x', description: '', files: [] }) } catch { threw = true }
    assert(threw, 'should throw for negative prId')
  })

  await test('validatePRInput: rejects empty title', () => {
    let threw = false
    try { validatePRInput({ prId: 1, title: '   ', description: '', files: [] }) } catch { threw = true }
    assert(threw, 'should throw for whitespace-only title')
  })

  await test('validatePRInput: rejects title > 500 chars', () => {
    let threw = false
    try { validatePRInput({ prId: 1, title: 'x'.repeat(501), description: '', files: [] }) } catch { threw = true }
    assert(threw, 'should throw for title > 500 chars')
  })

  await test('validateWeights: rejects all-zero weights', () => {
    let threw = false
    try { validateWeights([0, 0, 0]) } catch { threw = true }
    assert(threw, 'should throw for all-zero weights')
  })

  await test('validateWeights: rejects negative weights', () => {
    let threw = false
    try { validateWeights([-0.1, 0.6, 0.5]) } catch { threw = true }
    assert(threw, 'should throw for negative weight')
  })

  await test('validateThresholds: rejects duplicate < possible', () => {
    let threw = false
    try { validateThresholds(0.7, 0.9) } catch { threw = true }
    assert(threw, 'should throw when duplicateThreshold < possibleThreshold')
  })

  await test('ConfigurationError thrown for bad embedder', () => {
    let threw = false
    try { new PRSenseDetector({ embedder: null as any }) } catch (e) {
      threw = e instanceof ConfigurationError
    }
    assert(threw, 'should throw ConfigurationError')
  })
}

async function testDetector() {
  console.log('\n🔍 PRSenseDetector — Core Detection')

  const detector = new PRSenseDetector({ embedder: mockEmbedder })
  await detector.init()

  await test('first PR is always UNIQUE', async () => {
    const result = await detector.check(PR_AUTH_FIX)
    assert(result.type === 'UNIQUE', `expected UNIQUE, got ${result.type}`)
  })

  await test('identical PR is detected as DUPLICATE or POSSIBLE', async () => {
    const result = await detector.check(PR_AUTH_DUPLICATE)
    assert(result.type === 'DUPLICATE' || result.type === 'POSSIBLE',
      `expected DUPLICATE or POSSIBLE, got ${result.type}`)
  })

  await test('unrelated PR is UNIQUE', async () => {
    const result = await detector.check(PR_UNRELATED)
    assert(result.type === 'UNIQUE', `expected UNIQUE, got ${result.type}`)
  })

  await test('dryRun does not add to index', async () => {
    const d = new PRSenseDetector({ embedder: mockEmbedder })
    await d.init()
    await d.check(PR_AUTH_FIX)
    const before = d.getStats().totalPRs
    await d.check({ ...PR_AUTH_FIX, prId: 99 }, { dryRun: true })
    assert(d.getStats().totalPRs === before, 'dry-run should not increment totalPRs')
  })

  await test('getStats returns correct totalPRs', async () => {
    const d = new PRSenseDetector({ embedder: mockEmbedder })
    await d.init()
    await d.check(PR_AUTH_FIX)
    await d.check(PR_UNRELATED)
    assert(d.getStats().totalPRs === 2, `expected 2, got ${d.getStats().totalPRs}`)
  })

  await test('getDuplicates returns linked PRs', async () => {
    const d = new PRSenseDetector({ embedder: mockEmbedder, duplicateThreshold: 0.5 })
    await d.init()
    await d.check(PR_AUTH_FIX)
    const result = await d.check(PR_AUTH_DUPLICATE)
    if (result.type === 'DUPLICATE') {
      const dupes = d.getDuplicates(PR_AUTH_FIX.prId)
      assert(dupes.includes(PR_AUTH_DUPLICATE.prId), 'getDuplicates should include the duplicate PR')
    }
  })
}

async function testExplainability() {
  console.log('\n🔬 Explainability (checkDetailed)')

  const detector = new PRSenseDetector({ embedder: mockEmbedder })
  await detector.init()
  await detector.check(PR_AUTH_FIX)

  await test('checkDetailed returns breakdown for UNIQUE', async () => {
    const result = await detector.checkDetailed(PR_UNRELATED)
    assert(result.type === 'UNIQUE', 'should be UNIQUE')
  })

  await test('checkDetailed returns breakdown with all fields', async () => {
    const d = new PRSenseDetector({ embedder: mockEmbedder, duplicateThreshold: 0.3 })
    await d.init()
    await d.check(PR_AUTH_FIX)
    const result = await d.checkDetailed(PR_AUTH_DUPLICATE)
    if (result.type !== 'UNIQUE' && result.breakdown) {
      const b = result.breakdown
      assert(typeof b.textSimilarity === 'number', 'textSimilarity missing')
      assert(typeof b.diffSimilarity === 'number', 'diffSimilarity missing')
      assert(typeof b.fileSimilarity === 'number', 'fileSimilarity missing')
      assert(typeof b.finalScore === 'number', 'finalScore missing')
      assertClose(
        b.textContribution + b.diffContribution + b.fileContribution,
        b.finalScore, 0.001, 'contributions should sum to finalScore'
      )
    }
  })
}

async function testBatchAPI() {
  console.log('\n📦 Batch API (checkMany)')

  await test('checkMany processes all PRs', async () => {
    const d = new PRSenseDetector({ embedder: mockEmbedder })
    await d.init()
    const prs = [PR_AUTH_FIX, PR_UNRELATED, PR_SIMILAR]
    const results = await d.checkMany(prs)
    assert(results.length === 3, `expected 3 results, got ${results.length}`)
  })

  await test('checkMany includes processingTimeMs', async () => {
    const d = new PRSenseDetector({ embedder: mockEmbedder })
    await d.init()
    const results = await d.checkMany([PR_AUTH_FIX])
    assert(results.length > 0, 'results should not be empty')
    assert(typeof results[0]!.processingTimeMs === 'number', 'processingTimeMs should be a number')
  })

  await test('checkMany continues on individual PR error', async () => {
    const d = new PRSenseDetector({ embedder: mockEmbedder })
    await d.init()
    const badPR = { prId: -999, title: '', description: '', files: [] } // invalid
    const results = await d.checkMany([PR_AUTH_FIX, badPR as any, PR_UNRELATED])
    assert(results.length === 3, 'should return result for all 3 even if one fails')
  })

  await test('checkMany rejects > 1000 PRs', async () => {
    const d = new PRSenseDetector({ embedder: mockEmbedder })
    await d.init()
    const bigBatch = Array.from({ length: 1001 }, (_, i) => ({ ...PR_AUTH_FIX, prId: i + 1 }))
    let threw = false
    try { await d.checkMany(bigBatch) } catch { threw = true }
    assert(threw, 'should throw for > 1000 PRs')
  })
}

async function testConfigurableWeights() {
  console.log('\n⚖️  Configurable Weights')

  await test('setWeights updates weights', () => {
    const d = new PRSenseDetector({ embedder: mockEmbedder })
    d.setWeights([0.6, 0.3, 0.1])
    const w = d.getWeights()
    assertClose(w[0], 0.6)
    assertClose(w[1], 0.3)
    assertClose(w[2], 0.1)
  })

  await test('setWeights auto-normalizes weights that don\'t sum to 1', () => {
    const d = new PRSenseDetector({ embedder: mockEmbedder })
    d.setWeights([2, 1, 1]) // sum = 4, should normalize to [0.5, 0.25, 0.25]
    const w = d.getWeights()
    assertClose(w[0], 0.5)
    assertClose(w[1], 0.25)
    assertClose(w[2], 0.25)
  })

  await test('setWeights rejects negative weights', () => {
    const d = new PRSenseDetector({ embedder: mockEmbedder })
    let threw = false
    try { d.setWeights([-0.1, 0.6, 0.5]) } catch { threw = true }
    assert(threw, 'should throw for negative weights')
  })
}

async function testSemanticSearch() {
  console.log('\n🔎 Semantic Search')

  await test('search returns results after indexing', async () => {
    const d = new PRSenseDetector({ embedder: mockEmbedder })
    await d.init()
    await d.check(PR_AUTH_FIX)
    await d.check(PR_UNRELATED)
    const results = await d.search('authentication login', 5)
    assert(results.length > 0, 'should return at least 1 result')
  })

  await test('search results have required fields', async () => {
    const d = new PRSenseDetector({ embedder: mockEmbedder })
    await d.init()
    await d.check(PR_AUTH_FIX)
    const results = await d.search('auth bug', 1)
    if (results.length > 0) {
      const r = results[0]!
      assert(typeof r.prId === 'number', 'prId missing')
      assert(typeof r.score === 'number', 'score missing')
      assert(typeof r.title === 'string', 'title missing')
      assert(Array.isArray(r.files), 'files missing')
    }
  })

  await test('search returns empty array when no PRs indexed', async () => {
    const d = new PRSenseDetector({ embedder: mockEmbedder })
    await d.init()
    const results = await d.search('anything', 10)
    assert(results.length === 0, 'should return empty array with no indexed PRs')
  })
}

async function testStateExportImport() {
  console.log('\n💿 State Export / Import')

  await test('exportState and importState round-trip', async () => {
    const d1 = new PRSenseDetector({ embedder: mockEmbedder })
    await d1.init()
    await d1.check(PR_AUTH_FIX)
    await d1.check(PR_UNRELATED)

    const state = d1.exportState()
    assert(state.records.length === 2, 'should export 2 records')
    assert(typeof state.bloom === 'string', 'bloom should be a base64 string')

    const d2 = new PRSenseDetector({ embedder: mockEmbedder })
    await d2.init()
    d2.importState(state)
    assert(d2.getStats().totalPRs === 2, 'imported detector should have 2 PRs')
  })

  await test('imported detector detects duplicates correctly', async () => {
    const d1 = new PRSenseDetector({ embedder: mockEmbedder, duplicateThreshold: 0.3 })
    await d1.init()
    await d1.check(PR_AUTH_FIX)
    const state = d1.exportState()

    const d2 = new PRSenseDetector({ embedder: mockEmbedder, duplicateThreshold: 0.3 })
    await d2.init()
    d2.importState(state)

    const result = await d2.check(PR_AUTH_DUPLICATE)
    assert(result.type === 'DUPLICATE' || result.type === 'POSSIBLE',
      `expected DUPLICATE or POSSIBLE after import, got ${result.type}`)
  })
}

async function testCrossRepo() {
  console.log('\n🌐 Cross-Repository Detection')

  await test('detects duplicate within same repo', async () => {
    const crossDetector = new CrossRepoDetector({ embedder: mockEmbedder, duplicateThreshold: 0.3 })
    crossDetector.addRepository({ repoId: 'org/repo-a', name: 'Repo A' })

    await crossDetector.check({ ...PR_AUTH_FIX, repoId: 'org/repo-a' })
    const result = await crossDetector.check({ ...PR_AUTH_DUPLICATE, prId: 99, repoId: 'org/repo-a' })
    assert(result.type === 'DUPLICATE' || result.type === 'POSSIBLE',
      `expected duplicate within same repo, got ${result.type}`)
    assert(!result.isCrossRepo, 'same-repo duplicate should have isCrossRepo=false')
  })

  await test('getRepositories returns all registered repos', () => {
    const crossDetector = new CrossRepoDetector({ embedder: mockEmbedder })
    crossDetector.addRepository({ repoId: 'org/repo-a', name: 'Repo A' })
    crossDetector.addRepository({ repoId: 'org/repo-b', name: 'Repo B' })
    assert(crossDetector.getRepositories().length === 2, 'should have 2 repos')
  })

  await test('getStats aggregates across repos', async () => {
    const crossDetector = new CrossRepoDetector({ embedder: mockEmbedder })
    crossDetector.addRepository({ repoId: 'org/repo-a', name: 'Repo A' })
    crossDetector.addRepository({ repoId: 'org/repo-b', name: 'Repo B' })
    await crossDetector.check({ ...PR_AUTH_FIX, repoId: 'org/repo-a' })
    await crossDetector.check({ ...PR_UNRELATED, repoId: 'org/repo-b' })
    const stats = crossDetector.getStats()
    assert(stats.repositories === 2, 'should have 2 repos in stats')
  })
}

// ─── Run all suites ──────────────────────────────────────────────────────────

async function runAll() {
  console.log('\n' + '═'.repeat(55))
  console.log('  PRSense v1.0.2 — Advanced Test Suite')
  console.log('═'.repeat(55))

  await testSimilarityFunctions()
  await testBloomFilter()
  await testAttributionGraph()
  await testEmbeddingCache()
  await testValidation()
  await testDetector()
  await testExplainability()
  await testBatchAPI()
  await testConfigurableWeights()
  await testSemanticSearch()
  await testStateExportImport()
  await testCrossRepo()

  console.log('\n' + '═'.repeat(55))
  console.log(`  Results: ${passed} passed, ${failed} failed`)
  console.log('═'.repeat(55) + '\n')

  if (failed > 0) process.exit(1)
}

runAll().catch((err) => {
  console.error('Test runner crashed:', err)
  process.exit(1)
})
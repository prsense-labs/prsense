/**
 * Simple usage example for PRSense
 */

import { PRSenseDetector } from '../src/prsense.js'
import type { Embedder } from '../src/embeddingPipeline.js'

// Example 1: Dummy embedder for testing
const dummyEmbedder: Embedder = {
    embedText: async (text: string) => {
        // In production, use real embeddings (OpenAI, Sentence-BERT, etc.)
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

// Initialize detector
const detector = new PRSenseDetector({
    embedder: dummyEmbedder,
    duplicateThreshold: 0.90,
    possibleThreshold: 0.82
})

async function main() {
    console.log('🔍 PRSense Demo\n')

    // Submit first PR
    console.log('Submitting PR #1...')
    const pr1 = await detector.check({
        prId: 1,
        title: 'Fix login authentication bug',
        description: 'Handle empty password validation correctly',
        files: ['auth/login.ts', 'auth/utils.ts']
    })
    console.log('Result:', pr1, '\n')

    // Submit similar PR with detailed breakdown (Feature 2: Explainability)
    console.log('Submitting PR #2 (similar to PR #1) with detailed breakdown...')
    const pr2Detailed = await detector.checkDetailed({
        prId: 2,
        title: 'Fix auth bug with empty passwords',
        description: 'Correctly validate empty password fields',
        files: ['auth/login.ts', 'auth/validation.ts']
    }, { dryRun: true })  // Feature 6: Dry-run mode
    
    if (pr2Detailed.type !== 'UNIQUE' && pr2Detailed.breakdown) {
        console.log('Result:', pr2Detailed.type, 'of PR #' + pr2Detailed.originalPr)
        console.log('Confidence:', pr2Detailed.confidence)
        console.log('Breakdown:')
        console.log('  Text similarity:', pr2Detailed.breakdown.textSimilarity.toFixed(2))
        console.log('  Diff similarity:', pr2Detailed.breakdown.diffSimilarity.toFixed(2))
        console.log('  File similarity:', pr2Detailed.breakdown.fileSimilarity.toFixed(2))
        console.log('  Final score:', pr2Detailed.breakdown.finalScore.toFixed(2))
    }
    console.log()

    // Now actually index PR #2
    const pr2 = await detector.check({
        prId: 2,
        title: 'Fix auth bug with empty passwords',
        description: 'Correctly validate empty password fields',
        files: ['auth/login.ts', 'auth/validation.ts']
    })
    console.log('Indexed PR #2, result:', pr2, '\n')

    // Submit different PR
    console.log('Submitting PR #3 (different)...')
    const pr3 = await detector.check({
        prId: 3,
        title: 'Add dark mode support',
        description: 'Implement dark theme with CSS variables',
        files: ['styles/theme.css', 'components/App.tsx']
    })
    console.log('Result:', pr3, '\n')

    // Feature 3: Batch check multiple PRs
    console.log('📦 Batch checking PRs #4 and #5 (Feature 3)...')
    const batchResults = await detector.checkMany([
        {
            prId: 4,
            title: 'Fix login bug',
            description: 'Authentication issue',
            files: ['auth.ts']
        },
        {
            prId: 5,
            title: 'Update README',
            description: 'Add installation instructions',
            files: ['README.md']
        }
    ])
    for (const batchResult of batchResults) {
        console.log(`  PR #${batchResult.prId}: ${batchResult.result.type} (${batchResult.processingTimeMs}ms)`)
    }
    console.log()

    // Feature 5: Configurable weights
    console.log('⚖️  Updating weights (Feature 5)...')
    detector.setWeights([0.50, 0.30, 0.20])  // More weight on text
    console.log('New weights:', detector.getWeights())
    console.log()

    // Get stats
    console.log('📊 Statistics:')
    console.log(detector.getStats())

    // Get duplicates
    console.log('\n🔗 Duplicate chains:')
    console.log('Duplicates of PR #1:', detector.getDuplicates(1))
    console.log('Original of PR #2:', detector.getOriginal(2))
}

main().catch(console.error)

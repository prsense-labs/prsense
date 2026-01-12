/**
 * Simple usage example for PRSense
 */
import { PRSenseDetector } from '../src/prsense.js';
// Example 1: Dummy embedder for testing
const dummyEmbedder = {
    embedText: async (text) => {
        // In production, use real embeddings (OpenAI, Sentence-BERT, etc.)
        const vec = new Float32Array(384);
        for (let i = 0; i < text.length && i < 384; i++) {
            vec[i] = text.charCodeAt(i) / 255;
        }
        return vec;
    },
    embedDiff: async (diff) => {
        const vec = new Float32Array(384);
        for (let i = 0; i < diff.length && i < 384; i++) {
            vec[i] = diff.charCodeAt(i) / 255;
        }
        return vec;
    }
};
// Initialize detector
const detector = new PRSenseDetector({
    embedder: dummyEmbedder,
    duplicateThreshold: 0.90,
    possibleThreshold: 0.82
});
async function main() {
    console.log('🔍 PRSense Demo\n');
    // Submit first PR
    console.log('Submitting PR #1...');
    const pr1 = await detector.check({
        prId: 1,
        title: 'Fix login authentication bug',
        description: 'Handle empty password validation correctly',
        files: ['auth/login.ts', 'auth/utils.ts']
    });
    console.log('Result:', pr1, '\n');
    // Submit similar PR (should be detected as duplicate)
    console.log('Submitting PR #2 (similar to PR #1)...');
    const pr2 = await detector.check({
        prId: 2,
        title: 'Fix auth bug with empty passwords',
        description: 'Correctly validate empty password fields',
        files: ['auth/login.ts', 'auth/validation.ts']
    });
    console.log('Result:', pr2, '\n');
    // Submit different PR
    console.log('Submitting PR #3 (different)...');
    const pr3 = await detector.check({
        prId: 3,
        title: 'Add dark mode support',
        description: 'Implement dark theme with CSS variables',
        files: ['styles/theme.css', 'components/App.tsx']
    });
    console.log('Result:', pr3, '\n');
    // Get stats
    console.log('📊 Statistics:');
    console.log(detector.getStats());
    // Get duplicates
    console.log('\n🔗 Duplicate chains:');
    console.log('Duplicates of PR #1:', detector.getDuplicates(1));
    console.log('Original of PR #2:', detector.getOriginal(2));
}
main().catch(console.error);
//# sourceMappingURL=simple-usage.js.map
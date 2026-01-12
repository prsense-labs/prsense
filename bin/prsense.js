#!/usr/bin/env node
/**
 * PRSense CLI tool
 *
 * Usage:
 *   prsense check <pr-file.json>
 *   prsense stats
 */
import { PRSenseDetector } from '../src/prsense.js';
import * as fs from 'fs';
// Simple embedder for demo
const dummyEmbedder = {
    embedText: async (text) => {
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
const detector = new PRSenseDetector({ embedder: dummyEmbedder });
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    if (!command) {
        printHelp();
        process.exit(1);
    }
    switch (command) {
        case 'check':
            await checkCommand(args[1]);
            break;
        case 'stats':
            await statsCommand();
            break;
        case 'help':
        case '--help':
        case '-h':
            printHelp();
            break;
        default:
            console.error(`Unknown command: ${command}`);
            printHelp();
            process.exit(1);
    }
}
async function checkCommand(filePath) {
    if (!filePath) {
        console.error('Error: Please provide a JSON file with PR data');
        console.log('Usage: prsense check <pr-file.json>');
        process.exit(1);
    }
    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found: ${filePath}`);
        process.exit(1);
    }
    const prData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    console.log(`🔍 Checking PR #${prData.prId}: ${prData.title}`);
    const result = await detector.check(prData);
    console.log('\n📊 Result:');
    if (result.type === 'DUPLICATE') {
        console.log(`❌ DUPLICATE of PR #${result.originalPr}`);
        console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    }
    else if (result.type === 'POSSIBLE') {
        console.log(`⚠️  POSSIBLY similar to PR #${result.originalPr}`);
        console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    }
    else {
        console.log(`✅ UNIQUE - No duplicates found`);
    }
}
async function statsCommand() {
    const stats = detector.getStats();
    console.log('📊 PRSense Statistics\n');
    console.log(`Total PRs indexed: ${stats.totalPRs}`);
    console.log(`Duplicate pairs found: ${stats.duplicatePairs}`);
    console.log(`Bloom filter size: ${stats.bloomFilterSize} bits`);
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

EXAMPLES:
  prsense check pr.json
  prsense stats

PR FILE FORMAT (JSON):
  {
    "prId": 123,
    "title": "Fix login bug",
    "description": "Handle empty passwords",
    "files": ["auth/login.ts"],
    "diff": "optional diff content"
  }
    `.trim());
}
main().catch(console.error);
//# sourceMappingURL=prsense.js.map
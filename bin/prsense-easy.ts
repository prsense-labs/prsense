#!/usr/bin/env node
/**
 * EASY PRSense CLI - Auto-detects everything!
 * 
 * Just type: prsense
 * No files, no JSON, no manual work!
 */

import { PRSenseDetector } from '../src/prsense.js'
import { createOpenAIEmbedder } from '../src/embedders/openai.js'
import type { Embedder } from '../src/embeddingPipeline.js'
import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import * as readline from 'readline'

// Colors for terminal
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
}

const log = {
    success: (msg: string) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg: string) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    warning: (msg: string) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    info: (msg: string) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
    title: (msg: string) => console.log(`\n${colors.bold}${colors.cyan}${msg}${colors.reset}\n`)
}

// Get git info automatically
function getGitInfo() {
    try {
        const branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim()
        const title = execSync('git log -1 --pretty=%s', { encoding: 'utf-8' }).trim()
        const description = execSync('git log -1 --pretty=%b', { encoding: 'utf-8' }).trim()
        const files = execSync('git diff --name-only origin/main 2>/dev/null || git diff --name-only HEAD~1', { encoding: 'utf-8' })
            .trim()
            .split('\n')
            .filter(f => f.length > 0)
        
        return { branch, title, description, files, hasChanges: files.length > 0 }
    } catch (error) {
        return null
    }
}

// Interactive prompts
async function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close()
            resolve(answer)
        })
    })
}

// Setup wizard
async function setupWizard() {
    log.title('🚀 PRSense Setup Wizard')

    console.log('Let\'s set up PRSense in 3 steps:\n')

    // Step 1: OpenAI Key
    const hasKey = process.env.OPENAI_API_KEY
    if (!hasKey) {
        log.warning('No OpenAI API key found')
        console.log('\n📝 Get your key from: https://platform.openai.com/api-keys\n')
        const apiKey = await prompt('Enter your OpenAI API key (or press Enter to skip): ')
        
        if (apiKey.trim()) {
            const envPath = join(process.cwd(), '.env')
            const envContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : ''
            
            if (envContent.includes('OPENAI_API_KEY')) {
                const newContent = envContent.replace(/OPENAI_API_KEY=.*/, `OPENAI_API_KEY=${apiKey}`)
                writeFileSync(envPath, newContent)
            } else {
                writeFileSync(envPath, envContent + `\nOPENAI_API_KEY=${apiKey}\n`)
            }
            
            process.env.OPENAI_API_KEY = apiKey
            log.success('API key saved to .env')
        } else {
            log.info('Skipping OpenAI setup (you can add it to .env later)')
        }
    } else {
        log.success('OpenAI API key found')
    }

    // Step 2: Check git
    const gitInfo = getGitInfo()
    if (gitInfo) {
        log.success('Git repository detected')
        console.log(`   Branch: ${gitInfo.branch}`)
        console.log(`   Files changed: ${gitInfo.files.length}`)
    } else {
        log.warning('Not in a git repository (that\'s okay)')
    }

    // Step 3: Ready
    console.log('\n')
    log.success('Setup complete!')
    console.log('\n📖 Try these commands:')
    console.log('   prsense check      - Check current branch for duplicates')
    console.log('   prsense stats      - View statistics')
    console.log('   prsense help       - Show all commands\n')
}

// Auto-check current branch
async function autoCheck() {
    log.title('🔍 Checking Current Branch')

    // Get git info
    const gitInfo = getGitInfo()
    
    if (!gitInfo) {
        log.error('Not in a git repository')
        console.log('\n💡 Make sure you\'re in a git repo with commits\n')
        process.exit(1)
    }

    if (!gitInfo.hasChanges) {
        log.warning('No changes detected')
        console.log('\n💡 Commit some changes first, then run: prsense check\n')
        process.exit(0)
    }

    // Display what we found
    console.log(`📝 Branch: ${colors.cyan}${gitInfo.branch}${colors.reset}`)
    console.log(`📄 Title: ${gitInfo.title}`)
    console.log(`📂 Files: ${gitInfo.files.length} changed\n`)

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
        log.error('OpenAI API key not found')
        console.log('\n💡 Run: prsense setup\n')
        process.exit(1)
    }

    // Create detector
    const embedder = createOpenAIEmbedder()
    const detector = new PRSenseDetector({ embedder })

    // Check for duplicates
    console.log('🔄 Analyzing...\n')
    
    const result = await detector.check({
        prId: Date.now(),
        title: gitInfo.title,
        description: gitInfo.description,
        files: gitInfo.files
    })

    // Display results
    log.title('📊 Results')

    if (result.type === 'DUPLICATE') {
        log.error(`DUPLICATE of PR #${result.originalPr}`)
        console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`)
        console.log('\n💡 This PR appears to be a duplicate!')
        console.log('   Check the original PR before submitting.\n')
        process.exit(1)
    } else if (result.type === 'POSSIBLE') {
        log.warning(`POSSIBLY similar to PR #${result.originalPr}`)
        console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`)
        console.log('\n💡 Review the similar PR to avoid duplication.\n')
        process.exit(0)
    } else {
        log.success('UNIQUE - No duplicates found!')
        console.log('   Safe to submit this PR 🚀\n')
        process.exit(0)
    }
}

// Quick check (interactive)
async function quickCheck() {
    log.title('⚡ Quick Check')

    const title = await prompt('PR Title: ')
    const description = await prompt('Description (optional): ')
    const filesInput = await prompt('Files (comma-separated, optional): ')
    
    const files = filesInput ? filesInput.split(',').map(f => f.trim()) : []

    console.log('\n🔄 Checking...\n')

    const embedder = createOpenAIEmbedder()
    const detector = new PRSenseDetector({ embedder })

    const result = await detector.check({
        prId: Date.now(),
        title,
        description,
        files
    })

    log.title('📊 Results')

    if (result.type === 'DUPLICATE') {
        log.error(`DUPLICATE of PR #${result.originalPr}`)
        console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%\n`)
    } else if (result.type === 'POSSIBLE') {
        log.warning(`POSSIBLY similar to PR #${result.originalPr}`)
        console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%\n`)
    } else {
        log.success('UNIQUE - No duplicates found!\n')
    }
}

// Show stats
async function showStats() {
    const embedder = createOpenAIEmbedder()
    const detector = new PRSenseDetector({ embedder })
    const stats = detector.getStats()

    log.title('📊 PRSense Statistics')
    console.log(`Total PRs indexed:     ${stats.totalPRs}`)
    console.log(`Duplicate pairs found: ${stats.duplicatePairs}`)
    console.log(`Bloom filter size:     ${stats.bloomFilterSize} bits\n`)
}

// Help
function showHelp() {
    console.log(`
${colors.bold}${colors.cyan}PRSense - AI-Powered Duplicate PR Detection${colors.reset}

${colors.bold}USAGE:${colors.reset}
  prsense [command]

${colors.bold}COMMANDS:${colors.reset}
  ${colors.green}check${colors.reset}      Check current git branch for duplicates (auto-detects)
  ${colors.green}quick${colors.reset}      Quick interactive check (manual input)
  ${colors.green}setup${colors.reset}      Setup wizard (first-time configuration)
  ${colors.green}stats${colors.reset}      Show statistics
  ${colors.green}help${colors.reset}       Show this help

${colors.bold}EXAMPLES:${colors.reset}
  prsense              # Auto-check current branch
  prsense check        # Same as above
  prsense quick        # Interactive mode
  prsense setup        # Run setup wizard

${colors.bold}FIRST TIME?${colors.reset}
  1. Run: prsense setup
  2. Enter your OpenAI API key
  3. Run: prsense check

${colors.bold}DOCS:${colors.reset}
  Full guide: CLI_USAGE.md
  Quick start: START_HERE.md
`)
}

// Main
async function main() {
    const command = process.argv[2]

    // Logo
    if (!command || command === 'check' || command === 'quick') {
        console.log(`${colors.cyan}
╔═══════════════════════════════════════╗
║                                       ║
║         PRSense CLI v1.0              ║
║   AI-Powered Duplicate Detection      ║
║                                       ║
╚═══════════════════════════════════════╝
${colors.reset}`)
    }

    switch (command) {
        case 'setup':
            await setupWizard()
            break

        case 'check':
        case undefined: // Default to auto-check
            await autoCheck()
            break

        case 'quick':
            await quickCheck()
            break

        case 'stats':
            await showStats()
            break

        case 'help':
        case '--help':
        case '-h':
            showHelp()
            break

        default:
            log.error(`Unknown command: ${command}`)
            console.log('Run: prsense help\n')
            process.exit(1)
    }
}

main().catch((error) => {
    log.error('Error: ' + error.message)
    console.log('\n💡 Try: prsense setup\n')
    process.exit(1)
})

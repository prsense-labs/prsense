/**
 * GitHub Action entrypoint for PRSense
 * 
 * Automatically detects duplicate PRs in CI/CD workflows
 */

import * as core from '@actions/core'
import * as github from '@actions/github'
import { PRSenseDetector } from '../src/prsense.js'
import { OpenAIEmbedder } from '../src/embedders/openai.js'
import { createONNXEmbedder } from '../src/embedders/onnx.js'
import type { Embedder } from '../src/embeddingPipeline.js'
import { FileStorage } from '../src/storage/file.js'
import * as path from 'path'

async function run() {
    try {
        // Get inputs
        const githubToken = core.getInput('github-token', { required: true })
        const openaiKey = core.getInput('openai-api-key') // Now optional
        const embeddingProvider = core.getInput('embedding-provider') || 'openai'
        const duplicateThreshold = parseFloat(core.getInput('duplicate-threshold') || '0.90')
        const possibleThreshold = parseFloat(core.getInput('possible-threshold') || '0.82')
        const shouldPostComment = core.getInput('post-comment') === 'true'

        // Get PR context
        const context = github.context
        if (!context.payload.pull_request) {
            core.setFailed('This action only works on pull_request events')
            return
        }

        const pr = context.payload.pull_request
        const prNumber = pr.number
        const repo = context.repo

        core.info(`🔍 Checking PR #${prNumber} for duplicates...`)

        // Initialize GitHub API
        const octokit = github.getOctokit(githubToken)

        // Fetch PR details
        const { data: prData } = await octokit.rest.pulls.get({
            owner: repo.owner,
            repo: repo.repo,
            pull_number: prNumber
        })

        // Fetch PR files
        const { data: files } = await octokit.rest.pulls.listFiles({
            owner: repo.owner,
            repo: repo.repo,
            pull_number: prNumber
        })

        const currentPR = {
            number: prNumber,
            title: prData.title,
            body: prData.body || '',
            files: files.map(f => f.filename)
        }

        // Fetch all open PRs
        const { data: allPRs } = await octokit.rest.pulls.list({
            owner: repo.owner,
            repo: repo.repo,
            state: 'open',
            per_page: 100
        })

        // Filter out current PR
        const otherPRs = allPRs.filter(p => p.number !== prNumber)

        // Initialize embedder based on provider
        let embedder: Embedder
        if (embeddingProvider === 'onnx') {
            core.info('📦 Using ONNX local embeddings')
            embedder = createONNXEmbedder()
        } else {
            if (!openaiKey) {
                core.setFailed('openai-api-key is required when using openai embedding provider')
                return
            }
            core.info('🔑 Using OpenAI embeddings')
            embedder = new OpenAIEmbedder({ apiKey: openaiKey })
        }
        const detector = new PRSenseDetector({ embedder, duplicateThreshold, possibleThreshold })

        // Initialize Storage
        const storagePath = core.getInput('storage-path') || 'prsense-index.json'
        const absoluteStoragePath = path.resolve(process.cwd(), storagePath)
        const storage = new FileStorage(absoluteStoragePath)

        // Load existing state
        try {
            await storage.load(detector)
            core.info(`📂 Loaded index from ${storagePath}`)
        } catch (error) {
            core.info('🆕 No existing index found, starting fresh')
        }

        // Store existing PRs
        for (const existingPR of otherPRs) {
            const { data: prFiles } = await octokit.rest.pulls.listFiles({
                owner: repo.owner,
                repo: repo.repo,
                pull_number: existingPR.number
            })

            await detector.check({
                prId: existingPR.number,
                title: existingPR.title,
                description: existingPR.body || '',
                files: prFiles.map(f => f.filename)
            })
        }

        // Check for duplicates
        const result = await detector.check({
            prId: currentPR.number,
            title: currentPR.title,
            description: currentPR.body,
            files: currentPR.files
        })

        core.info(`✅ Detection complete: ${result.type}`)

        // Set outputs
        core.setOutput('result', result.type)
        core.setOutput('duplicates-found', result.type !== 'UNIQUE')
        core.setOutput('duplicate-count', result.type === 'UNIQUE' ? 0 : 1)
        if (result.type !== 'UNIQUE') {
            core.setOutput('similar-pr', result.originalPr.toString())
        }

        // Post comment if enabled
        if (shouldPostComment && result.type !== 'UNIQUE') {
            const comment = formatComment(result, duplicateThreshold, possibleThreshold)

            await octokit.rest.issues.createComment({
                owner: repo.owner,
                repo: repo.repo,
                issue_number: prNumber,
                body: comment
            })

            core.info('💬 Posted comment on PR')
        }

        // Set action status
        if (result.type === 'DUPLICATE') {
            core.warning(`🚨 Duplicate PR detected! Similar to #${result.originalPr}`)
        } else if (result.type === 'POSSIBLE') {
            core.notice(`⚠️ Possible duplicate of PR #${result.originalPr}`)
        } else {
            core.info('✅ No duplicates detected')
        }

        // Save state
        await storage.save(detector)
        core.info(`💾 Saved index to ${storagePath}`)

    } catch (error: any) {
        core.setFailed(`Action failed: ${error.message}`)
    }
}

function formatComment(result: any, duplicateThreshold: number, possibleThreshold: number): string {
    const score = result.confidence?.toFixed(3) || 'N/A'

    if (result.type === 'DUPLICATE') {
        return `## 🚨 PRSense: Duplicate Detected

This pull request appears to be a **duplicate** of PR #${result.originalPr}.

**Similarity Score:** ${score} (threshold: ${duplicateThreshold})

**Recommendation:** Please review PR #${result.originalPr} before proceeding. Consider collaborating on the existing PR instead of duplicating work.

---
<sub> Powered by [PRSense](https://github.com/prsense-labs/prsense) - AI-powered duplicate PR detection</sub>`
    }

    if (result.type === 'POSSIBLE') {
        return `## ⚠️ PRSense: Possible Duplicate

This pull request **may be similar** to PR #${result.originalPr}.

**Similarity Score:** ${score} (threshold: ${possibleThreshold})

**Recommendation:** Please review PR #${result.originalPr} to check if there's overlap. If the PRs address different aspects, feel free to proceed!

---
<sub> Powered by [PRSense](https://github.com/prsense-labs/prsense) - AI-powered duplicate PR detection</sub>`
    }

    return ''
}

// Run the action
run()

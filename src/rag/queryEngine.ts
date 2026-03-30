/**
 * RAG Query Engine (v2.0.0)
 * 
 * Performs multi-vector retrieval across raw Codebase Chunks, PR History,
 * and extracted Architectural Decisions to answer engineering questions.
 */

import type { StorageBackend } from '../storage/interface.js'
import type { EmbeddingPipeline } from '../embeddingPipeline.js'
import type { CodeChunk } from './astChunker.js'
import type { ArchitecturalDecision } from '../edm/comments.js'
import type { PRRecord } from '../storage/interface.js'

export interface RAGQueryContext {
    codeChunks: Array<CodeChunk & { score: number }>
    decisions: ArchitecturalDecision[]
    prs: PRRecord[]
}

export interface RAGResponse {
    answer?: string // Will be populated if an LLM is connected
    context: RAGQueryContext
}

export interface QueryOptions {
    limitCode?: number
    limitDecisions?: number
    limitPRs?: number
}

/**
 * Interface for connecting an LLM to synthesize the final answer.
 */
export interface LLMProvider {
    generate(prompt: string): Promise<string>
}

export class RAGQueryEngine {
    constructor(
        private storage: StorageBackend,
        private pipeline: EmbeddingPipeline,
        private llmProvider?: LLMProvider
    ) { }

    /**
     * Query the engineering intelligence system.
     */
    async query(question: string, opts: QueryOptions = {}): Promise<RAGResponse> {
        // 1. Embed the user's question
        const { textEmbedding } = await this.pipeline.run(question, '', '')

        // 2. Perform parallel retrieval across the 3 vector domains
        const limitCode = opts.limitCode || 5
        const limitDecisions = opts.limitDecisions || 3
        const limitPRs = opts.limitPRs || 3

        const [chunks, decisions, prMatches] = await Promise.all([
            this.storage.searchChunks ? this.storage.searchChunks(textEmbedding, limitCode) : Promise.resolve([]),
            this.storage.searchDecisions ? this.storage.searchDecisions(textEmbedding, limitDecisions) : Promise.resolve([]),
            this.storage.search(textEmbedding, limitPRs)
        ])

        // 3. Hydrate PR records
        const prs: PRRecord[] = []
        for (const match of prMatches) {
            const pr = await this.storage.get(match.prId)
            if (pr) prs.push(pr)
        }

        const context: RAGQueryContext = {
            codeChunks: chunks,
            decisions,
            prs
        }

        // 4. If no LLM configured, just return the retrieved context for the dashboard/UI to handle
        if (!this.llmProvider) {
            return { context }
        }

        // 5. Synthesize final answer using the connected LLM
        const prompt = this.buildPrompt(question, context)
        const answer = await this.llmProvider.generate(prompt)

        return { answer, context }
    }

    private buildPrompt(question: string, context: RAGQueryContext): string {
        let prompt = `You are an expert Principal Engineer AI. Answer the following engineering question based ONLY on the provided context.\n\n`
        prompt += `QUESTION: ${question}\n\n`

        if (context.decisions.length > 0) {
            prompt += `--- ARCHITECTURAL DECISIONS (WHY) ---\n`
            for (const d of context.decisions) {
                prompt += `[Author: ${d.author}]: ${d.summary}\n${d.fullText}\n\n`
            }
        }

        if (context.codeChunks.length > 0) {
            prompt += `--- CURRENT CODEBASE (HOW IT WORKS NOW) ---\n`
            for (const c of context.codeChunks) {
                prompt += `File: ${c.filePath} (Lines ${c.startLine}-${c.endLine})\nSymbol: ${c.name} (${c.type})\n\`\`\`\n${c.content}\n\`\`\`\n\n`
            }
        }

        if (context.prs.length > 0) {
            prompt += `--- RELATED PULL REQUESTS (HISTORY) ---\n`
            for (const pr of context.prs) {
                prompt += `PR #${pr.prId}: ${pr.title}\nDescription: ${pr.description}\nFiles changed: ${pr.files.slice(0, 5).join(', ')}${pr.files.length > 5 ? '...' : ''}\n\n`
            }
        }

        prompt += `INSTRUCTIONS:\n- Synthesize the "why" (Decisions/PRs) and the "how" (Codebase).\n- Cite files and PR numbers in your response.\n- If the context doesn't contain the answer, say "I don't have enough context to answer that."`

        return prompt
    }
}

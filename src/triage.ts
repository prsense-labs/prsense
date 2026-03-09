/**
 * Smart Triage & Auto-Labeling (v1.1.0)
 * 
 * Classifies PRs as bug/feature/refactor/docs/test/chore using
 * keyword signals + embedding similarity against reference vectors.
 * Also suggests reviewers based on file-ownership history.
 */

import type { Embedder } from './embeddingPipeline.js'
import { cosine } from './similarity.js'

// ─── Types ───────────────────────────────────────────────────────

export type PRLabel = 'bug' | 'feature' | 'refactor' | 'docs' | 'test' | 'chore'

export interface TriageResult {
    label: PRLabel
    confidence: number
    /** Secondary label if close in confidence */
    secondaryLabel?: PRLabel
    secondaryConfidence?: number
    /** Suggested reviewers based on file ownership */
    suggestedReviewers: ReviewerSuggestion[]
}

export interface ReviewerSuggestion {
    author: string
    /** Number of PRs touching these files */
    fileOwnership: number
    /** Relevance score 0-1 */
    relevance: number
}

export interface TriagePRInput {
    title: string
    description: string
    files: string[]
    diff?: string
    author?: string
}

// ─── Keyword Patterns ────────────────────────────────────────────

const KEYWORD_PATTERNS: Record<PRLabel, RegExp[]> = {
    bug: [
        /\bfix(es|ed|ing)?\b/i,
        /\bbug(s|fix)?\b/i,
        /\berror\b/i,
        /\bcrash(es|ed|ing)?\b/i,
        /\bpatch\b/i,
        /\bhotfix\b/i,
        /\bregression\b/i,
        /\bissue\b/i,
        /\bresolve[sd]?\b/i,
        /\bbroken\b/i,
    ],
    feature: [
        /\badd(s|ed|ing)?\b/i,
        /\bnew\b/i,
        /\bfeat(ure)?s?\b/i,
        /\bimplement(s|ed|ing|ation)?\b/i,
        /\bintroduc(e|es|ed|ing)\b/i,
        /\bsupport\b/i,
        /\benhance(ment)?s?\b/i,
    ],
    refactor: [
        /\brefactor(s|ed|ing)?\b/i,
        /\brename[sd]?\b/i,
        /\bcleanup\b/i,
        /\brestructur(e|es|ed|ing)\b/i,
        /\bsimplif(y|ies|ied|ying)\b/i,
        /\bextract(s|ed|ing)?\b/i,
        /\bmov(e|es|ed|ing)\b/i,
        /\breorganiz(e|es|ed|ing)\b/i,
    ],
    docs: [
        /\bdoc(s|umentation)?\b/i,
        /\breadme\b/i,
        /\bchangelog\b/i,
        /\bcomment(s|ed|ing)?\b/i,
        /\btypedoc\b/i,
        /\bjsdoc\b/i,
        /\b(api|usage)\s+guide\b/i,
    ],
    test: [
        /\btest(s|ing|ed)?\b/i,
        /\bspec(s)?\b/i,
        /\bcoverage\b/i,
        /\bmock(s|ed|ing)?\b/i,
        /\bfixture(s)?\b/i,
        /\be2e\b/i,
        /\bunit\s+test\b/i,
        /\bintegration\s+test\b/i,
    ],
    chore: [
        /\bchore\b/i,
        /\bdep(endenc(y|ies))?\s*(bump|updat|upgrad)/i,
        /\bbump(s|ed|ing)?\b/i,
        /\bci\b/i,
        /\bcd\b/i,
        /\bpipeline\b/i,
        /\blint(er|ing)?\b/i,
        /\bconfig(uration)?\b/i,
        /\bformat(ting)?\b/i,
    ],
}

/** File extension hints for classification */
const FILE_EXTENSION_HINTS: Record<string, PRLabel> = {
    '.md': 'docs',
    '.mdx': 'docs',
    '.txt': 'docs',
    '.test.ts': 'test',
    '.test.js': 'test',
    '.spec.ts': 'test',
    '.spec.js': 'test',
    '.test.tsx': 'test',
    '.test.jsx': 'test',
}

/** Reference descriptions per label (used for embedding similarity) */
const REFERENCE_DESCRIPTIONS: Record<PRLabel, string> = {
    bug: 'Fix a bug, resolve an error, patch a crash, handle edge case failure',
    feature: 'Add a new feature, implement new functionality, introduce a new capability',
    refactor: 'Refactor code, restructure modules, clean up architecture, rename variables',
    docs: 'Update documentation, improve README, add code comments, write guides',
    test: 'Add unit tests, write integration tests, improve test coverage, add test fixtures',
    chore: 'Update dependencies, bump versions, configure CI/CD pipeline, update linter config',
}

// ─── File Ownership Tracker ──────────────────────────────────────

export class FileOwnershipTracker {
    /** Map of file path → Map of author → touch count */
    private ownership: Map<string, Map<string, number>> = new Map()

    /**
     * Record that an author touched certain files
     */
    recordPR(author: string, files: string[]): void {
        for (const file of files) {
            // Track by directory too for broader matching
            const dir = file.includes('/') ? file.substring(0, file.lastIndexOf('/')) : ''

            this.incrementOwnership(file, author)
            if (dir) {
                this.incrementOwnership(dir + '/*', author)
            }
        }
    }

    private incrementOwnership(path: string, author: string): void {
        if (!this.ownership.has(path)) {
            this.ownership.set(path, new Map())
        }
        const authors = this.ownership.get(path)!
        authors.set(author, (authors.get(author) || 0) + 1)
    }

    /**
     * Suggest reviewers for the given files
     */
    suggestReviewers(files: string[], excludeAuthor?: string, limit: number = 3): ReviewerSuggestion[] {
        const authorScores = new Map<string, { ownership: number; fileMatches: number }>()

        for (const file of files) {
            // Check exact file match
            const fileAuthors = this.ownership.get(file)
            if (fileAuthors) {
                for (const [author, count] of fileAuthors) {
                    if (author === excludeAuthor) continue
                    if (!authorScores.has(author)) {
                        authorScores.set(author, { ownership: 0, fileMatches: 0 })
                    }
                    const entry = authorScores.get(author)!
                    entry.ownership += count
                    entry.fileMatches += 1
                }
            }

            // Check directory match
            const dir = file.includes('/') ? file.substring(0, file.lastIndexOf('/')) : ''
            if (dir) {
                const dirAuthors = this.ownership.get(dir + '/*')
                if (dirAuthors) {
                    for (const [author, count] of dirAuthors) {
                        if (author === excludeAuthor) continue
                        if (!authorScores.has(author)) {
                            authorScores.set(author, { ownership: 0, fileMatches: 0 })
                        }
                        const entry = authorScores.get(author)!
                        entry.ownership += count * 0.5 // Directory match weighs less
                        entry.fileMatches += 0.5
                    }
                }
            }
        }

        // Convert to suggestions sorted by relevance
        const suggestions: ReviewerSuggestion[] = []
        for (const [author, scores] of authorScores) {
            const relevance = Math.min(1.0, (scores.fileMatches / files.length) * 0.6 + Math.min(scores.ownership / 10, 1) * 0.4)
            suggestions.push({
                author,
                fileOwnership: Math.round(scores.ownership),
                relevance: Math.round(relevance * 100) / 100,
            })
        }

        return suggestions
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, limit)
    }

    /**
     * Export ownership data for persistence
     */
    exportState(): Record<string, Record<string, number>> {
        const state: Record<string, Record<string, number>> = {}
        for (const [path, authors] of this.ownership) {
            state[path] = Object.fromEntries(authors)
        }
        return state
    }

    /**
     * Import ownership data from persistence
     */
    importState(state: Record<string, Record<string, number>>): void {
        for (const [path, authors] of Object.entries(state)) {
            this.ownership.set(path, new Map(Object.entries(authors)))
        }
    }
}

// ─── PR Triage Classifier ────────────────────────────────────────

export class PRTriageClassifier {
    private embedder: Embedder | undefined
    private referenceEmbeddings?: Map<PRLabel, Float32Array>
    private ownershipTracker: FileOwnershipTracker

    constructor(options?: { embedder?: Embedder; ownershipTracker?: FileOwnershipTracker }) {
        this.embedder = options?.embedder
        this.ownershipTracker = options?.ownershipTracker || new FileOwnershipTracker()
    }

    /**
     * Initialize reference embeddings for semantic classification.
     * Call once before using semantic mode.
     */
    async initEmbeddings(): Promise<void> {
        if (!this.embedder) return

        this.referenceEmbeddings = new Map()
        const labels = Object.keys(REFERENCE_DESCRIPTIONS) as PRLabel[]

        for (const label of labels) {
            const embedding = await this.embedder.embedText(REFERENCE_DESCRIPTIONS[label])
            this.referenceEmbeddings.set(label, embedding)
        }
    }

    /**
     * Classify a PR and suggest reviewers
     */
    async classify(pr: TriagePRInput): Promise<TriageResult> {
        // 1. Keyword-based fast path
        const keywordScores = this.scoreByKeywords(pr)

        // 2. File extension hints
        const fileHintScores = this.scoreByFileExtensions(pr.files)

        // 3. Semantic embedding (if embedder available)
        let embeddingScores: Record<PRLabel, number> = {} as Record<PRLabel, number>
        if (this.embedder && this.referenceEmbeddings) {
            embeddingScores = await this.scoreByEmbedding(pr)
        }

        // 4. Combine scores (keyword 50%, embedding 30%, file hints 20%)
        const hasEmbedding = Object.keys(embeddingScores).length > 0
        const combinedScores: Record<PRLabel, number> = {} as Record<PRLabel, number>
        const labels = Object.keys(KEYWORD_PATTERNS) as PRLabel[]

        for (const label of labels) {
            const kw = keywordScores[label] || 0
            const fh = fileHintScores[label] || 0
            const em = embeddingScores[label] || 0

            if (hasEmbedding) {
                combinedScores[label] = kw * 0.50 + em * 0.30 + fh * 0.20
            } else {
                combinedScores[label] = kw * 0.65 + fh * 0.35
            }
        }

        // 5. Pick top two labels
        const sorted = labels
            .map(l => ({ label: l, score: combinedScores[l] }))
            .sort((a, b) => b.score - a.score)

        const bestLabel = sorted[0]!.score > 0 ? sorted[0]!.label : 'chore'
        const bestConfidence = Math.min(1.0, sorted[0]!.score)

        // 6. Suggest reviewers
        const suggestedReviewers = this.ownershipTracker.suggestReviewers(
            pr.files,
            pr.author,
            3
        )

        const result: TriageResult = {
            label: bestLabel,
            confidence: Math.round(bestConfidence * 100) / 100,
            suggestedReviewers,
        }

        // Add secondary label if close enough
        if (sorted.length > 1 && sorted[1]!.score > 0.3 && sorted[1]!.score >= sorted[0]!.score * 0.5) {
            result.secondaryLabel = sorted[1]!.label
            result.secondaryConfidence = Math.round(Math.min(1.0, sorted[1]!.score) * 100) / 100
        }

        return result
    }

    /**
     * Record a PR for file ownership tracking
     */
    recordPR(author: string, files: string[]): void {
        this.ownershipTracker.recordPR(author, files)
    }

    /**
     * Get the ownership tracker for export/import
     */
    getOwnershipTracker(): FileOwnershipTracker {
        return this.ownershipTracker
    }

    // ── Private scoring methods ──

    private scoreByKeywords(pr: TriagePRInput): Record<PRLabel, number> {
        const text = `${pr.title} ${pr.description}`
        const scores: Record<PRLabel, number> = {} as Record<PRLabel, number>

        for (const [label, patterns] of Object.entries(KEYWORD_PATTERNS)) {
            let matchCount = 0
            for (const pattern of patterns) {
                if (pattern.test(text)) matchCount++
            }
            // Normalize: more matches = higher confidence, capped at 1.0
            scores[label as PRLabel] = Math.min(1.0, matchCount / 3)
        }

        return scores
    }

    private scoreByFileExtensions(files: string[]): Record<PRLabel, number> {
        const scores: Record<PRLabel, number> = {} as Record<PRLabel, number>
        const labels = Object.keys(KEYWORD_PATTERNS) as PRLabel[]
        for (const l of labels) scores[l] = 0

        if (files.length === 0) return scores

        let matchCount = 0
        const labelCounts: Record<PRLabel, number> = {} as Record<PRLabel, number>
        for (const l of labels) labelCounts[l] = 0

        for (const file of files) {
            for (const [ext, label] of Object.entries(FILE_EXTENSION_HINTS)) {
                if (file.endsWith(ext)) {
                    labelCounts[label]++
                    matchCount++
                }
            }
        }

        if (matchCount > 0) {
            for (const label of labels) {
                scores[label] = labelCounts[label] / files.length
            }
        }

        return scores
    }

    private async scoreByEmbedding(pr: TriagePRInput): Promise<Record<PRLabel, number>> {
        if (!this.embedder || !this.referenceEmbeddings) {
            return {} as Record<PRLabel, number>
        }

        const text = `${pr.title}\n${pr.description}`
        const prEmbedding = await this.embedder.embedText(text)
        const scores: Record<PRLabel, number> = {} as Record<PRLabel, number>

        for (const [label, refEmbedding] of this.referenceEmbeddings) {
            scores[label] = Math.max(0, cosine(prEmbedding, refEmbedding))
        }

        return scores
    }
}

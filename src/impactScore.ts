/**
 * PR Impact Score (v1.1.0)
 * 
 * Scores PRs by risk using multiple factors:
 * - Diff size (lines added/removed)
 * - File churn (files changed frequently in past PRs)
 * - Author experience (familiarity with touched files)
 * - Blast radius (number of files + cross-module changes)
 * - Historical failures (files that were reverted/had follow-up fixes)
 */

// ─── Types ───────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface ImpactFactor {
    name: string
    score: number      // 0-10
    weight: number     // 0-1, how much this factor contributes
    description: string
}

export interface ImpactResult {
    /** Overall impact score 1-10 */
    score: number
    /** Risk classification */
    riskLevel: RiskLevel
    /** Individual factor breakdowns */
    factors: ImpactFactor[]
    /** Human-readable summary */
    summary: string
}

export interface ImpactPRInput {
    title: string
    description: string
    files: string[]
    diff?: string
    linesAdded?: number
    linesRemoved?: number
    author?: string
}

// ─── Historical Data Tracker ─────────────────────────────────────

export class HistoricalTracker {
    /** File → number of times it appeared in PRs */
    private fileChurn: Map<string, number> = new Map()
    /** File → number of times PRs touching it were reverted or had fixes */
    private fileFailures: Map<string, number> = new Map()
    /** Author → Set of files they've touched */
    private authorFiles: Map<string, Set<string>> = new Map()
    /** Total PRs recorded */
    private totalPRs: number = 0

    /**
     * Record a PR for historical tracking
     */
    recordPR(author: string, files: string[], wasReverted: boolean = false): void {
        this.totalPRs++

        for (const file of files) {
            this.fileChurn.set(file, (this.fileChurn.get(file) || 0) + 1)

            if (wasReverted) {
                this.fileFailures.set(file, (this.fileFailures.get(file) || 0) + 1)
            }
        }

        if (!this.authorFiles.has(author)) {
            this.authorFiles.set(author, new Set())
        }
        for (const file of files) {
            this.authorFiles.get(author)!.add(file)
        }
    }

    /**
     * Record that a file had a follow-up fix (indicates original PR was risky)
     */
    recordFailure(files: string[]): void {
        for (const file of files) {
            this.fileFailures.set(file, (this.fileFailures.get(file) || 0) + 1)
        }
    }

    /**
     * Get churn count for a file (how often it's been changed)
     */
    getFileChurn(file: string): number {
        return this.fileChurn.get(file) || 0
    }

    /**
     * Get failure count for a file
     */
    getFileFailures(file: string): number {
        return this.fileFailures.get(file) || 0
    }

    /**
     * Check how many of the given files an author has previously touched
     */
    getAuthorFamiliarity(author: string, files: string[]): number {
        const authorFileSet = this.authorFiles.get(author)
        if (!authorFileSet || files.length === 0) return 0

        let familiar = 0
        for (const file of files) {
            if (authorFileSet.has(file)) familiar++
        }
        return familiar / files.length
    }

    /**
     * Get average churn across all tracked files
     */
    getAverageChurn(): number {
        if (this.fileChurn.size === 0) return 0
        let total = 0
        for (const count of this.fileChurn.values()) total += count
        return total / this.fileChurn.size
    }

    getTotalPRs(): number {
        return this.totalPRs
    }

    /**
     * Export for persistence
     */
    exportState(): {
        fileChurn: Record<string, number>
        fileFailures: Record<string, number>
        authorFiles: Record<string, string[]>
        totalPRs: number
    } {
        const authorFiles: Record<string, string[]> = {}
        for (const [author, files] of this.authorFiles) {
            authorFiles[author] = Array.from(files)
        }
        return {
            fileChurn: Object.fromEntries(this.fileChurn),
            fileFailures: Object.fromEntries(this.fileFailures),
            authorFiles,
            totalPRs: this.totalPRs,
        }
    }

    /**
     * Import from persistence
     */
    importState(state: {
        fileChurn: Record<string, number>
        fileFailures: Record<string, number>
        authorFiles: Record<string, string[]>
        totalPRs: number
    }): void {
        this.fileChurn = new Map(Object.entries(state.fileChurn))
        this.fileFailures = new Map(Object.entries(state.fileFailures))
        this.authorFiles = new Map()
        for (const [author, files] of Object.entries(state.authorFiles)) {
            this.authorFiles.set(author, new Set(files))
        }
        this.totalPRs = state.totalPRs
    }
}

// ─── Impact Scorer ───────────────────────────────────────────────

export class ImpactScorer {
    private history: HistoricalTracker

    constructor(history?: HistoricalTracker) {
        this.history = history || new HistoricalTracker()
    }

    /**
     * Score the impact/risk of a PR
     */
    score(pr: ImpactPRInput): ImpactResult {
        const factors: ImpactFactor[] = []

        // Factor 1: Diff Size
        factors.push(this.scoreDiffSize(pr))

        // Factor 2: Blast Radius
        factors.push(this.scoreBlastRadius(pr))

        // Factor 3: File Churn (hot files)
        factors.push(this.scoreFileChurn(pr))

        // Factor 4: Author Experience
        factors.push(this.scoreAuthorExperience(pr))

        // Factor 5: Historical Failures
        factors.push(this.scoreHistoricalFailures(pr))

        // Calculate weighted average
        let totalWeight = 0
        let weightedSum = 0
        for (const factor of factors) {
            weightedSum += factor.score * factor.weight
            totalWeight += factor.weight
        }

        const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 1
        const finalScore = Math.max(1, Math.min(10, Math.round(rawScore)))

        const riskLevel = this.classifyRisk(finalScore)
        const summary = this.generateSummary(finalScore, riskLevel, factors)

        return {
            score: finalScore,
            riskLevel,
            factors,
            summary,
        }
    }

    /**
     * Record a PR for building historical data
     */
    recordPR(author: string, files: string[], wasReverted: boolean = false): void {
        this.history.recordPR(author, files, wasReverted)
    }

    /**
     * Record a file failure (revert or follow-up fix)
     */
    recordFailure(files: string[]): void {
        this.history.recordFailure(files)
    }

    /**
     * Get the history tracker for export/import
     */
    getHistory(): HistoricalTracker {
        return this.history
    }

    // ── Scoring Factors ──

    private scoreDiffSize(pr: ImpactPRInput): ImpactFactor {
        const linesChanged = (pr.linesAdded || 0) + (pr.linesRemoved || 0)

        // Estimate from diff if line counts not provided
        const effectiveLines = linesChanged > 0
            ? linesChanged
            : (pr.diff?.split('\n').length || 0)

        let score: number
        if (effectiveLines <= 10) score = 1
        else if (effectiveLines <= 50) score = 2
        else if (effectiveLines <= 100) score = 3
        else if (effectiveLines <= 200) score = 4
        else if (effectiveLines <= 300) score = 5
        else if (effectiveLines <= 500) score = 6
        else if (effectiveLines <= 750) score = 7
        else if (effectiveLines <= 1000) score = 8
        else if (effectiveLines <= 2000) score = 9
        else score = 10

        return {
            name: 'Diff Size',
            score,
            weight: 0.25,
            description: `${effectiveLines} lines changed`,
        }
    }

    private scoreBlastRadius(pr: ImpactPRInput): ImpactFactor {
        const fileCount = pr.files.length

        // Count unique directories (modules)
        const dirs = new Set<string>()
        for (const file of pr.files) {
            const parts = file.split('/')
            if (parts.length > 1) {
                dirs.add(parts.slice(0, -1).join('/'))
            }
        }
        const moduleCount = dirs.size

        let score: number
        if (fileCount <= 1) score = 1
        else if (fileCount <= 3) score = 2
        else if (fileCount <= 5) score = 3
        else if (fileCount <= 8) score = 4
        else if (fileCount <= 12) score = 5
        else if (fileCount <= 20) score = 6
        else if (fileCount <= 30) score = 7
        else if (fileCount <= 50) score = 8
        else score = 9

        // Cross-module penalty: touching many modules is riskier
        if (moduleCount > 3) score = Math.min(10, score + 1)
        if (moduleCount > 6) score = Math.min(10, score + 1)

        return {
            name: 'Blast Radius',
            score,
            weight: 0.25,
            description: `${fileCount} files across ${moduleCount} modules`,
        }
    }

    private scoreFileChurn(pr: ImpactPRInput): ImpactFactor {
        if (pr.files.length === 0) {
            return { name: 'File Churn', score: 1, weight: 0.20, description: 'No files to analyze' }
        }

        const avgChurn = this.history.getAverageChurn()
        let totalChurn = 0
        let hotFiles = 0

        for (const file of pr.files) {
            const churn = this.history.getFileChurn(file)
            totalChurn += churn
            if (avgChurn > 0 && churn > avgChurn * 2) {
                hotFiles++
            }
        }

        const avgFileChurn = totalChurn / pr.files.length

        let score: number
        if (avgFileChurn <= 1) score = 1
        else if (avgFileChurn <= 3) score = 2
        else if (avgFileChurn <= 5) score = 3
        else if (avgFileChurn <= 8) score = 5
        else if (avgFileChurn <= 12) score = 7
        else score = 9

        // Hot files penalty
        if (hotFiles > 0) score = Math.min(10, score + 1)

        return {
            name: 'File Churn',
            score,
            weight: 0.20,
            description: hotFiles > 0
                ? `${hotFiles} hot file(s) — frequently changed`
                : `Average churn: ${avgFileChurn.toFixed(1)} changes per file`,
        }
    }

    private scoreAuthorExperience(pr: ImpactPRInput): ImpactFactor {
        if (!pr.author) {
            return { name: 'Author Experience', score: 5, weight: 0.15, description: 'Author unknown' }
        }

        const familiarity = this.history.getAuthorFamiliarity(pr.author, pr.files)

        // Higher familiarity = LOWER risk
        let score: number
        if (familiarity >= 0.8) score = 1
        else if (familiarity >= 0.6) score = 2
        else if (familiarity >= 0.4) score = 3
        else if (familiarity >= 0.2) score = 5
        else if (familiarity > 0) score = 7
        else score = 8 // Never touched these files before

        return {
            name: 'Author Experience',
            score,
            weight: 0.15,
            description: familiarity > 0
                ? `Author familiar with ${Math.round(familiarity * 100)}% of files`
                : 'First-time contributor to these files',
        }
    }

    private scoreHistoricalFailures(pr: ImpactPRInput): ImpactFactor {
        let totalFailures = 0

        for (const file of pr.files) {
            totalFailures += this.history.getFileFailures(file)
        }

        let score: number
        if (totalFailures === 0) score = 1
        else if (totalFailures <= 1) score = 3
        else if (totalFailures <= 3) score = 5
        else if (totalFailures <= 5) score = 7
        else score = 9

        return {
            name: 'Historical Failures',
            score,
            weight: 0.15,
            description: totalFailures > 0
                ? `${totalFailures} past revert(s) or follow-up fix(es) in these files`
                : 'No known failures in these files',
        }
    }

    // ── Helpers ──

    private classifyRisk(score: number): RiskLevel {
        if (score <= 3) return 'low'
        if (score <= 5) return 'medium'
        if (score <= 7) return 'high'
        return 'critical'
    }

    private generateSummary(score: number, riskLevel: RiskLevel, factors: ImpactFactor[]): string {
        const topFactors = factors
            .filter(f => f.score >= 6)
            .sort((a, b) => b.score - a.score)
            .slice(0, 2)

        const riskEmoji = {
            low: '🟢',
            medium: '🟡',
            high: '🟠',
            critical: '🔴',
        }

        let summary = `${riskEmoji[riskLevel]} Impact: ${score}/10 (${riskLevel.toUpperCase()})`

        if (topFactors.length > 0) {
            const reasons = topFactors.map(f => f.description).join('; ')
            summary += ` — ${reasons}`
        }

        return summary
    }
}

/**
 * Cross-Repository Detection (Feature 8)
 * 
 * Detect duplicate PRs across multiple repositories in an organization
 */

import type { PRInput, DetectionResult, PRSenseConfig, DetailedDetectionResult, CheckOptions } from './prsense.js'
import { PRSenseDetector } from './prsense.js'

/**
 * Repository configuration for cross-repo detection
 */
export interface RepoConfig {
    /** Unique repository identifier (e.g., 'org/repo-name') */
    repoId: string
    /** Human-readable repository name */
    name: string
    /** Optional: Repository URL */
    url?: string
}

/**
 * Cross-repo PR input includes repository information
 */
export interface CrossRepoPRInput extends PRInput {
    /** Repository this PR belongs to */
    repoId: string
}

/**
 * Cross-repo detection result includes source repository
 */
export interface CrossRepoDetectionResult {
    type: 'DUPLICATE' | 'POSSIBLE' | 'UNIQUE'
    confidence: number
    /** Original PR ID if duplicate/possible */
    originalPr?: number
    /** Repository of the original PR */
    originalRepo?: string
    /** Whether the duplicate is in a different repository */
    isCrossRepo: boolean
}

/**
 * Cross-Repository Detector
 * 
 * Manages multiple repository indices for organization-wide duplicate detection
 */
export class CrossRepoDetector {
    private detectors: Map<string, PRSenseDetector>
    private repos: Map<string, RepoConfig>
    private sharedConfig: Omit<PRSenseConfig, 'repoId'>

    constructor(config: PRSenseConfig) {
        this.detectors = new Map()
        this.repos = new Map()
        this.sharedConfig = config
    }

    /**
     * Register a repository for cross-repo detection
     */
    addRepository(repo: RepoConfig): void {
        if (!this.detectors.has(repo.repoId)) {
            this.detectors.set(repo.repoId, new PRSenseDetector({
                ...this.sharedConfig,
                repoId: repo.repoId
            }))
        }
        this.repos.set(repo.repoId, repo)
    }

    /**
     * Check PR for duplicates across ALL registered repositories
     */
    async check(pr: CrossRepoPRInput, options?: CheckOptions): Promise<CrossRepoDetectionResult> {
        let bestResult: CrossRepoDetectionResult = {
            type: 'UNIQUE',
            confidence: 0,
            isCrossRepo: false
        }

        // First, check within the PR's own repository
        const ownDetector = this.detectors.get(pr.repoId)
        if (ownDetector) {
            const ownResult = await ownDetector.checkDetailed(pr, { ...options, dryRun: true })
            if (ownResult.type !== 'UNIQUE' && ownResult.confidence > bestResult.confidence) {
                bestResult = {
                    type: ownResult.type,
                    confidence: ownResult.confidence,
                    originalPr: ownResult.originalPr,
                    originalRepo: pr.repoId,
                    isCrossRepo: false
                }
            }
        }

        // Then check across other repositories
        for (const [repoId, detector] of this.detectors.entries()) {
            if (repoId === pr.repoId) continue // Skip own repo

            // Use a large offset to avoid ID collisions across repos.
            // We XOR a djb2-style hash of the repoId with a large prime offset,
            // then ensure the result stays positive and within safe integer range.
            let repoHash = 5381
            for (let ci = 0; ci < repoId.length; ci++) {
                repoHash = ((repoHash << 5) + repoHash) ^ repoId.charCodeAt(ci)
                repoHash = repoHash >>> 0 // keep as unsigned 32-bit
            }
            // Offset by 10^9 * (repoHash % 1000) to give a large, repo-specific namespace
            const tempPrId = pr.prId + 1_000_000_000 + (repoHash % 1000) * 1_000_000

            const result = await detector.checkDetailed(
                { ...pr, prId: tempPrId }, // Use offset ID to avoid collisions
                { ...options, dryRun: true }
            )

            if (result.type !== 'UNIQUE' && result.confidence > bestResult.confidence) {
                bestResult = {
                    type: result.type,
                    confidence: result.confidence,
                    originalPr: result.originalPr,
                    originalRepo: repoId,
                    isCrossRepo: true
                }
            }
        }

        // Now index the PR in its own repository (unless dry-run)
        if (!options?.dryRun && ownDetector) {
            await ownDetector.check(pr, options)
        }

        return bestResult
    }

    /**
     * Get all registered repositories
     */
    getRepositories(): RepoConfig[] {
        return Array.from(this.repos.values())
    }

    /**
     * Get statistics across all repositories
     */
    getStats() {
        const repoStats: Record<string, ReturnType<PRSenseDetector['getStats']>> = {}
        let totalPRs = 0
        let totalDuplicatePairs = 0

        for (const [repoId, detector] of this.detectors.entries()) {
            const stats = detector.getStats()
            repoStats[repoId] = stats
            totalPRs += stats.totalPRs
            totalDuplicatePairs += stats.duplicatePairs
        }

        return {
            repositories: this.repos.size,
            totalPRs,
            totalDuplicatePairs,
            repoStats
        }
    }

    /**
     * Export all detector states for persistence
     */
    exportState(): Record<string, ReturnType<PRSenseDetector['exportState']>> {
        const state: Record<string, ReturnType<PRSenseDetector['exportState']>> = {}
        for (const [repoId, detector] of this.detectors.entries()) {
            state[repoId] = detector.exportState()
        }
        return state
    }

    /**
     * Import detector states from persistence
     */
    importState(state: Record<string, ReturnType<PRSenseDetector['exportState']>>): void {
        for (const [repoId, data] of Object.entries(state)) {
            if (!this.detectors.has(repoId)) {
                this.addRepository({ repoId, name: repoId })
            }
            this.detectors.get(repoId)?.importState(data)
        }
    }
}

/**
 * Create cross-repo detector with common configuration
 */
export function createCrossRepoDetector(config: PRSenseConfig): CrossRepoDetector {
    return new CrossRepoDetector(config)
}

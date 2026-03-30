/**
 * Git Provider Abstraction (v1.1.0)
 * 
 * Allows PRSense to operate across GitHub, GitLab, and Bitbucket.
 */

export interface PRMetadata {
    id: number | string
    title: string
    description: string
    author: string
    url: string
    baseRepo: string
    headRepo: string
    status: 'open' | 'closed' | 'merged'
    createdAt: string
    updatedAt: string
}

export interface PRFiles {
    files: string[]
    linesAdded: number
    linesRemoved: number
}

export interface GitProvider {
    /** 
     * Extract normalized PR metadata from a webhook event payload.
     * Returns null if the event is not a PR event or should be ignored.
     */
    parseWebhook(event: any, headers: Record<string, string>): Promise<PRMetadata | null>

    /** Verify the webhook signature against the configured secret */
    verifySignature(payload: string, signature: string): boolean

    /** Fetch the list of files changed in a PR */
    fetchFiles(prId: number | string, repo: string): Promise<string[]>

    /** Fetch the raw patch/diff of a PR */
    fetchDiff(prId: number | string, repo: string): Promise<string>

    /** Post a comment to the PR */
    postComment(prId: number | string, repo: string, body: string): Promise<void>

    /** Add a label (or tag) to the PR */
    addLabel(prId: number | string, repo: string, label: string): Promise<void>

    /** Request specific reviewers for the PR */
    requestReviewers(prId: number | string, repo: string, reviewers: string[]): Promise<void>

    /** Fetch all comments and review discussions from the PR */
    fetchComments?(prId: number | string, repo: string): Promise<import('../edm/comments.js').PRComment[]>
}

export interface ProviderConfig {
    token: string
    webhookSecret: string
    apiUrl?: string // For enterprise endpoints
}

export class ProviderError extends Error {
    constructor(message: string, public readonly status?: number) {
        super(message)
        this.name = 'ProviderError'
    }
}

// ─── Re-exports & Factory ────────────────────────────────────────

import { GitHubProvider } from './github.js'
import { GitLabProvider } from './gitlab.js'
import { BitbucketProvider } from './bitbucket.js'

export type ProviderType = 'github' | 'gitlab' | 'bitbucket'

export function createProvider(type: ProviderType, config: ProviderConfig): GitProvider {
    switch (type) {
        case 'github':
            return new GitHubProvider(config)
        case 'gitlab':
            return new GitLabProvider(config)
        case 'bitbucket':
            return new BitbucketProvider(config)
        default:
            throw new Error(`Unsupported provider type: ${type}`)
    }
}

export { GitHubProvider, GitLabProvider, BitbucketProvider }

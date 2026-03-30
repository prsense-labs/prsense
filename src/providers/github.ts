/**
 * GitHub Provider Implementation (v1.1.0)
 */

import { createHmac, timingSafeEqual } from 'crypto'
import type { GitProvider, PRMetadata, ProviderConfig } from './index.js'
import { ProviderError } from './index.js'

export class GitHubProvider implements GitProvider {
    private config: ProviderConfig
    private baseUrl: string

    constructor(config: ProviderConfig) {
        this.config = config
        this.baseUrl = config.apiUrl || 'https://api.github.com'
    }

    verifySignature(payload: string, signature: string): boolean {
        if (!this.config.webhookSecret || !signature) return false

        try {
            const hmac = createHmac('sha256', this.config.webhookSecret)
            const digest = Buffer.from('sha256=' + hmac.update(payload).digest('hex'), 'utf8')
            const checksum = Buffer.from(signature, 'utf8')

            if (digest.length !== checksum.length) return false
            return timingSafeEqual(digest, checksum)
        } catch {
            return false
        }
    }

    async parseWebhook(event: any, headers: Record<string, string>): Promise<PRMetadata | null> {
        const githubEvent = headers['x-github-event']
        if (githubEvent !== 'pull_request') return null

        const action = event.action
        if (action !== 'opened' && action !== 'synchronize') return null

        const pr = event.pull_request
        if (!pr) return null

        return {
            id: pr.number,
            title: pr.title,
            description: pr.body || '',
            author: pr.user?.login || 'unknown',
            url: pr.html_url,
            baseRepo: pr.base?.repo?.full_name || '',
            headRepo: pr.head?.repo?.full_name || '',
            status: pr.state,
            createdAt: pr.created_at,
            updatedAt: pr.updated_at,
        }
    }

    async fetchFiles(prId: number | string, repo: string): Promise<string[]> {
        const url = `${this.baseUrl}/repos/${repo}/pulls/${prId}/files`
        try {
            const response = await fetch(url, {
                headers: this.getHeaders()
            })

            if (!response.ok) {
                throw new ProviderError(`GitHub API error: ${response.status}`, response.status)
            }

            const files = await response.json() as any[]
            return files.map((f: any) => f.filename)
        } catch (error) {
            if (error instanceof ProviderError) throw error
            throw new ProviderError('Failed to fetch files from GitHub')
        }
    }

    async fetchDiff(prId: number | string, repo: string): Promise<string> {
        const url = `${this.baseUrl}/repos/${repo}/pulls/${prId}`
        try {
            const response = await fetch(url, {
                headers: {
                    ...this.getHeaders(),
                    'Accept': 'application/vnd.github.v3.diff'
                }
            })

            if (!response.ok) {
                throw new ProviderError(`GitHub API error: ${response.status}`, response.status)
            }

            return await response.text()
        } catch (error) {
            if (error instanceof ProviderError) throw error
            throw new ProviderError('Failed to fetch diff from GitHub')
        }
    }

    async postComment(prId: number | string, repo: string, body: string): Promise<void> {
        const url = `${this.baseUrl}/repos/${repo}/issues/${prId}/comments`
        await this.post(url, { body })
    }

    async fetchComments(prId: number | string, repo: string): Promise<import('../edm/comments.js').PRComment[]> {
        const url = `${this.baseUrl}/repos/${repo}/issues/${prId}/comments`
        try {
            const response = await fetch(url, { headers: this.getHeaders() })
            if (!response.ok) return []

            const comments = await response.json() as any[]
            return comments.map(c => ({
                id: c.id.toString(),
                author: c.user?.login || 'unknown',
                body: c.body || '',
                createdAt: c.created_at,
                url: c.html_url
            }))
        } catch {
            return []
        }
    }

    async addLabel(prId: number | string, repo: string, label: string): Promise<void> {
        const url = `${this.baseUrl}/repos/${repo}/issues/${prId}/labels`
        await this.post(url, { labels: [label] })
    }

    async requestReviewers(prId: number | string, repo: string, reviewers: string[]): Promise<void> {
        if (reviewers.length === 0) return
        const url = `${this.baseUrl}/repos/${repo}/pulls/${prId}/requested_reviewers`
        await this.post(url, { reviewers })
    }

    private getHeaders(): Record<string, string> {
        return {
            'Authorization': `Bearer ${this.config.token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        }
    }

    private async post(url: string, body: any): Promise<void> {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                ...this.getHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        })

        if (!response.ok) {
            throw new ProviderError(`GitHub API POST error: ${response.status}`, response.status)
        }
    }
}

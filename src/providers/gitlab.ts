/**
 * GitLab Provider Implementation (v1.1.0)
 */

import { createHmac } from 'crypto'
import type { GitProvider, PRMetadata, ProviderConfig } from './index.js'
import { ProviderError } from './index.js'

export class GitLabProvider implements GitProvider {
    private config: ProviderConfig
    private baseUrl: string

    constructor(config: ProviderConfig) {
        this.config = config
        this.baseUrl = config.apiUrl || 'https://gitlab.com/api/v4'
    }

    verifySignature(payload: string, signature: string): boolean {
        if (!this.config.webhookSecret || !signature) return false
        // GitLab passes the secret token directly in `X-Gitlab-Token` rather than an HMAC signature.
        return this.config.webhookSecret === signature
    }

    async parseWebhook(event: any, headers: Record<string, string>): Promise<PRMetadata | null> {
        const gitlabEvent = headers['x-gitlab-event']
        if (gitlabEvent !== 'Merge Request Hook') return null

        const objectAttributes = event.object_attributes
        if (!objectAttributes) return null

        const action = objectAttributes.action
        if (action !== 'open' && action !== 'update') return null

        return {
            id: objectAttributes.iid,
            title: objectAttributes.title,
            description: objectAttributes.description || '',
            author: event.user?.username || 'unknown',
            url: objectAttributes.url,
            baseRepo: event.project?.path_with_namespace || '',
            headRepo: objectAttributes.source?.path_with_namespace || '',
            status: objectAttributes.state,
            createdAt: objectAttributes.created_at,
            updatedAt: objectAttributes.updated_at,
        }
    }

    async fetchFiles(prId: number | string, repo: string): Promise<string[]> {
        const projectId = encodeURIComponent(repo)
        const url = `${this.baseUrl}/projects/${projectId}/merge_requests/${prId}/changes`

        try {
            const response = await fetch(url, { headers: this.getHeaders() })
            if (!response.ok) throw new ProviderError(`GitLab API error: ${response.status}`, response.status)

            const data = await response.json() as any
            return data.changes.map((c: any) => c.new_path)
        } catch (error) {
            if (error instanceof ProviderError) throw error
            throw new ProviderError('Failed to fetch files from GitLab')
        }
    }

    async fetchDiff(prId: number | string, repo: string): Promise<string> {
        const projectId = encodeURIComponent(repo)
        const url = `${this.baseUrl}/projects/${projectId}/merge_requests/${prId}/changes`

        try {
            const response = await fetch(url, { headers: this.getHeaders() })
            if (!response.ok) throw new ProviderError(`GitLab API error: ${response.status}`, response.status)

            const data = await response.json() as any
            return data.changes.map((c: any) => c.diff).join('\n')
        } catch (error) {
            if (error instanceof ProviderError) throw error
            throw new ProviderError('Failed to fetch diff from GitLab')
        }
    }

    async postComment(prId: number | string, repo: string, body: string): Promise<void> {
        const projectId = encodeURIComponent(repo)
        const url = `${this.baseUrl}/projects/${projectId}/merge_requests/${prId}/notes`
        await this.post(url, { body })
    }

    async addLabel(prId: number | string, repo: string, label: string): Promise<void> {
        const projectId = encodeURIComponent(repo)
        const url = `${this.baseUrl}/projects/${projectId}/merge_requests/${prId}`

        // GitLab requires updating the comma-separated labels string
        const mrResponse = await fetch(url, { headers: this.getHeaders() })
        if (!mrResponse.ok) return

        const mr = await mrResponse.json() as any
        const labels = [...(mr.labels || []), label].join(',')

        await fetch(url, {
            method: 'PUT',
            headers: {
                ...this.getHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ labels })
        })
    }

    async requestReviewers(prId: number | string, repo: string, reviewers: string[]): Promise<void> {
        // Note: GitLab REST API requires user IDs for reviewers, not usernames.
        // Full implementation would need to lookup user IDs first.
        // For v1.1.0 we omit this as it requires extra API calls.
        console.warn('GitLab requestReviewers not fully supported yet (requires user ID lookup)')
    }

    private getHeaders(): Record<string, string> {
        return {
            'Private-Token': this.config.token,
            'Accept': 'application/json'
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
            throw new ProviderError(`GitLab API POST error: ${response.status}`, response.status)
        }
    }
}

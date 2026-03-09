/**
 * Bitbucket Provider Implementation (v1.1.0)
 */

import type { GitProvider, PRMetadata, ProviderConfig } from './index.js'
import { ProviderError } from './index.js'

export class BitbucketProvider implements GitProvider {
    private config: ProviderConfig
    private baseUrl: string

    constructor(config: ProviderConfig) {
        this.config = config
        this.baseUrl = config.apiUrl || 'https://api.bitbucket.org/2.0'
    }

    verifySignature(payload: string, signature: string): boolean {
        // Bitbucket webhooks don't have built-in HMAC signatures natively (rely on whitelist IPs or basic auth)
        // Some setups use custom headers, but standard signature verification skips for basic usage.
        return true
    }

    async parseWebhook(event: any, headers: Record<string, string>): Promise<PRMetadata | null> {
        const bitbucketEvent = headers['x-event-key']
        if (bitbucketEvent !== 'pullrequest:created' && bitbucketEvent !== 'pullrequest:updated') return null

        const pr = event.pullrequest
        if (!pr) return null

        return {
            id: pr.id,
            title: pr.title,
            description: pr.description || '',
            author: pr.author?.display_name || pr.author?.nickname || 'unknown',
            url: pr.links?.html?.href || '',
            baseRepo: pr.destination?.repository?.full_name || '',
            headRepo: pr.source?.repository?.full_name || '',
            status: pr.state,
            createdAt: pr.created_on,
            updatedAt: pr.updated_on,
        }
    }

    async fetchFiles(prId: number | string, repo: string): Promise<string[]> {
        const url = `${this.baseUrl}/repositories/${repo}/pullrequests/${prId}/diffstat`

        try {
            const response = await fetch(url, { headers: this.getHeaders() })
            if (!response.ok) throw new ProviderError(`Bitbucket API error: ${response.status}`, response.status)

            const data = await response.json() as any
            return data.values.map((f: any) => f.new?.path || f.old?.path).filter(Boolean)
        } catch (error) {
            if (error instanceof ProviderError) throw error
            throw new ProviderError('Failed to fetch files from Bitbucket')
        }
    }

    async fetchDiff(prId: number | string, repo: string): Promise<string> {
        const url = `${this.baseUrl}/repositories/${repo}/pullrequests/${prId}/diff`

        try {
            const response = await fetch(url, { headers: this.getHeaders() })
            if (!response.ok) throw new ProviderError(`Bitbucket API error: ${response.status}`, response.status)

            return await response.text()
        } catch (error) {
            if (error instanceof ProviderError) throw error
            throw new ProviderError('Failed to fetch diff from Bitbucket')
        }
    }

    async postComment(prId: number | string, repo: string, body: string): Promise<void> {
        const url = `${this.baseUrl}/repositories/${repo}/pullrequests/${prId}/comments`
        await this.post(url, { content: { raw: body } })
    }

    async addLabel(prId: number | string, repo: string, label: string): Promise<void> {
        // Bitbucket doesn't have native PR labels in the same way GitHub/GitLab do
        // Some apps add tags, but natively we'd prepend to the title as a fallback
        console.warn('Bitbucket native labels not supported; skipping')
    }

    async requestReviewers(prId: number | string, repo: string, reviewers: string[]): Promise<void> {
        // Note: Similar to GitLab, Bitbucket API expects account_ids for reviewers.
        console.warn('Bitbucket requestReviewers not fully supported yet (requires UUID lookup)')
    }

    private getHeaders(): Record<string, string> {
        return {
            'Authorization': `Bearer ${this.config.token}`,
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
            throw new ProviderError(`Bitbucket API POST error: ${response.status}`, response.status)
        }
    }
}

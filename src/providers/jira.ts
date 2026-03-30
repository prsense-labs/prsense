/**
 * Jira Integration Provider (Phase 5)
 * 
 * Extracts Jira issue keys (e.g., PROJ-123) from text and fetches their full context
 * from the Jira Cloud REST API to enrich PR analysis.
 */

export interface JiraIssue {
    key: string
    summary: string
    description: string
    status: string
    comments?: Array<{ body: string }>
}

export class JiraProvider {
    private baseUrl: string
    private apiToken: string
    private email: string

    constructor(baseUrl: string, email: string, apiToken: string) {
        // e.g., https://your-domain.atlassian.net
        this.baseUrl = baseUrl.replace(/\/$/, '')
        this.email = email
        this.apiToken = apiToken
    }

    /**
     * Finds all Jira Issue identifiers (e.g., PROJ-123) in a given text.
     */
    extractIdentifiers(text: string): string[] {
        // Matches typical Jira Key pattern: at least 2 uppercase letters followed by a hyphen and numbers
        const regex = /([A-Z]{2,}-\d+)/g
        const matches = text.match(regex) || []
        return [...new Set(matches)] // Deduplicate
    }

    private getAuthHeader(): string {
        return 'Basic ' + Buffer.from(`${this.email}:${this.apiToken}`).toString('base64')
    }

    /**
     * Fetches details for a specific Jira issue.
     */
    async fetchIssueDetails(issueKey: string): Promise<JiraIssue | null> {
        if (!this.baseUrl || !this.apiToken || !this.email) {
            console.warn(`[JiraProvider] Cannot fetch ${issueKey} - Missing Jira credentials or URL.`)
            return null
        }

        try {
            const url = `${this.baseUrl}/rest/api/3/issue/${issueKey}?fields=summary,description,status,comment`
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': this.getAuthHeader()
                }
            })

            if (!response.ok) {
                console.warn(`[JiraProvider] Failed to fetch ${issueKey}: HTTP ${response.status}`)
                if (response.status === 404) {
                    return null // Issue doesn't exist
                }
                return null
            }

            const data: any = await response.json()

            // Jira ADF (Atlassian Document Format) descriptions are complex JSON structures. 
            // We do a very basic extraction here, or fallback to raw if not ADF.
            // In a full implementation, you'd use a parser to convert ADF to Markdown/plain text.
            let descriptionText = ''
            if (data.fields.description && data.fields.description.type === 'doc') {
                // Highly simplified ADF extraction: just grab all text node values deeply
                descriptionText = JSON.stringify(data.fields.description) // Placeholder - ideally map to text
            } else if (typeof data.fields.description === 'string') {
                descriptionText = data.fields.description
            }

            return {
                key: data.key,
                summary: data.fields.summary,
                description: descriptionText,
                status: data.fields.status?.name || 'Unknown',
                comments: data.fields.comment?.comments?.map((c: any) => ({
                    // Same simplified ADF logic applies to comments
                    body: typeof c.body === 'string' ? c.body : JSON.stringify(c.body)
                })) || []
            }
        } catch (error) {
            console.error(`[JiraProvider] Error fetching ${issueKey}:`, error)
            return null
        }
    }

    /**
     * Formats the Jira issue as enriched text for embedding and RAG.
     */
    formatForContext(issue: JiraIssue): string {
        let content = `[JIRA TICKET ${issue.key}]: ${issue.summary} (Status: ${issue.status})\n`
        content += `${issue.description || 'No description provided.'}\n`

        if (issue.comments && issue.comments.length > 0) {
            content += `--- Comments ---\n`
            issue.comments.forEach(c => {
                content += `${c.body}\n\n`
            })
        }

        return content
    }
}

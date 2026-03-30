/**
 * Linear Integration Provider (Phase 5)
 * 
 * Extracts Linear issue IDs (e.g., ENG-123) from text and fetches their full context
 * from the Linear GraphQL API to enrich PR analysis.
 */

export interface LinearIssue {
    id: string
    identifier: string
    title: string
    description: string
    state: { name: string }
    comments?: Array<{ body: string }>
}

export class LinearProvider {
    private apiKey: string

    constructor(apiKey: string) {
        this.apiKey = apiKey
    }

    /**
     * Finds all Linear Issue identifiers (e.g., PROJ-123) in a given text.
     */
    extractIdentifiers(text: string): string[] {
        // Matches typical Linear ID pattern: 1-5 uppercase letters followed by a hyphen and numbers
        const regex = /([A-Z]{1,5}-\d+)/g
        const matches = text.match(regex) || []
        return [...new Set(matches)] // Deduplicate
    }

    /**
     * Fetches details for a specific Linear issue.
     */
    async fetchIssueDetails(identifier: string): Promise<LinearIssue | null> {
        if (!this.apiKey) {
            console.warn(`[LinearProvider] Cannot fetch ${identifier} - No API Key configured.`)
            return null
        }

        const query = `
            query IssueDetails($id: String!) {
              issue(id: $id) {
                id
                identifier
                title
                description
                state {
                  name
                }
                comments {
                  nodes {
                    body
                  }
                }
              }
            }
        `

        try {
            const response = await fetch('https://api.linear.app/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.apiKey
                },
                body: JSON.stringify({
                    query,
                    variables: { id: identifier }
                })
            })

            if (!response.ok) {
                console.warn(`[LinearProvider] Failed to fetch ${identifier}: HTTP ${response.status}`)
                return null
            }

            const data: any = await response.json()
            if (data?.data?.issue) {
                const issue = data.data.issue
                return {
                    id: issue.id,
                    identifier: issue.identifier,
                    title: issue.title,
                    description: issue.description,
                    state: issue.state,
                    comments: issue.comments?.nodes || []
                }
            }
            return null
        } catch (error) {
            console.error(`[LinearProvider] Error fetching ${identifier}:`, error)
            return null
        }
    }

    /**
     * Formats the Linear issue as enriched text for embedding and RAG.
     */
    formatForContext(issue: LinearIssue): string {
        let content = `[LINEAR TICKET ${issue.identifier}]: ${issue.title} (Status: ${issue.state.name})\n`
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

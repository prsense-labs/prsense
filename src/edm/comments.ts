/**
 * Engineering Decision Memory (EDM)
 * Extracts architectural decisions from raw PR comments and discussions.
 */

export interface PRComment {
    id: string
    author: string
    body: string
    createdAt: string
    url: string
}

export interface ArchitecturalDecision {
    type: 'decision'
    sourceId: string // The ID of the comment
    author: string
    summary: string
    fullText: string
    url: string
    confidence: number // How sure we are this represents a major technical decision
}

export interface CommentIngester {
    ingestComments(comments: PRComment[]): ArchitecturalDecision[]
}

/**
 * Parses a stream of PR comments and filters out noise ("LGTM", "typo")
 * to identify major architectural decisions ("we chose x over y because z").
 */
export class DecisionExtractor implements CommentIngester {
    // Keywords indicating a likely architectural decision or tradeoff
    private decisionKeywords = [
        'we decided',
        'chose to',
        'opted for',
        'went with',
        'instead of',
        'tradeoff',
        'trade-off',
        'architectural',
        'because',
        'intentionally',
        'alternative',
    ]

    // Keywords indicating noise
    private noiseKeywords = [
        'lgtm',
        'looks good',
        'typo',
        'nit',
        'thanks',
        'pinging',
    ]

    ingestComments(comments: PRComment[]): ArchitecturalDecision[] {
        const decisions: ArchitecturalDecision[] = []

        for (const comment of comments) {
            const body = comment.body.toLowerCase()

            // Skip really short comments or obvious noise
            if (body.length < 50) continue

            let noiseScore = 0
            for (const noise of this.noiseKeywords) {
                if (body.includes(noise)) noiseScore++
            }
            if (noiseScore >= 2 && body.length < 200) continue // Probably pure noise

            let decisionScore = 0
            for (const kw of this.decisionKeywords) {
                if (body.includes(kw)) decisionScore++
            }

            // If it has strong indicators of being a decision
            if (decisionScore > 0) {
                // Calculate a basic confidence 0-1
                const confidence = Math.min(1.0, 0.4 + (decisionScore * 0.15))

                // For the summary, we'll just take the first sentence or two that contains a keyword
                const summary = this.extractSummary(comment.body)

                decisions.push({
                    type: 'decision',
                    sourceId: comment.id,
                    author: comment.author,
                    summary,
                    fullText: comment.body,
                    url: comment.url,
                    confidence
                })
            }
        }

        return decisions
    }

    private extractSummary(body: string): string {
        const sentences = body.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0)

        for (const sentence of sentences) {
            const sLower = sentence.toLowerCase()
            if (this.decisionKeywords.some(kw => sLower.includes(kw))) {
                return sentence.length > 150 ? sentence.substring(0, 147) + '...' : sentence + '.'
            }
        }

        // Fallback to first line
        const firstLine = (body.split('\n')[0] ?? '').trim()
        return firstLine.length > 150 ? firstLine.substring(0, 147) + '...' : firstLine
    }
}

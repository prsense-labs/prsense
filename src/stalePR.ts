export interface StalePRInput {
    prId: string | number
    title: string
    author: string
    createdAt: string | number | Date
    updatedAt: string | number | Date
    lastCommentAt?: string | number | Date
    isDraft?: boolean
    reviewStatus?: 'APPROVED' | 'CHANGES_REQUESTED' | 'PENDING' | 'NONE'
}

export interface StalePRResult {
    prId: string | number
    isStale: boolean
    stalenessScore: number // 0 to 100
    daysInactive: number
    suggestedAction: 'none' | 'ping_author' | 'ping_reviewers' | 'close' | 'merge'
    reason: string
}

export interface StaleConfig {
    staleThresholdDays: number
    closeThresholdDays: number
}

const DEFAULT_CONFIG: StaleConfig = {
    staleThresholdDays: 14,
    closeThresholdDays: 30
}

export class StalePRDetector {
    private config: StaleConfig

    constructor(config?: Partial<StaleConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config }
    }

    public evaluate(prs: StalePRInput[]): StalePRResult[] {
        return prs.map(pr => this.evaluateSingle(pr))
    }

    private evaluateSingle(pr: StalePRInput): StalePRResult {
        const now = new Date().getTime()
        const updated = new Date(pr.updatedAt).getTime()
        const lastComment = pr.lastCommentAt ? new Date(pr.lastCommentAt).getTime() : 0

        // Use the most recent activity (update or comment)
        const lastActivity = lastComment > updated ? lastComment : updated
        const daysInactive = (now - lastActivity) / (1000 * 60 * 60 * 24)

        let isStale = false
        let stalenessScore = 0
        let suggestedAction: StalePRResult['suggestedAction'] = 'none'
        let reason = ''

        if (daysInactive >= this.config.staleThresholdDays) {
            isStale = true
            // Score from 0 (at stale threshold) to 100 (at close threshold)
            // Wait, standardizing the score where 100 means fully ripe to close
            const score = ((daysInactive - this.config.staleThresholdDays) /
                (this.config.closeThresholdDays - this.config.staleThresholdDays)) * 100

            stalenessScore = Math.max(0, Math.min(100, score))

            if (daysInactive >= this.config.closeThresholdDays) {
                suggestedAction = 'close'
                reason = `Inactive for ${Math.round(daysInactive)} days (over ${this.config.closeThresholdDays} day threshold).`
            } else if (pr.reviewStatus === 'APPROVED') {
                suggestedAction = 'merge'
                reason = `Approved but inactive for ${Math.round(daysInactive)} days. Ready to merge?`
            } else if (pr.reviewStatus === 'CHANGES_REQUESTED') {
                suggestedAction = 'ping_author'
                reason = `Changes requested but inactive for ${Math.round(daysInactive)} days.`
            } else {
                suggestedAction = 'ping_reviewers'
                reason = `Pending review or activity for ${Math.round(daysInactive)} days.`
            }
        }

        return {
            prId: pr.prId,
            isStale,
            stalenessScore: Math.round(stalenessScore),
            daysInactive: Math.round(daysInactive * 10) / 10,
            suggestedAction,
            reason
        }
    }
}

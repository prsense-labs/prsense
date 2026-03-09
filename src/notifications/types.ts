export interface DuplicateAlert {
    type: 'DUPLICATE' | 'POSSIBLE'
    prId: number
    prTitle: string
    prUrl?: string
    originalPrId: number
    originalPrUrl?: string
    confidence: number
    repo?: string
}

export interface ImpactAlert {
    prId: number
    prTitle: string
    prUrl?: string
    score: number
    riskLevel: string
    factors: Array<{ name: string; score: number; description: string }>
}

export interface WeeklyDigest {
    weekStart: string
    weekEnd: string
    totalPRs: number
    duplicatesCaught: number
    possibleDuplicates: number
    estimatedTimeSavedHours: number
    topDuplicateFiles: string[]
}

export interface Notifier {
    notifyDuplicate(alert: DuplicateAlert): Promise<void>
    notifyImpact(alert: ImpactAlert): Promise<void>
    sendWeeklyDigest(digest: WeeklyDigest): Promise<void>
    testConnection(): Promise<boolean>
}

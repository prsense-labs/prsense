/**
 * Custom Rules Engine (v1.1.0)
 * 
 * Configurable rules to block or warn on PRs matching specific patterns.
 * Example: "Block PRs that touch auth/ without security team review"
 */

import { minimatch } from 'minimatch'

// ─── Types ───────────────────────────────────────────────────────

export type RuleAction = 'block' | 'warn' | 'require-review'

export interface RuleDefinition {
    id: string
    description: string
    action: RuleAction
    condition: RuleCondition
}

export type RuleCondition =
    | PathCondition
    | MaxFilesCondition
    | MaxDiffSizeCondition
    | AuthorCondition
    | AndCondition
    | OrCondition
    | NotCondition

export interface PathCondition {
    type: 'path'
    pattern: string // glob pattern
}

export interface MaxFilesCondition {
    type: 'max-files'
    count: number
}

export interface MaxDiffSizeCondition {
    type: 'max-diff-size'
    lines: number
}

export interface AuthorCondition {
    type: 'author-in'
    authors: string[]
}

export interface AndCondition {
    type: 'and'
    conditions: RuleCondition[]
}

export interface OrCondition {
    type: 'or'
    conditions: RuleCondition[]
}

export interface NotCondition {
    type: 'not'
    condition: RuleCondition
}

export interface RuleInput {
    files: string[]
    linesAdded: number
    linesRemoved: number
    author?: string
}

export interface RuleViolation {
    ruleId: string
    description: string
    action: RuleAction
}

// ─── Engine ──────────────────────────────────────────────────────

export class RulesEngine {
    private rules: RuleDefinition[] = []

    constructor(rules: RuleDefinition[] = []) {
        this.rules = rules
    }

    addRule(rule: RuleDefinition): void {
        this.rules.push(rule)
    }

    setRules(rules: RuleDefinition[]): void {
        this.rules = rules
    }

    getRules(): RuleDefinition[] {
        return this.rules
    }

    evaluate(input: RuleInput): RuleViolation[] {
        const violations: RuleViolation[] = []

        for (const rule of this.rules) {
            if (this.evaluateCondition(rule.condition, input)) {
                violations.push({
                    ruleId: rule.id,
                    description: rule.description,
                    action: rule.action,
                })
            }
        }

        return violations
    }

    private evaluateCondition(condition: RuleCondition, input: RuleInput): boolean {
        switch (condition.type) {
            case 'path':
                return input.files.some(file => minimatch(file, condition.pattern, { dot: true }))

            case 'max-files':
                return input.files.length > condition.count

            case 'max-diff-size':
                return (input.linesAdded + input.linesRemoved) > condition.lines

            case 'author-in':
                if (!input.author) return false
                return condition.authors.includes(input.author)

            case 'and':
                if (condition.conditions.length === 0) return true
                return condition.conditions.every(c => this.evaluateCondition(c, input))

            case 'or':
                if (condition.conditions.length === 0) return false
                return condition.conditions.some(c => this.evaluateCondition(c, input))

            case 'not':
                return !this.evaluateCondition(condition.condition, input)

            default:
                console.warn('Unknown rule condition type:', (condition as any).type)
                return false
        }
    }
}

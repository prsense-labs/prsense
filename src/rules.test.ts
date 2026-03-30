/**
 * Tests for Custom Rules Engine
 */

import { describe, it, expect } from 'vitest'
import { RulesEngine, type RuleDefinition } from './rules.js'

describe('RulesEngine', () => {
    it('should evaluate path conditions', () => {
        const engine = new RulesEngine([{
            id: 'auth-review',
            description: 'Changes to auth code require review',
            action: 'require-review',
            condition: { type: 'path', pattern: 'src/auth/**' }
        }])

        expect(engine.evaluate({ files: ['src/main.ts'], linesAdded: 10, linesRemoved: 5 })).toHaveLength(0)

        const violations = engine.evaluate({ files: ['src/auth/login.ts'], linesAdded: 10, linesRemoved: 5 })
        expect(violations).toHaveLength(1)
        expect(violations[0]!.ruleId).toBe('auth-review')
        expect(violations[0]!.action.type).toBe('require-review')
    })

    it('should evaluate max files conditions', () => {
        const engine = new RulesEngine([{
            id: 'too-many-files',
            description: 'PR is too large to review',
            action: 'warn',
            condition: { type: 'max-files', count: 3 }
        }])

        expect(engine.evaluate({ files: ['1.ts', '2.ts'], linesAdded: 10, linesRemoved: 5 })).toHaveLength(0)
        expect(engine.evaluate({ files: ['1.ts', '2.ts', '3.ts', '4.ts'], linesAdded: 10, linesRemoved: 5 })).toHaveLength(1)
    })

    it('should evaluate max diff size conditions', () => {
        const engine = new RulesEngine([{
            id: 'huge-diff',
            description: 'PR diff is too large',
            action: 'warn',
            condition: { type: 'max-diff-size', lines: 100 }
        }])

        expect(engine.evaluate({ files: ['1.ts'], linesAdded: 50, linesRemoved: 50 })).toHaveLength(0) // Exactly 100
        expect(engine.evaluate({ files: ['1.ts'], linesAdded: 60, linesRemoved: 50 })).toHaveLength(1) // 110
    })

    it('should evaluate author conditions', () => {
        const engine = new RulesEngine([{
            id: 'bot-pr',
            description: 'PR created by bot',
            action: 'warn',
            condition: { type: 'author-in', authors: ['dependabot'] }
        }])

        expect(engine.evaluate({ files: ['1.ts'], linesAdded: 10, linesRemoved: 5, author: 'alice' })).toHaveLength(0)
        expect(engine.evaluate({ files: ['1.ts'], linesAdded: 10, linesRemoved: 5, author: 'dependabot' })).toHaveLength(1)
    })

    it('should evaluate complex AND/OR/NOT conditions', () => {
        const engine = new RulesEngine([{
            id: 'complex-rule',
            description: 'Large changes outside tests by new authors',
            action: 'block',
            condition: {
                type: 'and',
                conditions: [
                    { type: 'max-diff-size', lines: 500 },
                    {
                        type: 'not',
                        condition: { type: 'path', pattern: '**/*.test.ts' }
                    },
                    {
                        type: 'or',
                        conditions: [
                            { type: 'author-in', authors: ['newbie1', 'newbie2'] },
                            { type: 'max-files', count: 20 }
                        ]
                    }
                ]
            }
        }])

        // Fails size ✗
        expect(engine.evaluate({ files: ['main.ts'], linesAdded: 100, linesRemoved: 50, author: 'newbie1' })).toHaveLength(0)

        // Passes size ✓, Passes NOT test ✓, Passes author (newbie) ✓ -> VIOLATION
        expect(engine.evaluate({ files: ['main.ts'], linesAdded: 400, linesRemoved: 200, author: 'newbie1' })).toHaveLength(1)

        // Passes size ✓, Fails NOT test (it IS a test file) ✗
        expect(engine.evaluate({ files: ['main.test.ts'], linesAdded: 400, linesRemoved: 200, author: 'newbie1' })).toHaveLength(0)

        // Passes size ✓, Passes NOT test ✓, Fails OR (not a newbie, not > 20 files) ✗
        expect(engine.evaluate({ files: ['main.ts', 'util.ts'], linesAdded: 400, linesRemoved: 200, author: 'experienced' })).toHaveLength(0)

        // Passes size ✓, Passes NOT test ✓, Passes OR (experienced, but > 20 files) ✓ -> VIOLATION
        // Passes size ✓, Passes NOT test ✓, Passes OR (experienced, but > 20 files) ✓ -> VIOLATION
        const manyFiles = Array.from({ length: 21 }, (_, i) => `file${i}.ts`)
        expect(engine.evaluate({ files: manyFiles, linesAdded: 400, linesRemoved: 200, author: 'experienced' })).toHaveLength(1)
    })

    it('should evaluate impact-score and bus-factor conditions with active actions', () => {
        const engine = new RulesEngine([
            {
                id: 'high-risk',
                description: 'High impact change needs senior review',
                action: { type: 'assign-reviewer', payload: 'senior-dev' },
                condition: { type: 'impact-score', minScore: 80 }
            },
            {
                id: 'low-bus-factor',
                description: 'Code with low bus factor is being modified',
                action: { type: 'notify-slack', payload: '#engineering-alerts' },
                condition: { type: 'bus-factor', maxFactor: 1 }
            }
        ])

        // Safe change: low impact, high bus factor
        expect(engine.evaluate({
            files: ['1.ts'], linesAdded: 10, linesRemoved: 5, impactScore: 20, lowestBusFactor: 5
        })).toHaveLength(0)

        // Danger change: high impact
        const violations1 = engine.evaluate({
            files: ['1.ts'], linesAdded: 10, linesRemoved: 5, impactScore: 85, lowestBusFactor: 5
        })
        expect(violations1).toHaveLength(1)
        expect(violations1[0]!.action.type).toBe('assign-reviewer')
        expect((violations1[0]!.action as any).payload).toBe('senior-dev')

        // Danger change: low bus factor
        const violations2 = engine.evaluate({
            files: ['1.ts'], linesAdded: 10, linesRemoved: 5, impactScore: 20, lowestBusFactor: 1
        })
        expect(violations2).toHaveLength(1)
        expect(violations2[0]!.action.type).toBe('notify-slack')
        expect((violations2[0]!.action as any).payload).toBe('#engineering-alerts')
    })
})

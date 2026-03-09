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
        expect(violations[0]!.action).toBe('require-review')
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
        const manyFiles = Array.from({ length: 21 }, (_, i) => `file${i}.ts`)
        expect(engine.evaluate({ files: manyFiles, linesAdded: 400, linesRemoved: 200, author: 'experienced' })).toHaveLength(1)
    })
})

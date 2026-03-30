import { describe, it, expect, beforeEach } from 'vitest'
import { KnowledgeGraph } from './knowledgeGraph.js'

describe('KnowledgeGraph', () => {
    let graph: KnowledgeGraph

    beforeEach(() => {
        graph = new KnowledgeGraph()
    })

    it('should ingest a PR and create correct nodes and edges', () => {
        graph.addPR(101, 'Fix config', 'alice', ['config.json'])

        const prNode = graph.getNode('pr:101')
        expect(prNode).toBeDefined()
        expect(prNode?.type).toBe('pr')

        const authorNode = graph.getNode('author:alice')
        expect(authorNode).toBeDefined()

        const fileNode = graph.getNode('file:config.json')
        expect(fileNode).toBeDefined()

        // Check author history
        const aliceHistory = graph.getAuthorHistory('alice')
        expect(aliceHistory).toContainEqual(prNode)

        // Check file history
        const configHistory = graph.getFileHistory('config.json')
        expect(configHistory).toContainEqual(prNode)
    })

    it('should deduplicate nodes and edges for multiple PRs', () => {
        // Alice opens first PR touching config
        graph.addPR(101, 'Add timeout', 'alice', ['config.json'])
        // Alice opens second PR touching same config + new file
        graph.addPR(102, 'Fix timeout', 'alice', ['config.json', 'utils.ts'])

        // Should still only evaluate to 1 author node and 2 file nodes
        const configNode = graph.getNode('file:config.json')
        expect(configNode).toBeDefined()

        const utilsNode = graph.getNode('file:utils.ts')
        expect(utilsNode).toBeDefined()

        // Author history
        const aliceHistory = graph.getAuthorHistory('alice')
        expect(aliceHistory.length).toBe(2)
        expect(aliceHistory.map(n => n.id)).toEqual(expect.arrayContaining(['pr:101', 'pr:102']))

        // File history
        const configHistory = graph.getFileHistory('config.json')
        expect(configHistory.length).toBe(2)

        const utilsHistory = graph.getFileHistory('utils.ts')
        expect(utilsHistory.length).toBe(1)
        expect(utilsHistory[0]?.id).toBe('pr:102')
    })

    it('should correctly link duplicated PRs', () => {
        // Bob opens a duplicate of PR 101
        graph.addPR(105, 'Duplicate of config fix', 'bob', ['config.json'], 101)

        const dupNode = graph.getNode('pr:105')
        const originalNode = graph.getNode('pr:101')
        expect(dupNode).toBeDefined()
        expect(originalNode).toBeDefined() // Stub created if it didn't exist

        const dupEdges = graph.query('pr:105', 'pr', 'duplicate_of')
        expect(dupEdges.length).toBe(1)
        expect(dupEdges[0]?.id).toBe('pr:101')
    })

    it('should support JSON export and import', () => {
        graph.addPR(101, 'Fix config', 'alice', ['config.json'])

        const json = graph.exportJSON()
        expect(json).toContain('pr:101')
        expect(json).toContain('alice')

        const newGraph = new KnowledgeGraph()
        newGraph.importJSON(json)

        const prNode = newGraph.getNode('pr:101')
        expect(prNode).toBeDefined()
        expect(prNode?.attributes.title).toBe('Fix config')

        const history = newGraph.getFileHistory('config.json')
        expect(history.length).toBe(1)
    })

    it('should calculate true expertise based on authors, reviewers, and time decay', async () => {
        const { vi } = await import('vitest')
        const mockNow = new Date('2024-01-01T00:00:00Z')
        vi.useFakeTimers()
        vi.setSystemTime(mockNow)

        try {
            // PR 1: 6 months ago (0.5 time multiplier)
            const sixMonthsAgo = mockNow.getTime() - (182 * 24 * 60 * 60 * 1000)

            // Manually add nodes and edges to strictly control timestamps
            graph.addNode({ id: 'pr:201', type: 'pr', attributes: { id: 201, title: 'Old feature' } })
            graph.addNode({ id: 'author:alice', type: 'author', attributes: { username: 'alice' } })
            graph.addNode({ id: 'file:core.ts', type: 'file', attributes: { path: 'core.ts' } })

            graph.addEdge({ source: 'author:alice', target: 'pr:201', relation: 'authored', timestamp: sixMonthsAgo })
            graph.addEdge({ source: 'pr:201', target: 'file:core.ts', relation: 'touches' })
            // Alice gets 10 base * 0.5 decay = 5.0 points

            // PR 2: Today (1.0 time multiplier)
            graph.addNode({ id: 'pr:202', type: 'pr', attributes: { id: 202, title: 'New feature' } })
            graph.addNode({ id: 'author:bob', type: 'author', attributes: { username: 'bob' } })

            graph.addEdge({ source: 'author:bob', target: 'pr:202', relation: 'authored', timestamp: mockNow.getTime() })
            graph.addEdge({ source: 'pr:202', target: 'file:core.ts', relation: 'touches' })
            // Bob gets 10 base * 1.0 decay = 10.0 points

            // Charlie reviews PR 2 today and approves
            graph.addReviewer(202, 'charlie', true)
            // Charlie gets 5 base * 2 weight * 1.0 decay = 10.0 points

            // Dave comments on PR 2 today
            graph.addNode({ id: 'author:dave', type: 'author', attributes: { username: 'dave' } })
            graph.addEdge({ source: 'author:dave', target: 'pr:202', relation: 'commented', timestamp: mockNow.getTime() })
            // Dave gets 2 base * 1.0 decay = 2.0 points

            const experts = graph.getTrueExpertise('core.ts')

            // Order should be: Bob (10), Charlie (10), Alice (5), Dave (2)
            expect(experts.length).toBe(4)

            // Check specific scores
            const bobScore = experts.find(e => e.author === 'bob')?.score
            const charlieScore = experts.find(e => e.author === 'charlie')?.score
            const aliceScore = experts.find(e => e.author === 'alice')?.score
            const daveScore = experts.find(e => e.author === 'dave')?.score

            expect(bobScore).toBe(10)
            expect(charlieScore).toBe(10)
            expect(aliceScore).toBeGreaterThanOrEqual(4.9) // Floating point math
            expect(aliceScore).toBeLessThanOrEqual(5.1)
            expect(daveScore).toBe(2)

        } finally {
            vi.useRealTimers()
        }
    })

    it('should calculate bus factor based on expertise threshold', () => {
        // Setup similar to above but without time decay for simplicity
        graph.addPR(301, 'Base feature', 'alice', ['api.ts'])
        graph.addPR(302, 'Extend feature', 'bob', ['api.ts'])
        graph.addReviewer(302, 'charlie', true) // Approval (10 pts)

        // Dave only makes a small comment (2 pts)
        graph.addNode({ id: 'author:dave', type: 'author', attributes: { username: 'dave' } })
        graph.addEdge({ source: 'author:dave', target: 'pr:302', relation: 'commented' }) // 2 pts

        // Alice (10), Bob (10), Charlie (10) are all >= 5 points. Dave (2) is not.
        const busFactor = graph.calculateBusFactor('api.ts')
        expect(busFactor).toBe(3)
    })
})

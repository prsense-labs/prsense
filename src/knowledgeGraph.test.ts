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
})

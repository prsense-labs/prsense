export interface GraphNode {
    id: string
    type: 'pr' | 'file' | 'author'
    attributes: Record<string, any>
}

export interface GraphEdge {
    source: string // Node ID
    target: string // Node ID
    relation: 'touches' | 'authored' | 'duplicate_of' | 'related_to'
    weight?: number
}

export class KnowledgeGraph {
    private nodes: Map<string, GraphNode> = new Map()
    private edges: GraphEdge[] = new Array()

    /**
     * Clear the graph
     */
    public clear() {
        this.nodes.clear()
        this.edges = []
    }

    /**
     * Add a node to the graph
     */
    public addNode(node: GraphNode) {
        this.nodes.set(node.id, node)
    }

    /**
     * Retrieve a node
     */
    public getNode(id: string): GraphNode | undefined {
        return this.nodes.get(id)
    }

    /**
     * Add an edge between two nodes
     */
    public addEdge(edge: GraphEdge) {
        // Ensure nodes exist (basic validation)
        if (!this.nodes.has(edge.source)) {
            throw new Error(`Source node ${edge.source} does not exist`)
        }
        if (!this.nodes.has(edge.target)) {
            throw new Error(`Target node ${edge.target} does not exist`)
        }

        // Check for duplicates
        const exists = this.edges.some(
            e => e.source === edge.source && e.target === edge.target && e.relation === edge.relation
        )
        if (!exists) {
            this.edges.push(edge)
        }
    }

    /**
     * High-level method to ingest a PR into the graph
     */
    public addPR(prId: string | number, title: string, author: string, files: string[], originalPrId?: string | number) {
        const prNodeId = `pr:${prId}`
        const authorNodeId = `author:${author}`

        // 1. Add PR Node
        this.addNode({
            id: prNodeId,
            type: 'pr',
            attributes: { id: prId, title }
        })

        // 2. Add Author Node
        if (!this.nodes.has(authorNodeId)) {
            this.addNode({
                id: authorNodeId,
                type: 'author',
                attributes: { username: author }
            })
        }

        // Edge: Author -> PR
        this.addEdge({ source: authorNodeId, target: prNodeId, relation: 'authored' })

        // 3. Add File Nodes and Edges
        for (const file of files) {
            const fileNodeId = `file:${file}`
            if (!this.nodes.has(fileNodeId)) {
                this.addNode({
                    id: fileNodeId,
                    type: 'file',
                    attributes: { path: file }
                })
            }
            // Edge: PR -> File
            this.addEdge({ source: prNodeId, target: fileNodeId, relation: 'touches' })
        }

        // 4. Duplicate relations
        if (originalPrId) {
            const originalNodeId = `pr:${originalPrId}`
            // If original isn't in graph yet, add a stub so we can link to it
            if (!this.nodes.has(originalNodeId)) {
                this.addNode({
                    id: originalNodeId,
                    type: 'pr',
                    attributes: { id: originalPrId, title: 'Unknown (stub)' }
                })
            }
            this.addEdge({ source: prNodeId, target: originalNodeId, relation: 'duplicate_of' })
        }
    }

    /**
     * General query method to find adjacent nodes of a specific type or relation
     */
    public query(startId: string, targetType?: 'pr' | 'file' | 'author', relationFilter?: GraphEdge['relation']): GraphNode[] {
        if (!this.nodes.has(startId)) return []

        // Find all edges starting from this node
        let relevantEdges = this.edges.filter(e => e.source === startId || e.target === startId)

        if (relationFilter) {
            relevantEdges = relevantEdges.filter(e => e.relation === relationFilter)
        }

        // Extract adjacent node IDs
        const adjacentIds = new Set<string>()
        for (const edge of relevantEdges) {
            if (edge.source === startId) adjacentIds.add(edge.target)
            else adjacentIds.add(edge.source) // for undirected-like queries
        }

        // Fetch nodes and filter by type
        let results = Array.from(adjacentIds)
            .map(id => this.nodes.get(id)!)
            .filter(Boolean)

        if (targetType) {
            results = results.filter(n => n.type === targetType)
        }

        return results
    }

    /**
     * Shortcut: Get all PRs that touched this file
     */
    public getFileHistory(filepath: string): GraphNode[] {
        return this.query(`file:${filepath}`, 'pr', 'touches')
    }

    /**
     * Shortcut: Get all files/PRs authored by this user
     */
    public getAuthorHistory(username: string): GraphNode[] {
        return this.query(`author:${username}`)
    }

    // ─── Export & Import ──────────────────────────────────────────────

    public exportJSON(): string {
        return JSON.stringify({
            nodes: Array.from(this.nodes.entries()),
            edges: this.edges
        }, null, 2)
    }

    public importJSON(jsonString: string) {
        try {
            const data = JSON.parse(jsonString)
            this.nodes = new Map(data.nodes)
            this.edges = data.edges || []
        } catch (error) {
            console.error('Failed to import graph:', error)
        }
    }
}

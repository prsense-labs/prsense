export interface GraphNode {
    id: string
    type: 'pr' | 'file' | 'author'
    attributes: Record<string, any>
}

export interface GraphEdge {
    source: string // Node ID
    target: string // Node ID
    relation: 'touches' | 'authored' | 'duplicate_of' | 'related_to' | 'reviewed' | 'commented'
    weight?: number
    timestamp?: number // For time-decay calculations
}

export class KnowledgeGraph {
    private nodes: Map<string, GraphNode> = new Map()
    private edges: GraphEdge[] = new Array()
    /** Fast O(1) edge dedup index: "source|target|relation" → index in edges array */
    private edgeIndex: Map<string, number> = new Map()

    private edgeKey(source: string, target: string, relation: string): string {
        return `${source}|${target}|${relation}`
    }

    /**
     * Clear the graph
     */
    public clear() {
        this.nodes.clear()
        this.edges = []
        this.edgeIndex.clear()
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

        // O(1) check for duplicates using the index
        const key = this.edgeKey(edge.source, edge.target, edge.relation)
        const existingIdx = this.edgeIndex.get(key)

        if (existingIdx === undefined) {
            this.edgeIndex.set(key, this.edges.length)
            this.edges.push(edge)
        } else if (edge.weight !== undefined) {
            // Update weight if edge already exists and new weight is provided
            const existingEdge = this.edges[existingIdx]
            if (existingEdge) {
                existingEdge.weight = (existingEdge.weight || 0) + edge.weight
            }
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
        this.addEdge({ source: authorNodeId, target: prNodeId, relation: 'authored', timestamp: Date.now() })

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
     * Add an explicit expertise link (e.g. from parsing review comments)
     */
    public addReviewer(prId: string | number, reviewerId: string, isApproval: boolean = false) {
        const authorNodeId = `author:${reviewerId}`
        const prNodeId = `pr:${prId}`

        if (!this.nodes.has(authorNodeId)) {
            this.addNode({ id: authorNodeId, type: 'author', attributes: { username: reviewerId } })
        }
        if (!this.nodes.has(prNodeId)) return

        this.addEdge({
            source: authorNodeId,
            target: prNodeId,
            relation: 'reviewed',
            weight: isApproval ? 2 : 1,
            timestamp: Date.now()
        })
    }

    /**
     * Export the entire graph topology for visualization (Dashboard Phase 7)
     */
    public export() {
        return {
            nodes: Array.from(this.nodes.values()),
            edges: this.edges
        }
    }

    /**
     * Calculate Bus Factor for a specific file or directory
     * Returns the number of distinct developers who have meaningfully contributed
     * to this file within the last year.
     */
    public calculateBusFactor(path: string): number {
        const experts = this.getTrueExpertise(path)
        // Bus factor is the number of developers with an expertise score over a certain threshold
        // Meaning they have context, not just a one-off typo fix.
        let busFactor = 0
        for (const expert of experts) {
            if (expert.score >= 5) busFactor++ // 5 is arbitrary threshold for "meaningful context"
        }
        return busFactor
    }

    /**
     * Find True Expertise for a file.
     * Weighs Authorship (10pts) vs Approvals (5pts) vs Comments (2pts).
     * Time decay: Older interactions are worth less.
     */
    public getTrueExpertise(path: string): Array<{ author: string; score: number }> {
        const fileNodeId = `file:${path}`
        if (!this.nodes.has(fileNodeId)) return []

        // Find all PRs that touch this file
        const prEdges = this.edges.filter(e =>
            (e.source === fileNodeId && e.relation === 'touches') ||
            (e.target === fileNodeId && e.relation === 'touches')
        )

        const prIds = new Set(prEdges.map(e => e.source === fileNodeId ? e.target : e.source))

        const scores: Record<string, number> = {}
        const now = Date.now()
        const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

        for (const prId of prIds) {
            // Find all authors/reviewers for this PR
            const peopleEdges = this.edges.filter(e =>
                (e.target === prId || e.source === prId) &&
                ['authored', 'reviewed', 'commented'].includes(e.relation)
            )

            for (const edge of peopleEdges) {
                const personId = edge.source === prId ? edge.target : edge.source
                const personNode = this.nodes.get(personId)
                if (!personNode || personNode.type !== 'author') continue

                const username = personNode.attributes.username
                if (!scores[username]) scores[username] = 0

                // Time Decay: 1.0 if today, 0.1 if > 1 year old
                const timestamp = edge.timestamp ?? now
                const ageMs = now - timestamp
                let timeMultiplier = Math.max(0.1, 1.0 - (ageMs / ONE_YEAR_MS))
                if (edge.timestamp === undefined) timeMultiplier = 1.0 // Legacy edges with no timestamp

                let basePoints = 0
                if (edge.relation === 'authored') basePoints = 10
                else if (edge.relation === 'reviewed') basePoints = 5 * (edge.weight ?? 1)
                else if (edge.relation === 'commented') basePoints = 2 * (edge.weight ?? 1)

                scores[username] += basePoints * timeMultiplier
            }
        }

        // Convert to array and sort descending
        return Object.entries(scores)
            .map(([author, score]) => ({ author, score: Math.round(score * 10) / 10 }))
            .sort((a, b) => b.score - a.score)
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
            // Rebuild edge index for O(1) dedup
            this.edgeIndex.clear()
            for (let i = 0; i < this.edges.length; i++) {
                const e = this.edges[i]
                if (e) {
                    this.edgeIndex.set(this.edgeKey(e.source, e.target, e.relation), i)
                }
            }
        } catch (error) {
            console.error('Failed to import graph:', error)
        }
    }
}

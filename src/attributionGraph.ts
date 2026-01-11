/**
 * 
 * Directed acyclic graph tracking PR duplication lineage
 * 
 * ensures original authorship is preserved
 */
export class AttributionGraph {
    private parent = new Map<number, number>()
    private children = new Map<number, Set<number>>()

    /**
     * record that duplicatedPRId is derived from originalPRId
     */

    addEdge(
        duplicatedPrId: number,
        originalPrId: number
    ): void {
        this.parent.set(duplicatedPrId,originalPrId)

        if (! this.children.has(originalPrId)) {
            this.children.set(originalPrId, new Set())

        }

        this.children.get(originalPrId)!.add(duplicatedPrId)
    }

    /**
     * returns the root/original pr in the lineage
     */

    getOriginal(prId: number): number {
        let current = prId
        while (this.parent.has(current)) {
            current = this.parent.get(current)!
        }
        return current
    }
    /**
     * returns all transitive duplicates of a PR
     */
    getAllDuplicates(prId: number): number[] {
        const result: number[] = []
        const stack: number[] = [prId]

        while (stack.length > 0) {
            const node = stack.pop()!
            const kids = this.children.get(node)
            if (!kids) continue

            for (const child of kids) {
                result.push(child)
                stack.push(child)
            }
        }
        return result
    }
}


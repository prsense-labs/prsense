import type { CodeBlock } from '../ast/parser.js';

export interface CodeHealthReport {
    healthScore: number; // 0 to 100
    averageComplexity: number;
    highComplexityBlocks: CodeBlock[];
    duplicateBlocks: Array<{ blockA: CodeBlock; blockB: CodeBlock }>;
}

export class CodeHealthMetrics {
    /**
     * Calculates the overall code health score based on AST blocks.
     */
    static calculateHealth(blocks: CodeBlock[]): CodeHealthReport {
        if (blocks.length === 0) {
            return {
                healthScore: 100,
                averageComplexity: 0,
                highComplexityBlocks: [],
                duplicateBlocks: []
            };
        }

        let totalComplexity = 0;
        const highComplexityBlocks: CodeBlock[] = [];
        
        // Find high complexity and calculate average
        for (const block of blocks) {
            totalComplexity += block.complexity;
            if (block.complexity > 10) {
                highComplexityBlocks.push(block);
            }
        }

        const averageComplexity = totalComplexity / blocks.length;

        // Simple duplicate detection (exact content match)
        // In a real system, we'd use jaccard similarity or AST tree hashing
        const duplicateBlocks: Array<{ blockA: CodeBlock; blockB: CodeBlock }> = [];
        for (let i = 0; i < blocks.length; i++) {
            for (let j = i + 1; j < blocks.length; j++) {
                const blockA = blocks[i]!;
                const blockB = blocks[j]!;
                if (
                    blockA.content.length > 50 && // ignore tiny blocks
                    blockA.content === blockB.content
                ) {
                    duplicateBlocks.push({ blockA, blockB });
                }
            }
        }

        // Calculate score (out of 100)
        // Base score is 100.
        // - Deduct 2 points for every high complexity block
        // - Deduct 5 points for every duplicate pair
        // - Deduct 5 points if average complexity > 5
        let score = 100;
        score -= highComplexityBlocks.length * 2;
        score -= duplicateBlocks.length * 5;
        if (averageComplexity > 5) {
            score -= (averageComplexity - 5) * 5;
        }

        // Clamp between 0 and 100
        score = Math.max(0, Math.min(100, Math.round(score)));

        return {
            healthScore: score,
            averageComplexity: Number(averageComplexity.toFixed(2)),
            highComplexityBlocks,
            duplicateBlocks
        };
    }
}

import { describe, it, expect } from 'vitest';
import { CodeHealthMetrics } from './metrics.js';
import type { CodeBlock } from '../ast/parser.js';

describe('CodeHealthMetrics', () => {
    it('should calculate perfect health for simple code', () => {
        const blocks: CodeBlock[] = [
            { name: 'funcA', kind: 'FunctionDeclaration', startLine: 1, endLine: 3, complexity: 1, content: 'function funcA() { return 1; }' },
            { name: 'funcB', kind: 'FunctionDeclaration', startLine: 5, endLine: 7, complexity: 2, content: 'function funcB(x) { return x ? 1 : 0; }' }
        ];

        const report = CodeHealthMetrics.calculateHealth(blocks);
        expect(report.healthScore).toBe(100);
        expect(report.averageComplexity).toBe(1.5);
        expect(report.highComplexityBlocks).toHaveLength(0);
        expect(report.duplicateBlocks).toHaveLength(0);
    });

    it('should penalize high complexity', () => {
        const blocks: CodeBlock[] = [
            { name: 'complexFunc', kind: 'FunctionDeclaration', startLine: 1, endLine: 20, complexity: 15, content: '...' }
        ];

        const report = CodeHealthMetrics.calculateHealth(blocks);
        // Base 100 - 2 (for 1 high complexity) - ((15 - 5) * 5) = 100 - 2 - 50 = 48
        expect(report.healthScore).toBe(48);
        expect(report.highComplexityBlocks).toHaveLength(1);
    });

    it('should penalize exact duplicates', () => {
        const bigContent = 'function duplicated() { let sum = 0; for(let i=0; i<100; i++) sum+=i; return sum; }';
        const blocks: CodeBlock[] = [
            { name: 'func1', kind: 'FunctionDeclaration', startLine: 1, endLine: 5, complexity: 2, content: bigContent },
            { name: 'func2', kind: 'FunctionDeclaration', startLine: 10, endLine: 15, complexity: 2, content: bigContent }
        ];

        const report = CodeHealthMetrics.calculateHealth(blocks);
        // Base 100 - 5 (duplicate pair) = 95
        expect(report.healthScore).toBe(95);
        expect(report.duplicateBlocks).toHaveLength(1);
    });
});

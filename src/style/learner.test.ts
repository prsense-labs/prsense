import { describe, it, expect, vi } from 'vitest';
import { StyleLearner } from './learner.js';
import type { LLMProvider } from './learner.js';
import type { CodeBlock } from '../ast/parser.js';

describe('StyleLearner', () => {
    it('should extract style profile from LLM JSON response', async () => {
        const mockLlm: LLMProvider = {
            jsonCompletion: vi.fn().mockResolvedValue(JSON.stringify({
                namingConventions: ['camelCase'],
                errorHandling: ['throw new Error'],
                architecturePatterns: ['classes'],
                preferredLibraries: []
            })),
            chatCompletion: vi.fn(),
            generate: vi.fn()
        };

        const learner = new StyleLearner(mockLlm);
        const blocks: CodeBlock[] = [
            { name: 'test', kind: 'Function', startLine: 1, endLine: 5, complexity: 1, content: 'function test() { throw new Error(); }' }
        ];

        const profile = await learner.learnFromBlocks(blocks);

        expect(profile.namingConventions).toContain('camelCase');
        expect(profile.errorHandling).toContain('throw new Error');
        expect(mockLlm.jsonCompletion).toHaveBeenCalled();
    });

    it('should handle LLM failure gracefully', async () => {
        const mockLlm: LLMProvider = {
            jsonCompletion: vi.fn().mockRejectedValue(new Error('LLM down')),
            chatCompletion: vi.fn(),
            generate: vi.fn()
        };

        const learner = new StyleLearner(mockLlm);
        const profile = await learner.learnFromBlocks([]);

        expect(profile.namingConventions).toEqual([]);
        expect(profile.errorHandling).toEqual([]);
    });
});

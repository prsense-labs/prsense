import type { CodeBlock } from '../ast/parser.js';

export interface LLMProvider {
    jsonCompletion(systemPrompt: string, userQuery: string): Promise<string>;
    chatCompletion(systemPrompt: string, userQuery: string): Promise<string>;
    generate(prompt: string): Promise<string>;
}

export interface CodebaseStyleProfile {
    namingConventions: string[];
    errorHandling: string[];
    architecturePatterns: string[];
    preferredLibraries: string[];
}

export class StyleLearner {
    private llm: LLMProvider;

    constructor(llm: LLMProvider) {
        this.llm = llm;
    }

    /**
     * Learns codebase style from a collection of code blocks.
     */
    async learnFromBlocks(blocks: CodeBlock[]): Promise<CodebaseStyleProfile> {
        // We can't send the entire codebase, so we sample the most complex/longest blocks
        const sampledBlocks = blocks
            .sort((a, b) => b.content.length - a.content.length)
            .slice(0, 10);

        const codeContext = sampledBlocks.map(b => b.content).join('\n\n---\n\n');

        const systemPrompt = `
You are an expert Principal Software Engineer analyzing a codebase.
Analyze the provided code snippets and extract the dominant style guidelines and conventions used by the team.

Return a JSON object matching this schema:
{
  "namingConventions": ["e.g. interfaces start with I", "e.g. variables are camelCase"],
  "errorHandling": ["e.g. uses try/catch and logs to console", "e.g. throws custom errors"],
  "architecturePatterns": ["e.g. uses classes for services", "e.g. pure functions"],
  "preferredLibraries": ["e.g. uses lodash", "e.g. uses native fetch"]
}

Keep descriptions short and actionable.
`;

        const userQuery = `Analyze this code and extract the style profile:\n\n${codeContext}`;

        try {
            const jsonStr = await this.llm.jsonCompletion(systemPrompt, userQuery);
            const profile = JSON.parse(jsonStr) as CodebaseStyleProfile;
            return {
                namingConventions: profile.namingConventions || [],
                errorHandling: profile.errorHandling || [],
                architecturePatterns: profile.architecturePatterns || [],
                preferredLibraries: profile.preferredLibraries || []
            };
        } catch (e) {
            console.error('[StyleLearner] Failed to learn style:', e);
            return {
                namingConventions: [],
                errorHandling: [],
                architecturePatterns: [],
                preferredLibraries: []
            };
        }
    }
}

import { readFileSync, existsSync } from 'fs';
import { DeepSeekProvider } from '../llm/deepseek.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface RefactorOptions {
    dryRun?: boolean;
    detailed?: boolean;
    autoPr?: boolean;
    /** Optional LLM provider — used for testing (dependency injection) */
    provider?: { generate(prompt: string): Promise<string> };
}

export async function runRefactorCommand(files: string[], options: RefactorOptions) {
    const c = {
        reset: '\x1b[0m',
        bold: '\x1b[1m',
        dim: '\x1b[2m',
        green: '\x1b[32m',
        red: '\x1b[31m',
        yellow: '\x1b[33m',
        cyan: '\x1b[36m',
    };

    if (files.length < 2) {
        console.error(`${c.red}Error: Please provide at least two files to refactor.${c.reset}`);
        console.log('Usage: prsense refactor <file1> <file2> [--dry-run]');
        process.exit(1);
        return;
    }

    console.log(`\n${c.bold}🔄 Phase 2 Refactor Engine (v2.2.0)${c.reset}\n`);

    const fileContents: { name: string; content: string }[] = [];
    for (const file of files) {
        const filePath = path.resolve(file);
        if (!existsSync(filePath)) {
            console.error(`${c.red}Error: File not found: ${file}${c.reset}`);
            process.exit(1);
            return;
        }
        fileContents.push({
            name: file,
            content: readFileSync(filePath, 'utf-8') as string
        });
    }

    console.log(`${c.dim}Loaded ${files.length} files for analysis...${c.reset}`);

    // Use injected provider (for tests) or construct one from env keys
    let provider = options.provider;
    if (!provider) {
        const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error(`${c.red}Error: Either DEEPSEEK_API_KEY or OPENAI_API_KEY is required for the Refactor Engine.${c.reset}`);
            process.exit(1);
            return;
        }
        const isDeepSeek = !!process.env.DEEPSEEK_API_KEY;
        provider = new DeepSeekProvider({
            apiKey,
            baseUrl: isDeepSeek ? 'https://api.deepseek.com' : 'https://api.openai.com/v1',
            model: isDeepSeek ? 'deepseek-chat' : 'gpt-4o-mini'
        });
        console.log(`🤖 Using ${isDeepSeek ? 'DeepSeek' : 'OpenAI'} to generate unified code...\n`);
    }

    const prompt = `You are an expert software engineer. The user has identified duplicate code across the following files.
Your goal is to extract the duplicated logic into a single, clean, highly-reusable utility function or class.
Do not include any surrounding markdown blocks (like \`\`\`typescript), just output the raw code.

${fileContents.map(f => `--- FILE: ${f.name} ---\n${f.content}\n`).join('\n')}

Generate the new, unified refactored code now:`;

    try {
        const refactoredCode = await provider.generate(prompt);

        console.log(`${c.bold}${c.green}✅ Unified Refactor Generated:${c.reset}`);
        console.log('--------------------------------------------------');
        console.log(refactoredCode.trim());
        console.log('--------------------------------------------------');

        if (options.dryRun) {
            console.log(`\n${c.yellow}⚠️  Dry run mode enabled. No files were modified.${c.reset}`);
        } else if (options.autoPr) {
            const { createAutoPr } = await import('./auto-pr.js');
            await createAutoPr(refactoredCode, 'src/utils/refactored.ts');
        } else {
            console.log(`\n${c.dim}💡 Tip: Use --auto-pr to automatically open a Pull Request with these changes.${c.reset}`);
        }

    } catch (err) {
        console.error(`${c.red}Failed to generate refactored code:${c.reset}`, err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
}

/**
 * AST-aware Chunker for Codebase RAG (v2.0.0)
 * 
 * Intelligently chunks source code by semantic boundaries (classes, functions, interfaces)
 * rather than arbitrary line counts, maximizing the relevance of context given to the LLM.
 */

export type ChunkType = 'class' | 'function' | 'interface' | 'variable' | 'unknown'

export interface CodeChunk {
    /** Absolute or relative path to the file */
    filePath: string
    /** Semantic type of the chunk */
    type: ChunkType
    /** Name of the extracted symbol (e.g., class name or function name) */
    name: string
    /** Raw source code content of the chunk */
    content: string
    /** 1-indexed starting line number */
    startLine: number
    /** 1-indexed ending line number */
    endLine: number
}

export class ASTChunker {
    /**
     * Chunk a file into semantic pieces.
     * Uses TypeScript AST for .ts/.js files if installed, otherwise uses basic line-based chunking.
     */
    async chunkFile(filePath: string, content: string): Promise<CodeChunk[]> {
        if (filePath.endsWith('.ts') || filePath.endsWith('.js') || filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
            try {
                // Try to load typescript dynamically so we don't crash if it's missing in a lightweight env
                const tsModule = await import('typescript')
                const ts = tsModule.default || tsModule
                return this.chunkTypeScript(ts, filePath, content)
            } catch (e) {
                console.warn(`[PRSense] Optional dependency 'typescript' is missing. Falling back to naive chunking for ${filePath}`)
                return this.naiveChunk(filePath, content)
            }
        }

        // Fallback for non-TS/JS files (Python, Markdown, etc. could have their own parsers later)
        return this.naiveChunk(filePath, content)
    }

    private chunkTypeScript(ts: any, filePath: string, content: string): CodeChunk[] {
        const sourceFile = ts.createSourceFile(
            filePath,
            content,
            ts.ScriptTarget.Latest,
            true
        )

        const chunks: CodeChunk[] = []

        const visit = (node: any) => {
            let processed = false

            // Try to extract named classes
            if (ts.isClassDeclaration(node) && node.name) {
                chunks.push(this.createChunkFromNode(ts, sourceFile, filePath, node, 'class', node.name.text, content))
                processed = true
            }
            // Try to extract named functions
            else if (ts.isFunctionDeclaration(node) && node.name) {
                chunks.push(this.createChunkFromNode(ts, sourceFile, filePath, node, 'function', node.name.text, content))
                processed = true
            }
            // Try to extract interfaces
            else if (ts.isInterfaceDeclaration(node) && node.name) {
                chunks.push(this.createChunkFromNode(ts, sourceFile, filePath, node, 'interface', node.name.text, content))
                processed = true
            }
            // Try to extract top-level exported variables (e.g. const myFunc = () => {})
            else if (ts.isVariableStatement(node) && node.declarationList.declarations.length > 0) {
                const isExported = node.modifiers?.some((m: any) => m.kind === ts.SyntaxKind.ExportKeyword)
                if (isExported) {
                    const decl = node.declarationList.declarations[0]
                    if (decl && decl.name && ts.isIdentifier(decl.name)) {
                        chunks.push(this.createChunkFromNode(ts, sourceFile, filePath, node, 'variable', decl.name.text, content))
                        processed = true
                    }
                }
            }

            // We do NOT descend into processed nodes to avoid deeply nested overlapping chunks
            // e.g. We don't want a chunk for the class AND chunks for all its methods by default.
            // Adjust this if method-level granularity is desired.
            if (!processed) {
                ts.forEachChild(node, visit)
            }
        }

        visit(sourceFile)

        // If we found zero semantic chunks, fall back to capturing the whole file or splitting it
        if (chunks.length === 0) {
            return this.naiveChunk(filePath, content)
        }

        return chunks
    }

    private createChunkFromNode(ts: any, sourceFile: any, filePath: string, node: any, type: ChunkType, name: string, content: string): CodeChunk {
        // Find trailing / leading comments if needed, but getStart() usually includes JSDoc if true was passed
        const startPos = node.getStart(sourceFile)
        const endPos = node.getEnd()

        const startLoc = sourceFile.getLineAndCharacterOfPosition(startPos)
        const endLoc = sourceFile.getLineAndCharacterOfPosition(endPos)

        const startLine = startLoc.line + 1
        const endLine = endLoc.line + 1

        // Extract the exact text from the source using coordinates
        const chunkContent = content.substring(startPos, endPos)

        return {
            filePath,
            type,
            name,
            content: chunkContent,
            startLine,
            endLine
        }
    }

    /**
     * Fallback naive chunking mechanism (splits every ~100 lines)
     * Useful for unparseable files or text documents.
     */
    private naiveChunk(filePath: string, content: string): CodeChunk[] {
        const CHUNK_SIZE = 100
        const lines = content.split('\n')
        const chunks: CodeChunk[] = []

        let currentContent = ''
        let startLine = 1

        for (let i = 0; i < lines.length; i++) {
            currentContent += lines[i] + (i < lines.length - 1 ? '\n' : '')

            if ((i + 1) % CHUNK_SIZE === 0 || i === lines.length - 1) {
                const endLine = i + 1
                chunks.push({
                    filePath,
                    type: 'unknown',
                    name: `lines-${startLine}-${endLine}`,
                    content: currentContent,
                    startLine,
                    endLine
                })
                currentContent = ''
                startLine = i + 2
            }
        }

        return chunks
    }
}

/**
 * Codebase Indexer for RAG (v2.0.0)
 * 
 * Takes a directory path, walks all relevant source lines, chunks them via ASTChunker,
 * embeds them, and saves them to the configured StorageBackend.
 */

import * as fs from 'fs'
import * as path from 'path'
import { ASTChunker, type CodeChunk } from './astChunker.js'
import type { EmbeddingPipeline } from '../embeddingPipeline.js'
import type { StorageBackend } from '../storage/interface.js'
import { minimatch } from 'minimatch'

export interface IndexerOptions {
    /** Directory to index. Defaults to current working directory. */
    rootDir?: string
    /** Glob patterns to exclude (e.g. node_modules, dist, .git) */
    excludePatterns?: string[]
    /** Glob patterns to include (e.g. *.ts, *.js, *.py) - defaults to all text-like if omitted */
    includePatterns?: string[]
}

export class CodebaseIndexer {
    private chunker = new ASTChunker()

    constructor(
        private pipeline: EmbeddingPipeline,
        private storage: StorageBackend
    ) {
        if (!this.storage.saveChunk) {
            console.warn('[PRSense RAG] Provided StorageBackend does not implement saveChunk(). Indexing will discard vectors.')
        }
    }

    /**
     * Recursively index a local directory
     */
    async indexDirectory(opts: IndexerOptions = {}): Promise<number> {
        const rootDir = opts.rootDir || process.cwd()
        const excludePatterns = opts.excludePatterns || ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/*.min.js']
        const includePatterns = opts.includePatterns // If empty, index everything that's relatively small and text

        let totalChunksIndexed = 0

        const files = this.walkDir(rootDir, rootDir, excludePatterns, includePatterns)

        for (const file of files) {
            const absolutePath = path.join(rootDir, file)
            // Skip large generated files or binaries
            const stats = fs.statSync(absolutePath)
            if (stats.size > 1024 * 1024) continue // Skip > 1MB files

            try {
                const content = fs.readFileSync(absolutePath, 'utf-8')

                // Extremely basic binary check
                if (content.indexOf('\0') !== -1) continue

                const chunks = await this.chunker.chunkFile(file, content)

                for (const chunk of chunks) {
                    // Embed the chunk
                    // We combine the file path and the content to give the model better grounding
                    const textToEmbed = `File: ${chunk.filePath}\nSymbol: ${chunk.name} (${chunk.type})\n\n${chunk.content}`

                    try {
                        const { textEmbedding } = await this.pipeline.run(textToEmbed, '', '')

                        if (this.storage.saveChunk) {
                            await this.storage.saveChunk({
                                ...chunk,
                                embedding: textEmbedding
                            })
                        }
                        totalChunksIndexed++
                    } catch (e) {
                        console.error(`[CodebaseIndexer] Failed to embed chunk ${chunk.name} in ${file}:`, e)
                    }
                }
            } catch (err) {
                console.warn(`[CodebaseIndexer] Failed to process file ${file}:`, err)
            }
        }

        return totalChunksIndexed
    }

    private walkDir(dir: string, rootDir: string, excludes: string[], includes?: string[]): string[] {
        let results: string[] = []
        const list = fs.readdirSync(dir)

        for (const file of list) {
            const absolutePath = path.join(dir, file)
            const relativePath = path.relative(rootDir, absolutePath)
            // Normalize path for minimatch on Windows
            const normalizedPath = relativePath.split(path.sep).join('/')

            // Check excludes
            if (excludes.some(pattern => minimatch(normalizedPath, pattern, { dot: true }))) {
                continue
            }

            const stat = fs.statSync(absolutePath)
            if (stat && stat.isDirectory()) {
                results = results.concat(this.walkDir(absolutePath, rootDir, excludes, includes))
            } else {
                // Check includes if provided
                if (includes && includes.length > 0) {
                    if (!includes.some(pattern => minimatch(normalizedPath, pattern))) {
                        continue
                    }
                }
                results.push(relativePath)
            }
        }
        return results
    }
}

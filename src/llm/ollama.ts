/**
 * Local Enterprise Privacy Provider (Phase 6)
 * 
 * Implements Ollama integration to run PRSense completely on-premise
 * without sending proprietary source code or PR context to OpenAI.
 * 
 * Supports both RAG Generation (LLMProvider) and Text Embedding (Embedder).
 */

import type { LLMProvider } from '../rag/queryEngine.js'
import type { Embedder } from '../embeddingPipeline.js'

export interface OllamaConfig {
    /** 
     * The base URL of the Ollama server.
     * @default 'http://localhost:11434'
     */
    baseUrl?: string
    /**
     * The LLM model to use for text generation (e.g., 'llama3', 'mistral', 'codellama').
     * @default 'llama3'
     */
    model?: string
    /**
     * The model to use for embeddings (e.g., 'nomic-embed-text').
     * @default 'nomic-embed-text'
     */
    embeddingModel?: string
}

export class OllamaProvider implements LLMProvider, Embedder {
    private baseUrl: string
    private model: string
    private embeddingModel: string

    constructor(config: OllamaConfig = {}) {
        this.baseUrl = (config.baseUrl || 'http://localhost:11434').replace(/\/$/, '')
        this.model = config.model || 'llama3'
        this.embeddingModel = config.embeddingModel || 'nomic-embed-text'
    }

    // --- LLMProvider Implementation ---

    /**
     * Generate text using the configured Ollama LLM.
     * Used natively by the RAGQueryEngine for answering questions.
     */
    async generate(prompt: string): Promise<string> {
        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    prompt: prompt,
                    stream: false
                })
            })

            if (!response.ok) {
                const errText = await response.text()
                throw new Error(`Ollama generation failed: HTTP ${response.status} - ${errText}`)
            }

            const data = await response.json() as any
            return data.response
        } catch (error) {
            console.error('[OllamaProvider] Error calling /api/generate:', error)
            throw error
        }
    }

    // --- Embedder Implementation ---

    /**
     * Embed standard text (like PR bodies or codebase chunks).
     */
    async embedText(text: string): Promise<Float32Array> {
        return this.getOllamaEmbedding(text)
    }

    /**
     * Embed raw diffs natively.
     */
    async embedDiff(diff: string): Promise<Float32Array> {
        return this.getOllamaEmbedding(diff)
    }

    private async getOllamaEmbedding(prompt: string): Promise<Float32Array> {
        try {
            const response = await fetch(`${this.baseUrl}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.embeddingModel,
                    prompt: prompt
                })
            })

            if (!response.ok) {
                const errText = await response.text()
                throw new Error(`Ollama embedding failed: HTTP ${response.status} - ${errText}`)
            }

            const data = await response.json() as any

            // Post-process the embedding to ensure it matches the dimension PRSense expects 
            // (Standard PRSense ONNX uses 384. OpenAI uses 1536. nomic-embed-text uses 768.)
            // The pipeline will handle dimensionality reduction or comparison automatically, 
            // but we must cast to Float32Array.

            if (!data.embedding || !Array.isArray(data.embedding)) {
                throw new Error('Ollama returned invalid embedding format.')
            }

            return new Float32Array(data.embedding)
        } catch (error) {
            console.error('[OllamaProvider] Error calling /api/embeddings:', error)
            throw error
        }
    }
}

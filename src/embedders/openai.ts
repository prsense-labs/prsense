/**
 * OpenAI Embeddings Integration
 * 
 * Production-ready embedder using OpenAI's text-embedding-3-small model
 */

import type { Embedder } from '../embeddingPipeline.js'
import { EmbeddingError, ValidationError } from '../errors.js'

export interface OpenAIConfig {
    apiKey: string
    model?: string
    dimensions?: number
}

interface OpenAIResponse {
    data: Array<{
        embedding: number[]
    }>
    usage?: {
        prompt_tokens: number
        total_tokens: number
    }
}

interface OpenAIError {
    error: {
        message: string
        type: string
        code?: string
    }
}

/**
 * OpenAI embedder for production use
 */
export class OpenAIEmbedder implements Embedder {
    private apiKey: string
    private model: string
    private dimensions: number
    private baseURL = 'https://api.openai.com/v1/embeddings'

    constructor(config: OpenAIConfig) {
        if (!config.apiKey || typeof config.apiKey !== 'string' || config.apiKey.trim().length === 0) {
            throw new ValidationError('OpenAI API key is required', 'apiKey')
        }

        this.apiKey = config.apiKey.trim()
        this.model = config.model || 'text-embedding-3-small'
        
        if (config.dimensions !== undefined) {
            if (!Number.isInteger(config.dimensions) || config.dimensions < 1 || config.dimensions > 3072) {
                throw new ValidationError('dimensions must be an integer between 1 and 3072', 'dimensions')
            }
            this.dimensions = config.dimensions
        } else {
            this.dimensions = 512 // Reduced dimensions for speed
        }
    }

    async embedText(text: string): Promise<Float32Array> {
        return this.getEmbedding(text)
    }

    async embedDiff(diff: string): Promise<Float32Array> {
        // For diffs, we might want to preprocess
        const cleanDiff = this.preprocessDiff(diff)
        return this.getEmbedding(cleanDiff)
    }

    private async getEmbedding(text: string): Promise<Float32Array> {
        if (typeof text !== 'string') {
            throw new ValidationError('Text input must be a string', 'text')
        }

        if (text.length === 0) {
            throw new ValidationError('Text input cannot be empty', 'text')
        }

        if (text.length > 8000) {
            // OpenAI has token limits, roughly 1 token = 4 characters
            throw new ValidationError('Text input must be 8000 characters or less', 'text')
        }

        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

            const response = await fetch(this.baseURL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    input: text,
                    model: this.model,
                    dimensions: this.dimensions
                }),
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
                let errorMessage = `OpenAI API error: ${response.status} ${response.statusText}`
                try {
                    const errorData = await response.json() as OpenAIError
                    if (errorData.error?.message) {
                        errorMessage = `OpenAI API error: ${errorData.error.message}`
                    }
                } catch {
                    // If error parsing fails, use default message
                }
                throw new EmbeddingError(errorMessage)
            }

            const data = await response.json() as OpenAIResponse

            if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
                throw new EmbeddingError('Invalid response format from OpenAI API')
            }

            const embedding = data.data[0]?.embedding
            if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
                throw new EmbeddingError('Empty embedding received from OpenAI API')
            }

            return new Float32Array(embedding)
        } catch (error) {
            if (error instanceof EmbeddingError || error instanceof ValidationError) {
                throw error
            }
            if ((error as Error).name === 'AbortError') {
                throw new EmbeddingError('OpenAI API request timeout after 30s')
            }
            throw new EmbeddingError(
                `Failed to get embedding: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : undefined
            )
        }
    }

    private preprocessDiff(diff: string): string {
        // Remove diff metadata, keep only actual code changes
        const lines = diff.split('\n')
        const codeLines = lines.filter(line => {
            // Keep added/removed lines and context
            return line.startsWith('+') ||
                line.startsWith('-') ||
                (!line.startsWith('@@') &&
                    !line.startsWith('diff') &&
                    !line.startsWith('index'))
        })

        // Limit to 8000 tokens (roughly 6000 chars)
        const cleanDiff = codeLines.join('\n').slice(0, 6000)
        return cleanDiff
    }
}

/**
 * Create OpenAI embedder from environment variable
 */
export function createOpenAIEmbedder(): OpenAIEmbedder {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
        throw new ValidationError(
            'OPENAI_API_KEY environment variable is required. ' +
            'Get your key at: https://platform.openai.com/api-keys',
            'OPENAI_API_KEY'
        )
    }

    const config: OpenAIConfig = {
        apiKey,
        model: process.env.OPENAI_MODEL || 'text-embedding-3-small'
    }

    if (process.env.EMBEDDING_DIMENSIONS) {
        const dims = parseInt(process.env.EMBEDDING_DIMENSIONS, 10)
        if (!isNaN(dims)) {
            config.dimensions = dims
        }
    }

    return new OpenAIEmbedder(config)
}

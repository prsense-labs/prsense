/**
 * Local Sentence-BERT Embeddings
 * 
 * Runs embeddings locally using a Python service
 * Faster and free (after setup), but requires Python
 */

import type { Embedder } from '../embeddingPipeline.js'
import { EmbeddingError, ValidationError } from '../errors.js'

export interface LocalEmbedderConfig {
    serviceUrl?: string
    timeout?: number
}

/**
 * Local embedder that calls a Python/FastAPI service
 * 
 * Setup instructions:
 * 1. Install: pip install sentence-transformers fastapi uvicorn
 * 2. Run server: python embedding-server.py
 * 3. Use this embedder
 */
export class LocalEmbedder implements Embedder {
    private serviceUrl: string
    private timeout: number

    constructor(config: LocalEmbedderConfig = {}) {
        const serviceUrl = config.serviceUrl || process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8000'
        
        // Validate URL
        try {
            new URL(serviceUrl)
            this.serviceUrl = serviceUrl
        } catch {
            throw new ValidationError(`Invalid service URL: ${serviceUrl}`, 'serviceUrl')
        }

        const timeout = config.timeout || 5000
        if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 60000) {
            throw new ValidationError('timeout must be an integer between 1000 and 60000 milliseconds', 'timeout')
        }
        this.timeout = timeout
    }

    async embedText(text: string): Promise<Float32Array> {
        return this.getEmbedding(text, 'text')
    }

    async embedDiff(diff: string): Promise<Float32Array> {
        return this.getEmbedding(diff, 'code')
    }

    private async getEmbedding(text: string, type: 'text' | 'code'): Promise<Float32Array> {
        if (typeof text !== 'string') {
            throw new ValidationError('Text input must be a string', 'text')
        }

        if (text.length === 0) {
            throw new ValidationError('Text input cannot be empty', 'text')
        }

        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), this.timeout)

            const response = await fetch(`${this.serviceUrl}/embed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, type }),
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
                let errorMessage = `Embedding service error: ${response.status} ${response.statusText}`
                try {
                    const errorData = await response.json()
                    if (typeof errorData === 'object' && errorData !== null && 'error' in errorData) {
                        errorMessage = String(errorData.error) || errorMessage
                    }
                } catch {
                    // If error parsing fails, use default message
                }
                throw new EmbeddingError(errorMessage)
            }

            const data = await response.json() as { embedding?: number[] | Float32Array }

            if (!data || !data.embedding) {
                throw new EmbeddingError('Invalid response format: missing embedding field')
            }

            const embedding = data.embedding
            const embeddingArray = embedding instanceof Float32Array 
                ? Array.from(embedding)
                : Array.isArray(embedding) 
                    ? embedding 
                    : []

            if (embeddingArray.length === 0) {
                throw new EmbeddingError('Empty embedding received from service')
            }

            // Validate all values are numbers
            const validEmbedding = embeddingArray.map(v => {
                const num = Number(v)
                return isNaN(num) ? 0 : num
            })

            return new Float32Array(validEmbedding)

        } catch (error) {
            if (error instanceof EmbeddingError || error instanceof ValidationError) {
                throw error
            }
            if ((error as Error).name === 'AbortError') {
                throw new EmbeddingError(`Embedding service timeout after ${this.timeout}ms`)
            }
            throw new EmbeddingError(
                `Failed to get embedding: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : undefined
            )
        }
    }
}

/**
 * Python server code (save as embedding-server.py):
 * 
 * ```python
 * from fastapi import FastAPI
 * from sentence_transformers import SentenceTransformer
 * from pydantic import BaseModel
 * import uvicorn
 * 
 * app = FastAPI()
 * model = SentenceTransformer('all-MiniLM-L6-v2')  # 384 dimensions, fast
 * 
 * class EmbedRequest(BaseModel):
 *     text: str
 *     type: str = "text"
 * 
 * @app.post("/embed")
 * async def embed(request: EmbedRequest):
 *     embedding = model.encode(request.text)
 *     return {"embedding": embedding.tolist()}
 * 
 * if __name__ == "__main__":
 *     uvicorn.run(app, host="0.0.0.0", port=8000)
 * ```
 * 
 * Run with: python embedding-server.py
 */

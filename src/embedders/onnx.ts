/**
 * ONNX Local Embeddings (Feature 7)
 * 
 * 100% offline, no API key needed
 * Uses ONNX Runtime to run Sentence-BERT models locally
 * 
 * Setup:
 * 1. npm install onnxruntime-node
 * 2. Download model: all-MiniLM-L6-v2 ONNX format
 */

import type { Embedder } from '../embeddingPipeline.js'

export interface ONNXEmbedderConfig {
    /** Path to the ONNX model file */
    modelPath?: string
    /** Maximum sequence length (default: 256) */
    maxLength?: number
    /** Embedding dimensions (depends on model, default: 384) */
    dimensions?: number
}

/**
 * Simple tokenizer for ONNX embeddings
 * In production, use a proper tokenizer like @xenova/transformers
 */
function simpleTokenize(text: string, maxLength: number): { inputIds: number[]; attentionMask: number[] } {
    // Simple word-based tokenization with padding
    // For production, use a real tokenizer!
    const words = text.toLowerCase().split(/\s+/).slice(0, maxLength)
    const inputIds: number[] = []
    const attentionMask: number[] = []

    // Simple hash-based token IDs (placeholder)
    for (const word of words) {
        let hash = 0
        for (let i = 0; i < word.length; i++) {
            hash = ((hash << 5) - hash) + word.charCodeAt(i)
            hash = hash & 0x7fff // Keep in vocab range
        }
        inputIds.push(hash)
        attentionMask.push(1)
    }

    // Pad to maxLength
    while (inputIds.length < maxLength) {
        inputIds.push(0)
        attentionMask.push(0)
    }

    return { inputIds, attentionMask }
}

/**
 * Mean pooling over token embeddings
 */
function meanPooling(embeddings: Float32Array, attentionMask: number[], seqLen: number, hiddenSize: number): Float32Array {
    const result = new Float32Array(hiddenSize)
    let count = 0

    for (let i = 0; i < seqLen && i < attentionMask.length; i++) {
        const maskVal = attentionMask[i]
        if (maskVal === 1) {
            for (let j = 0; j < hiddenSize; j++) {
                const idx = i * hiddenSize + j
                if (idx < embeddings.length) {
                    const embVal = embeddings[idx]
                    if (embVal !== undefined && !isNaN(embVal)) {
                        result[j] = (result[j] || 0) + embVal
                    }
                }
            }
            count++
        }
    }

    if (count > 0) {
        for (let j = 0; j < hiddenSize; j++) {
            const currentVal = result[j]
            if (currentVal !== undefined && !isNaN(currentVal)) {
                result[j] = currentVal / count
            } else {
                result[j] = 0
            }
        }
    }

    return result
}

/**
 * ONNX-based local embedder
 * Runs entirely on your machine - no API calls!
 */
export class ONNXEmbedder implements Embedder {
    private modelPath: string
    private maxLength: number
    private dimensions: number
    private session: any = null
    private initialized: boolean = false

    constructor(config: ONNXEmbedderConfig = {}) {
        this.modelPath = config.modelPath || './models/all-MiniLM-L6-v2.onnx'
        this.maxLength = config.maxLength || 256
        this.dimensions = config.dimensions || 384
    }

    private async initialize(): Promise<void> {
        if (this.initialized) return

        try {
            // Dynamic import to avoid requiring onnxruntime if not used
            // @ts-ignore - onnxruntime-node is optional dependency
            const ort = await import('onnxruntime-node').catch(() => null)
            if (ort && ort.InferenceSession) {
                this.session = await ort.InferenceSession.create(this.modelPath)
                this.initialized = true
            } else {
                // Fallback mode - will use fallback embedding
                console.warn(
                    'onnxruntime-node is not installed. Using fallback embedding.\n' +
                    'Install with: npm install onnxruntime-node\n' +
                    'Also download the model: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2'
                )
                this.initialized = true // Mark as initialized to avoid retries
            }
        } catch (error) {
            const err = error as Error
            console.warn(`Failed to load ONNX model, using fallback: ${err.message || String(error)}`)
            this.initialized = true // Mark as initialized to avoid retries
        }
    }

    async embedText(text: string): Promise<Float32Array> {
        return this.getEmbedding(text)
    }

    async embedDiff(diff: string): Promise<Float32Array> {
        // Clean diff for better embeddings
        const cleanDiff = diff
            .split('\n')
            .filter(line => line.startsWith('+') || line.startsWith('-'))
            .slice(0, 100) // Limit lines
            .join('\n')
        return this.getEmbedding(cleanDiff)
    }

    private async getEmbedding(text: string): Promise<Float32Array> {
        await this.initialize()

        if (!this.session) {
            // Fallback to simple hash-based embedding if no ONNX
            return this.fallbackEmbedding(text)
        }

        if (!this.session) {
            return this.fallbackEmbedding(text)
        }

        try {
            // @ts-ignore - dynamic import, may not be available
            const ort = await import('onnxruntime-node').catch(() => null)
            if (!ort || !ort.Tensor) {
                return this.fallbackEmbedding(text)
            }

            const { inputIds, attentionMask } = simpleTokenize(text, this.maxLength)

            const inputIdsTensor = new ort.Tensor('int64', BigInt64Array.from(inputIds.map(BigInt)), [1, this.maxLength])
            const attentionMaskTensor = new ort.Tensor('int64', BigInt64Array.from(attentionMask.map(BigInt)), [1, this.maxLength])

            const results = await this.session.run({
                input_ids: inputIdsTensor,
                attention_mask: attentionMaskTensor
            })

            const outputData = results['last_hidden_state']?.data as Float32Array | undefined
            if (!outputData) {
                return this.fallbackEmbedding(text)
            }
            return meanPooling(outputData, attentionMask, this.maxLength, this.dimensions)
        } catch (error) {
            console.warn('ONNX inference failed, using fallback:', error)
            return this.fallbackEmbedding(text)
        }
    }

    /**
     * Simple fallback embedding when ONNX is not available
     * Uses character-based hashing - good enough for testing
     */
    private fallbackEmbedding(text: string): Float32Array {
        const vec = new Float32Array(this.dimensions)
        const normalized = text.toLowerCase()

        for (let i = 0; i < normalized.length && i < 10000; i++) {
            const charCode = normalized.charCodeAt(i)
            const idx = (charCode * (i + 1)) % this.dimensions
            vec[idx] = (vec[idx] || 0) + 1 / Math.sqrt(normalized.length + 1)
        }

        // Normalize
        let norm = 0
        for (let i = 0; i < this.dimensions; i++) {
            const val = vec[i] || 0
            norm += val * val
        }
        norm = Math.sqrt(norm)
        if (norm > 0) {
            for (let i = 0; i < this.dimensions; i++) {
                vec[i] = (vec[i] || 0) / norm
            }
        }

        return vec
    }
}

/**
 * Create ONNX embedder from environment variables
 */
export function createONNXEmbedder(): ONNXEmbedder {
    return new ONNXEmbedder({
        modelPath: process.env.ONNX_MODEL_PATH || './models/all-MiniLM-L6-v2.onnx',
        maxLength: parseInt(process.env.ONNX_MAX_LENGTH || '256'),
        dimensions: parseInt(process.env.ONNX_DIMENSIONS || '384')
    })
}

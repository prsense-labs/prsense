/**
 * 
 * interface for pluggable embedding backends
 * 
 * keeps ML concerns isolated from infra logic
 * 
 * 
 */

export interface Embedder {
    embedText(text: string): Promise<Float32Array>
    embedDiff(diff: string): Promise<Float32Array>
}

export class EmbeddingPipeline {
    constructor(private embedder: Embedder) { }

    async run(
        title: string,
        body: string,
        diff: string
    ): Promise<{
        textEmbedding: Float32Array
        diffEmbedding: Float32Array
    }> {
        const text = `${title}\n${body}`

        return {
            textEmbedding: await this.embedder.embedText(text),
            diffEmbedding: await this.embedder.embedDiff(diff)
        }
    }
}
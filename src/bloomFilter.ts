/**
 * probabilistic set for fast rejection of unrelated PRs
 * 
 * 0(1) lookup
 * false positives allowed
 * false negatives forbidden
 */
export class BloomFilter {
    private bits: Uint8Array
    private size: number
    private hashes: number

    constructor(size = 8192, hashes = 5) {
        this.size = size
        this.hashes = hashes
        this.bits = new Uint8Array(size)
    }

    private hash(value: string, seed: number): number {
        let h = seed
        for (let i = 0; i < value.length; i++) {
            h = (h * 31 + value.charCodeAt(i)) % this.size
        }
        return h
    }
    /**
     * inserts a value into the filter
     */
    add(value: string): void {
        for (let i = 0; i < this.hashes; i++) {
            this.bits[this.hash(value, i + 1)] = 1
        }
    }

    /**
     * returns false only if value is definitely not present
     */
    mightContain(value: string): boolean {
        for (let i = 0; i < this.hashes; i++) {
            if (this.bits[this.hash(value, i + 1)] === 0) {
                return false
            }
        }
        return true
    }

    /**
     * Export filter state as base64 string
     */
    export(): string {
        return Buffer.from(this.bits).toString('base64')
    }

    /**
     * Import filter state from base64 string
     */
    import(data: string): void {
        const buffer = Buffer.from(data, 'base64')
        if (buffer.length !== this.size) {
            throw new Error(`Bloom filter size mismatch: expected ${this.size}, got ${buffer.length}`)
        }
        this.bits = new Uint8Array(buffer)
    }
}


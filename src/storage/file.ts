import * as fs from 'fs/promises'
import * as path from 'path'
import { PRSenseDetector } from '../prsense.js'

/**
 * File-based storage for PRSense state
 */
export class FileStorage {
    private filePath: string

    constructor(filePath: string) {
        this.filePath = filePath
    }

    /**
     * Save detector state to file
     */
    async save(detector: PRSenseDetector): Promise<void> {
        const state = detector.exportState()
        const json = JSON.stringify(state, null, 2)

        // Ensure directory exists
        const dir = path.dirname(this.filePath)
        await fs.mkdir(dir, { recursive: true })

        await fs.writeFile(this.filePath, json, 'utf-8')
    }

    /**
     * Load detector state from file
     */
    async load(detector: PRSenseDetector): Promise<void> {
        try {
            const content = await fs.readFile(this.filePath, 'utf-8')
            const state = JSON.parse(content)
            detector.importState(state)
        } catch (error) {
            // If file doesn't exist, start fresh
            if ((error as any).code === 'ENOENT') {
                return
            }
            throw error
        }
    }
}

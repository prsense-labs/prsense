import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runRefactorCommand } from './engine.js'

// ── Shared mock provider ──────────────────────────────────────────────────────
const MOCK_RESULT = 'export function unifiedUtility() { console.log("unified"); }'
const mockGenerate = vi.fn().mockResolvedValue(MOCK_RESULT)
const mockProvider = { generate: mockGenerate }

// ── Mock fs ───────────────────────────────────────────────────────────────────
vi.mock('fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue('const a = 1;')
}))

// ── Mock auto-pr ──────────────────────────────────────────────────────────────
const mockCreateAutoPr = vi.fn().mockResolvedValue(undefined)
vi.mock('./auto-pr.js', () => ({
    createAutoPr: mockCreateAutoPr
}))

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('RefactorEngine', () => {
    let mockExit: ReturnType<typeof vi.spyOn>
    let mockConsoleLog: ReturnType<typeof vi.spyOn>
    let mockConsoleError: ReturnType<typeof vi.spyOn>

    beforeEach(async () => {
        vi.clearAllMocks()
        mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
        mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
        mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        mockGenerate.mockResolvedValue(MOCK_RESULT)
    })

    it('should fail if less than two files are provided', async () => {
        await runRefactorCommand(['file1.ts'], { provider: mockProvider })
        expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Please provide at least two files'))
        expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should fail if a file does not exist', async () => {
        const { existsSync } = await import('fs')
        vi.mocked(existsSync).mockReturnValue(false)
        await runRefactorCommand(['file1.ts', 'file2.ts'], { provider: mockProvider })
        expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('File not found'))
        expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should generate refactored code and print it', async () => {
        const { existsSync } = await import('fs')
        vi.mocked(existsSync).mockReturnValue(true)

        await runRefactorCommand(['file1.ts', 'file2.ts'], { provider: mockProvider, dryRun: true })

        expect(mockGenerate).toHaveBeenCalledOnce()
        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('unifiedUtility'))
        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Dry run mode enabled'))
        expect(mockExit).not.toHaveBeenCalled()
    })

    it('should trigger Auto-PR when autoPr flag is set', async () => {
        const { existsSync } = await import('fs')
        vi.mocked(existsSync).mockReturnValue(true)

        await runRefactorCommand(['file1.ts', 'file2.ts'], { provider: mockProvider, autoPr: true })

        expect(mockCreateAutoPr).toHaveBeenCalledWith(MOCK_RESULT, 'src/utils/refactored.ts')
        expect(mockExit).not.toHaveBeenCalled()
    })
})

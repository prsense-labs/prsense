import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks (vi.mock is hoisted to top, so refs must be hoisted too) ────
const { mockExecSync, mockWriteFileSync } = vi.hoisted(() => ({
    mockExecSync: vi.fn(),
    mockWriteFileSync: vi.fn()
}))

vi.mock('child_process', () => ({ execSync: mockExecSync }))
vi.mock('fs', () => ({ writeFileSync: mockWriteFileSync }))

// ── Import SUT after mocks are registered ─────────────────────────────────────
import { createAutoPr } from './auto-pr.js'

describe('Auto-PR Agent', () => {
    let mockExit: ReturnType<typeof vi.spyOn>
    let mockConsoleLog: ReturnType<typeof vi.spyOn>
    let mockConsoleError: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        vi.clearAllMocks()
        mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
        mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
        mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('should fail if gh cli is not installed', async () => {
        mockExecSync.mockImplementationOnce(() => { throw new Error('command not found') })

        await createAutoPr('const code = true;', 'test.ts')

        expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('GitHub CLI (gh) is not installed'))
        expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should fail if working directory has uncommitted changes', async () => {
        mockExecSync.mockImplementationOnce(() => undefined)             // gh --version (stdio:ignore)
        mockExecSync.mockImplementationOnce(() => ' M src/dirty.ts')    // git status (encoding:utf-8)

        await createAutoPr('const code = true;', 'test.ts')

        expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('uncommitted changes'))
        expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should execute full git workflow and create PR successfully', async () => {
        mockExecSync
            .mockImplementationOnce(() => undefined)                            // 1. gh --version
            .mockImplementationOnce(() => '')                                   // 2. git status (clean)
            .mockImplementationOnce(() => undefined)                            // 3. git checkout -b
            .mockImplementationOnce(() => undefined)                            // 4. git add
            .mockImplementationOnce(() => undefined)                            // 5. git commit
            .mockImplementationOnce(() => undefined)                            // 6. git push
            .mockImplementationOnce(() => 'https://github.com/test/pull/1')    // 7. gh pr create
            .mockImplementationOnce(() => undefined)                            // 8. git checkout -

        await createAutoPr('const code = true;', 'src/utils/test.ts')

        expect(mockWriteFileSync).toHaveBeenCalledWith('src/utils/test.ts', 'const code = true;', 'utf-8')

        const calls = mockExecSync.mock.calls.map(c => String(c[0]))
        expect(calls.some(cmd => cmd.startsWith('git checkout -b prsense/refactor-'))).toBe(true)
        expect(calls.some(cmd => cmd.includes('git commit'))).toBe(true)
        expect(calls.some(cmd => cmd.startsWith('gh pr create'))).toBe(true)

        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Auto-PR created successfully'))
        expect(mockExit).not.toHaveBeenCalled()
    })
})

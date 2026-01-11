import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'dist/',
                'examples/',
                'bin/',
                '**/*.d.ts',
                '**/*.config.*',
                '**/test.ts'
            ],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 75,
                statements: 80
            }
        },
        include: ['src/**/*.test.ts'],
        exclude: ['node_modules', 'dist']
    },
    resolve: {
        extensions: ['.ts', '.js', '.mts', '.mjs']
    }
})

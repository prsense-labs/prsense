import { describe, it, expect } from 'vitest'
import { DescriptionGenerator } from './descriptionGenerator.js'

describe('DescriptionGenerator', () => {
    it('should generate a basic description for a feature PR', async () => {
        const generator = new DescriptionGenerator()
        const pr = {
            title: 'Add new user profile page',
            author: 'alice',
            files: ['src/components/Profile.tsx', 'src/styles/profile.css'],
            diff: '@@ -0,0 +1,50 @@\n+export function Profile() {}\n+const a = 1;\n+const b = 2;\n+const c = 3;'
        }

        const description = await generator.generate(pr)
        expect(description).toContain('**Type:** Feature')
        expect(description).toContain('**Author:** @alice')
        expect(description).toContain('src/components/Profile.tsx')
    })

    it('should generate a description for a bug fix PR', async () => {
        const generator = new DescriptionGenerator()
        const pr = {
            title: 'Fix random crash on startup',
            author: 'bob',
            files: ['src/main.ts'],
            diff: '@@ -10,3 +10,3 @@\n- crash_here();\n+ // fixed\n'
        }

        const description = await generator.generate(pr)
        expect(description).toContain('**Type:** Bug Fix')
        expect(description).toContain('**Author:** @bob')
        expect(description).toContain('src/main.ts')
    })

    it('should identify documentation changes', async () => {
        const generator = new DescriptionGenerator()
        const pr = {
            title: 'Update readme with new api endpoints',
            author: 'charlie',
            files: ['README.md', 'docs/api.md'],
            diff: '@@ -10,3 +10,3 @@\n+ ## new api\n'
        }

        const description = await generator.generate(pr)
        expect(description).toContain('Documentation')
    })
})

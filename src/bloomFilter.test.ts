import { describe, it, expect } from 'vitest'
import { BloomFilter } from './bloomFilter.js'

describe('BloomFilter', () => {
    describe('add and mightContain', () => {
        it('should return true for added elements', () => {
            const bloom = new BloomFilter()
            bloom.add('test')
            expect(bloom.mightContain('test')).toBe(true)
        })

        it('should return false for elements definitely not present', () => {
            const bloom = new BloomFilter()
            bloom.add('test')
            expect(bloom.mightContain('definitely-not-there')).toBe(false)
        })

        it('should handle multiple elements', () => {
            const bloom = new BloomFilter()
            const items = ['item1', 'item2', 'item3', 'item4', 'item5']

            items.forEach(item => bloom.add(item))
            items.forEach(item => {
                expect(bloom.mightContain(item)).toBe(true)
            })
        })

        it('should handle empty strings', () => {
            const bloom = new BloomFilter()
            bloom.add('')
            expect(bloom.mightContain('')).toBe(true)
        })

        it('should be case-sensitive', () => {
            const bloom = new BloomFilter()
            bloom.add('Test')
            expect(bloom.mightContain('Test')).toBe(true)
        })
    })

    describe('false positive rate', () => {
        it('should have low false positive rate for small datasets', () => {
            const bloom = new BloomFilter(8192, 5)
            const addedItems = Array.from({ length: 100 }, (_, i) => `item${i}`)
            const notAddedItems = Array.from({ length: 100 }, (_, i) => `notitem${i}`)

            addedItems.forEach(item => bloom.add(item))

            // All added items should be found
            addedItems.forEach(item => {
                expect(bloom.mightContain(item)).toBe(true)
            })

            // Count false positives
            const falsePositives = notAddedItems.filter(item =>
                bloom.mightContain(item)
            ).length

            // False positive rate should be reasonable (< 10% for this config)
            expect(falsePositives).toBeLessThan(10)
        })
    })

    describe('edge cases', () => {
        it('should work with custom size and hash count', () => {
            const bloom = new BloomFilter(1024, 3)
            bloom.add('custom')
            expect(bloom.mightContain('custom')).toBe(true)
        })

        it('should handle special characters', () => {
            const bloom = new BloomFilter()
            const special = '!@#$%^&*()_+-=[]{}|;:,.<>?'
            bloom.add(special)
            expect(bloom.mightContain(special)).toBe(true)
        })

        it('should handle unicode characters', () => {
            const bloom = new BloomFilter()
            const unicode = '你好世界🎯🚀'
            bloom.add(unicode)
            expect(bloom.mightContain(unicode)).toBe(true)
        })

        it('should handle very long strings', () => {
            const bloom = new BloomFilter()
            const longString = 'a'.repeat(10000)
            bloom.add(longString)
            expect(bloom.mightContain(longString)).toBe(true)
        })
    })

    describe('deterministic behavior', () => {
        it('should give consistent results for same input', () => {
            const bloom = new BloomFilter()
            bloom.add('consistent')

            // Query multiple times should give same result
            expect(bloom.mightContain('consistent')).toBe(true)
            expect(bloom.mightContain('consistent')).toBe(true)
            expect(bloom.mightContain('consistent')).toBe(true)
        })
    })
})

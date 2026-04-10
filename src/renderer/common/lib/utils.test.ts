import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
    it('merges simple classes', () => {
        expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('handles conditional classes', () => {
        expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
    })

    it('resolves conflicting Tailwind classes (last wins)', () => {
        const result = cn('p-4', 'p-2')
        expect(result).toBe('p-2')
    })

    it('handles undefined and null', () => {
        expect(cn('a', undefined, null, 'b')).toBe('a b')
    })

    it('handles empty input', () => {
        expect(cn()).toBe('')
    })
})

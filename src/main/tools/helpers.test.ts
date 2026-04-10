import { describe, it, expect } from 'vitest'
import { escapeForJs, sanitizeSelector } from './helpers'

describe('escapeForJs', () => {
    it('escapes backslash', () => {
        expect(escapeForJs('\\')).toBe('\\\\')
    })

    it('escapes single quote', () => {
        expect(escapeForJs("'")).toBe("\\'")
    })

    it('escapes backtick', () => {
        expect(escapeForJs('`')).toBe('\\`')
    })

    it('escapes dollar sign', () => {
        expect(escapeForJs('$')).toBe('\\$')
    })

    it('escapes newline', () => {
        expect(escapeForJs('\n')).toBe('\\n')
    })

    it('escapes carriage return', () => {
        expect(escapeForJs('\r')).toBe('\\r')
    })

    it('escapes null byte', () => {
        expect(escapeForJs('\0')).toBe('\\0')
    })

    it('escapes unicode line separator', () => {
        expect(escapeForJs('\u2028')).toBe('\\u2028')
    })

    it('escapes unicode paragraph separator', () => {
        expect(escapeForJs('\u2029')).toBe('\\u2029')
    })

    it('escapes a combined string', () => {
        expect(escapeForJs("hello\\world'`$\n")).toBe("hello\\\\world\\'\\`\\$\\n")
    })
})

describe('sanitizeSelector', () => {
    it('extracts last element from JSON array', () => {
        expect(sanitizeSelector('["#foo", ".bar > .baz"]')).toBe('.bar > .baz')
    })

    it('passes through a plain selector', () => {
        expect(sanitizeSelector('#my-id')).toBe('#my-id')
    })

    it('trims whitespace', () => {
        expect(sanitizeSelector('  .foo  ')).toBe('.foo')
    })

    it('keeps invalid JSON as-is (trimmed)', () => {
        expect(sanitizeSelector('[not json')).toBe('[not json')
    })

    it('returns last element from single-element array', () => {
        expect(sanitizeSelector('["#only"]')).toBe('#only')
    })

    it('handles empty array by treating as plain selector', () => {
        expect(sanitizeSelector('[]')).toBe('[]')
    })
})

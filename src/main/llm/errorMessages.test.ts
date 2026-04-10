import { describe, it, expect } from 'vitest'
import { getErrorMessage } from './errorMessages'

describe('getErrorMessage', () => {
    it('returns generic message for non-Error values', () => {
        const generic = 'An unexpected error occurred. Please try again.'
        expect(getErrorMessage('string error')).toBe(generic)
        expect(getErrorMessage(null)).toBe(generic)
        expect(getErrorMessage(42)).toBe(generic)
    })

    it('returns auth message for 401 errors', () => {
        expect(getErrorMessage(new Error('Request failed with status 401'))).toContain('API key')
    })

    it('returns rate limit message for 429 / rate limit errors', () => {
        expect(getErrorMessage(new Error('429 Too Many Requests'))).toContain('Rate limit')
        expect(getErrorMessage(new Error('rate limit exceeded'))).toContain('Rate limit')
    })

    it('returns network message for fetch/econnrefused/network errors', () => {
        const networkMsg = 'Network error'
        expect(getErrorMessage(new Error('fetch failed'))).toContain(networkMsg)
        expect(getErrorMessage(new Error('ECONNREFUSED'))).toContain(networkMsg)
        expect(getErrorMessage(new Error('network error'))).toContain(networkMsg)
    })

    it('returns timeout message for timeout errors', () => {
        expect(getErrorMessage(new Error('Request timeout after 30s'))).toContain('timeout')
    })

    it('returns generic fallback for unknown Error messages', () => {
        expect(getErrorMessage(new Error('something weird happened'))).toContain('encountered an error')
    })
})

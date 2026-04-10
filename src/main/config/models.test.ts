import { describe, it, expect } from 'vitest'
import { isReasoningModelName, MODEL_CONTEXT_LIMITS } from './models'

describe('isReasoningModelName', () => {
    it('returns true for reasoning models', () => {
        expect(isReasoningModelName('o1')).toBe(true)
        expect(isReasoningModelName('o3')).toBe(true)
        expect(isReasoningModelName('gpt-5.4')).toBe(true)
        expect(isReasoningModelName('gpt-5.4-mini')).toBe(true)
        expect(isReasoningModelName('gpt-5.4-nano')).toBe(true)
    })

    it('returns false for non-reasoning models', () => {
        expect(isReasoningModelName('gpt-4o')).toBe(false)
        expect(isReasoningModelName('gpt-4.1-mini')).toBe(false)
        expect(isReasoningModelName('claude-haiku-4-5-20251001')).toBe(false)
    })

    it('is case insensitive', () => {
        expect(isReasoningModelName('O1')).toBe(true)
        expect(isReasoningModelName('O3-MINI')).toBe(true)
    })

    it('matches suffixed variants', () => {
        expect(isReasoningModelName('o1-preview')).toBe(true)
        expect(isReasoningModelName('o3-mini')).toBe(true)
    })
})

describe('MODEL_CONTEXT_LIMITS', () => {
    it('all values are positive numbers', () => {
        for (const [model, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
            expect(limit, `${model} should be positive`).toBeGreaterThan(0)
            expect(typeof limit).toBe('number')
        }
    })
})

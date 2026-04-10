import { describe, it, expect } from 'vitest'
import { tokenBudgetExceeded, costBudgetExceeded } from './stopConditions'

const makeStep = (input: number, output: number, total?: number) => ({
    usage: { inputTokens: input, outputTokens: output, totalTokens: total ?? input + output },
})

describe('tokenBudgetExceeded', () => {
    const stop = tokenBudgetExceeded(1000)

    it('returns false when under budget', () => {
        expect(stop({ steps: [makeStep(200, 100)] } as any)).toBe(false)
    })

    it('returns true when exactly at budget', () => {
        expect(stop({ steps: [makeStep(500, 500)] } as any)).toBe(true)
    })

    it('returns true when over budget', () => {
        expect(stop({ steps: [makeStep(300, 200), makeStep(300, 300)] } as any)).toBe(true)
    })

    it('accumulates across multiple steps', () => {
        const steps = [makeStep(100, 100), makeStep(100, 100), makeStep(100, 100)]
        expect(stop({ steps } as any)).toBe(false) // 600 < 1000
    })

    it('handles steps with no usage', () => {
        expect(stop({ steps: [{ usage: undefined }] } as any)).toBe(false)
    })

    it('falls back to inputTokens + outputTokens when totalTokens is 0', () => {
        const step = { usage: { inputTokens: 600, outputTokens: 500, totalTokens: 0 } }
        // totalTokens is 0 (falsy), so falls back to input + output = 1100
        expect(stop({ steps: [step] } as any)).toBe(true)
    })

    it('returns false for empty steps', () => {
        expect(stop({ steps: [] } as any)).toBe(false)
    })
})

describe('costBudgetExceeded', () => {
    it('returns false when under budget', () => {
        // 100K input at $3/1M = $0.30, 10K output at $15/1M = $0.15 → $0.45
        const stop = costBudgetExceeded(1.0)
        expect(stop({ steps: [makeStep(100_000, 10_000)] } as any)).toBe(false)
    })

    it('returns true when over budget', () => {
        // 1M input at $3/1M = $3, 1M output at $15/1M = $15 → $18
        const stop = costBudgetExceeded(1.0)
        expect(stop({ steps: [makeStep(1_000_000, 1_000_000)] } as any)).toBe(true)
    })

    it('uses custom pricing', () => {
        // 500K input at $1/1M = $0.50, 500K output at $2/1M = $1.00 → $1.50
        const stop = costBudgetExceeded(2.0, 1.0, 2.0)
        expect(stop({ steps: [makeStep(500_000, 500_000)] } as any)).toBe(false)
    })

    it('handles steps with no usage', () => {
        const stop = costBudgetExceeded(0.01)
        expect(stop({ steps: [{ usage: undefined }] } as any)).toBe(false)
    })

    it('accumulates cost across steps', () => {
        // 2 steps: total 1M input ($3) + 200K output ($3) = $6 total > $5
        const stop = costBudgetExceeded(5.0)
        const steps = [makeStep(500_000, 100_000), makeStep(500_000, 100_000)]
        expect(stop({ steps } as any)).toBe(true)
    })
})

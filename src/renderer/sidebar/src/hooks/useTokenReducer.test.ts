import { describe, it, expect } from 'vitest'
import { tokenReducer, tokenInitialState } from './useTokenReducer'
import type { TokenAction } from './useTokenReducer'

const makeUsage = (total: number, id = 'msg-1') => ({
    messageId: id,
    inputTokens: Math.floor(total * 0.6),
    outputTokens: Math.floor(total * 0.4),
    totalTokens: total,
})

describe('tokenReducer', () => {
    it('accumulates totalTokensUsed on usage action', () => {
        let state = tokenReducer(tokenInitialState, { type: 'usage', payload: makeUsage(100) })
        expect(state.totalTokensUsed).toBe(100)
        state = tokenReducer(state, { type: 'usage', payload: makeUsage(200, 'msg-2') })
        expect(state.totalTokensUsed).toBe(300)
    })

    it('sets tokenUsage on usage action', () => {
        const usage = makeUsage(100)
        const state = tokenReducer(tokenInitialState, { type: 'usage', payload: usage })
        expect(state.tokenUsage).toEqual({
            messageId: 'msg-1',
            inputTokens: 60,
            outputTokens: 40,
            totalTokens: 100,
        })
    })

    it('appends to recentUsage', () => {
        let state = tokenInitialState
        for (let i = 0; i < 3; i++) {
            state = tokenReducer(state, { type: 'usage', payload: makeUsage((i + 1) * 100, `msg-${i}`) })
        }
        expect(state.recentUsage).toEqual([100, 200, 300])
    })

    it('caps recentUsage at 5 entries', () => {
        let state = tokenInitialState
        for (let i = 0; i < 7; i++) {
            state = tokenReducer(state, { type: 'usage', payload: makeUsage((i + 1) * 10, `msg-${i}`) })
        }
        expect(state.recentUsage).toHaveLength(5)
        expect(state.recentUsage).toEqual([30, 40, 50, 60, 70])
    })

    it('resets totalTokensUsed and clears recentUsage on resetTotal', () => {
        let state = tokenReducer(tokenInitialState, { type: 'usage', payload: makeUsage(500) })
        state = tokenReducer(state, { type: 'usage', payload: { ...makeUsage(0), resetTotal: 0 } })
        expect(state.totalTokensUsed).toBe(0)
        expect(state.recentUsage).toEqual([])
    })

    it('preserves contextLimit/modelName when not in payload', () => {
        const state = tokenReducer(tokenInitialState, {
            type: 'usage',
            payload: { ...makeUsage(100), contextLimit: 200_000, modelName: 'gpt-4o' },
        })
        const next = tokenReducer(state, { type: 'usage', payload: makeUsage(50, 'msg-2') })
        expect(next.contextLimit).toBe(200_000)
        expect(next.modelName).toBe('gpt-4o')
    })

    it('updates contextLimit/modelName when provided', () => {
        const state = tokenReducer(tokenInitialState, {
            type: 'usage',
            payload: { ...makeUsage(100), contextLimit: 200_000, modelName: 'gpt-4o' },
        })
        const next = tokenReducer(state, {
            type: 'usage',
            payload: { ...makeUsage(50, 'msg-2'), contextLimit: 128_000, modelName: 'o1' },
        })
        expect(next.contextLimit).toBe(128_000)
        expect(next.modelName).toBe('o1')
    })

    it('returns initial state on reset action', () => {
        const state = tokenReducer(tokenInitialState, { type: 'usage', payload: makeUsage(100) })
        const reset = tokenReducer(state, { type: 'reset' })
        expect(reset).toEqual(tokenInitialState)
    })
})

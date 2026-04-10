import { useReducer } from 'react'

interface TokenUsage {
    messageId: string
    inputTokens: number
    outputTokens: number
    totalTokens: number
}

export interface TokenState {
    tokenUsage: TokenUsage | null
    totalTokensUsed: number
    contextLimit: number | null
    modelName: string | null
    recentUsage: number[]
}

export type TokenAction =
    | { type: 'usage'; payload: TokenUsage & { contextLimit?: number; modelName?: string; resetTotal?: number } }
    | { type: 'reset' }

const tokenInitialState: TokenState = {
    tokenUsage: null,
    totalTokensUsed: 0,
    contextLimit: null,
    modelName: null,
    recentUsage: [],
}

const tokenReducer = (state: TokenState, action: TokenAction): TokenState => {
    switch (action.type) {
        case 'usage': {
            const { contextLimit, modelName, resetTotal, ...usage } = action.payload
            if (resetTotal !== undefined) {
                return {
                    ...state,
                    totalTokensUsed: resetTotal,
                    contextLimit: contextLimit ?? state.contextLimit,
                    modelName: modelName ?? state.modelName,
                    recentUsage: [],
                }
            }
            return {
                tokenUsage: usage,
                totalTokensUsed: state.totalTokensUsed + usage.totalTokens,
                contextLimit: contextLimit ?? state.contextLimit,
                modelName: modelName ?? state.modelName,
                recentUsage: [...state.recentUsage.slice(-4), usage.totalTokens],
            }
        }
        case 'reset':
            return tokenInitialState
    }
}

export const useTokenReducer = () => useReducer(tokenReducer, tokenInitialState)

export interface Source {
    url: string
    title?: string
}

export interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: number
    isStreaming?: boolean
    sources?: Source[]
}

export type Verbosity = 'concise' | 'normal' | 'detailed'

export interface ConversationTurn {
    user?: Message
    assistant?: Message
}

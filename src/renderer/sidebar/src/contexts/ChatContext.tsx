import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo, type Dispatch, type SetStateAction } from 'react'
import type { AuditReport, HighlightRequest, ToolExecution } from '../types/audit'
import type { Message, Source, Verbosity } from '../types/chat'
import { useTokenReducer } from '../hooks/useTokenReducer'
import { useChatListeners } from '../hooks/useChatListeners'

interface TokenUsage {
    messageId: string
    inputTokens: number
    outputTokens: number
    totalTokens: number
}

export interface StepProgress {
    stepNumber: number
    toolCalls: string[]
    usage?: {
        inputTokens: number
        outputTokens: number
        totalTokens: number
    }
}

interface ChatContextType {
    messages: Message[]
    isLoading: boolean
    error: string | null
    setError: Dispatch<SetStateAction<string | null>>
    clearError: () => void
    auditReports: Map<string, AuditReport>
    toolExecutions: Map<string, ToolExecution[]>
    reasoningTexts: Map<string, string>
    sourceSets: Map<string, Source[]>
    sentMessageIds: string[]
    tokenUsage: TokenUsage | null
    totalTokensUsed: number
    contextLimit: number | null
    modelName: string | null
    recentUsage: number[]
    stepProgress: StepProgress | null
    verbosity: Verbosity
    setVerbosity: Dispatch<SetStateAction<Verbosity>>

    // Highlight interaction
    activeHighlightId: string | null

    // Chat actions
    sendMessage: (content: string) => Promise<void>
    cancelChat: () => void
    clearChat: () => void

    // Page content access
    getPageContent: () => Promise<string | null>
    getPageText: () => Promise<string | null>
    getCurrentUrl: () => Promise<string | null>

    // Audit actions
    highlightElements: (highlights: HighlightRequest[]) => Promise<void>
    clearHighlights: () => Promise<void>
}

const ChatContext = createContext<ChatContextType | null>(null)

export const useChat = () => {
    const context = useContext(ChatContext)
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider')
    }
    return context
}

const convertMessages = (rawMessages: any[]): Message[] =>
    rawMessages.map((msg: any, index: number) => ({
        id: msg.id || `msg-${index}`,
        role: msg.role,
        content: typeof msg.content === 'string'
            ? msg.content
            : msg.content
                .filter((p: any) => p.type === 'text')
                .map((p: any) => p.text)
                .join('\n') || '',
        timestamp: msg.timestamp || Date.now(),
        isStreaming: false,
    }))

// --- ChatProvider ---

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [messages, setMessages] = useState<Message[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [auditReports, setAuditReports] = useState<Map<string, AuditReport>>(new Map())
    const [toolExecutions, setToolExecutions] = useState<Map<string, ToolExecution[]>>(new Map())
    const [sourceSets, setSourceSets] = useState<Map<string, Source[]>>(new Map())
    const [sentMessageIds, setSentMessageIds] = useState<string[]>([])
    const [error, setError] = useState<string | null>(null)
    const [verbosity, setVerbosity] = useState<Verbosity>('normal')
    const [stepProgress, setStepProgress] = useState<StepProgress | null>(null)
    const [reasoningTexts, setReasoningTexts] = useState<Map<string, string>>(new Map())
    const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null)
    const activeHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [tokenState, dispatchToken] = useTokenReducer()
    const isLoadingRef = useRef(false)
    const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const clearError = useCallback(() => setError(null), [])

    // Auto-clear activeHighlightId after 3 seconds so glow fades
    useEffect(() => {
        if (activeHighlightId == null) return
        if (activeHighlightTimerRef.current) clearTimeout(activeHighlightTimerRef.current)
        activeHighlightTimerRef.current = setTimeout(() => {
            setActiveHighlightId(null)
            activeHighlightTimerRef.current = null
        }, 3000)
        return () => {
            if (activeHighlightTimerRef.current) clearTimeout(activeHighlightTimerRef.current)
        }
    }, [activeHighlightId])

    // Load initial messages from main process
    useEffect(() => {
        const loadMessages = async () => {
            try {
                const storedMessages = await window.sidebarAPI.getMessages()
                if (storedMessages && storedMessages.length > 0) {
                    setMessages(convertMessages(storedMessages))
                }
            } catch (error) {
                console.error('Failed to load messages:', error)
            }
        }
        loadMessages()
    }, [])

    const sendMessage = useCallback(async (content: string) => {
        if (isLoadingRef.current) return
        isLoadingRef.current = true
        setIsLoading(true)

        // Safety timeout: reset isLoading if no response in 60s
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = setTimeout(() => {
            if (isLoadingRef.current) {
                isLoadingRef.current = false
                setIsLoading(false)
                setError('Request timed out — no response received')
            }
        }, 60_000)

        try {
            const messageId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
            setSentMessageIds(prev => [...prev, messageId])

            await window.sidebarAPI.sendChatMessage({
                message: content,
                messageId: messageId,
                verbosity,
            })
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to send message'
            setError(message)
            console.error('Failed to send message:', err)
            isLoadingRef.current = false
            setIsLoading(false)
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
        }
    }, [verbosity])

    const cancelChat = useCallback(async () => {
        try {
            await window.sidebarAPI.cancelChat()
            isLoadingRef.current = false
            setIsLoading(false)
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
        } catch (error) {
            console.error('Failed to cancel chat:', error)
        }
    }, [])

    const clearChat = useCallback(async () => {
        try {
            await window.sidebarAPI.cancelChat()
            await window.sidebarAPI.clearChat()
            setMessages([])
            setAuditReports(new Map())
            setToolExecutions(new Map())
            setSourceSets(new Map())
            setReasoningTexts(new Map())
            setSentMessageIds([])
            dispatchToken({ type: 'reset' })
            setStepProgress(null)
            isLoadingRef.current = false
            setIsLoading(false)
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
        } catch (error) {
            console.error('Failed to clear chat:', error)
        }
    }, [])

    const getPageContent = useCallback(async () => {
        try {
            return await window.sidebarAPI.getPageContent()
        } catch (error) {
            console.error('Failed to get page content:', error)
            return null
        }
    }, [])

    const getPageText = useCallback(async () => {
        try {
            return await window.sidebarAPI.getPageText()
        } catch (error) {
            console.error('Failed to get page text:', error)
            return null
        }
    }, [])

    const getCurrentUrl = useCallback(async () => {
        try {
            return await window.sidebarAPI.getCurrentUrl()
        } catch (error) {
            console.error('Failed to get current URL:', error)
            return null
        }
    }, [])

    const highlightElements = useCallback(async (highlights: HighlightRequest[]) => {
        try {
            await window.sidebarAPI.highlightElements(highlights)
        } catch (error) {
            console.error('Failed to highlight elements:', error)
        }
    }, [])

    const clearHighlights = useCallback(async () => {
        try {
            await window.sidebarAPI.clearHighlights()
        } catch (error) {
            console.error('Failed to clear highlights:', error)
        }
    }, [])

    // Set up IPC listeners
    useChatListeners(
        setMessages,
        setAuditReports,
        setToolExecutions,
        setSourceSets,
        setStepProgress,
        setReasoningTexts,
        dispatchToken,
        isLoadingRef,
        setIsLoading,
        loadingTimeoutRef,
        setActiveHighlightId,
    )

    const value = useMemo<ChatContextType>(() => ({
        messages,
        isLoading,
        error,
        setError,
        clearError,
        auditReports,
        toolExecutions,
        reasoningTexts,
        sourceSets,
        sentMessageIds,
        tokenUsage: tokenState.tokenUsage,
        totalTokensUsed: tokenState.totalTokensUsed,
        contextLimit: tokenState.contextLimit,
        modelName: tokenState.modelName,
        recentUsage: tokenState.recentUsage,
        activeHighlightId,
        stepProgress,
        verbosity,
        setVerbosity,
        sendMessage,
        cancelChat,
        clearChat,
        getPageContent,
        getPageText,
        getCurrentUrl,
        highlightElements,
        clearHighlights,
    }), [messages, isLoading, error, auditReports, toolExecutions, reasoningTexts, sourceSets, sentMessageIds, tokenState, activeHighlightId, stepProgress, verbosity, sendMessage, cancelChat, clearChat, getPageContent, getPageText, getCurrentUrl, highlightElements, clearHighlights])

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    )
}

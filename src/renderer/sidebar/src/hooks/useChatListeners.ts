import { useEffect, type Dispatch, type SetStateAction } from 'react'
import type { AuditReport, ToolExecution, ToolCallEvent, ToolResultEvent } from '../types/audit'
import type { Message, Source } from '../types/chat'
import type { StepProgress } from '../contexts/ChatContext'
import type { TokenAction } from './useTokenReducer'

interface TokenUsage {
    messageId: string
    inputTokens: number
    outputTokens: number
    totalTokens: number
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

export const useChatListeners = (
    setMessages: Dispatch<SetStateAction<Message[]>>,
    setAuditReports: Dispatch<SetStateAction<Map<string, AuditReport>>>,
    setToolExecutions: Dispatch<SetStateAction<Map<string, ToolExecution[]>>>,
    setSourceSets: Dispatch<SetStateAction<Map<string, Source[]>>>,
    setStepProgress: Dispatch<SetStateAction<StepProgress | null>>,
    setReasoningTexts: Dispatch<SetStateAction<Map<string, string>>>,
    dispatchToken: Dispatch<TokenAction>,
    isLoadingRef: React.MutableRefObject<boolean>,
    setIsLoading: Dispatch<SetStateAction<boolean>>,
    loadingTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
    setActiveHighlightId: Dispatch<SetStateAction<string | null>>,
) => {
    useEffect(() => {
        const handleChatResponse = (data: { messageId: string; content: string; isComplete: boolean; cancelled?: boolean }) => {
            if (data.cancelled || data.isComplete) {
                isLoadingRef.current = false
                setIsLoading(false)
                setStepProgress(null)
                if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
            }

            if (data.cancelled) {
                setToolExecutions(prev => {
                    const next = new Map(prev)
                    const executions = next.get(data.messageId)
                    if (executions) {
                        next.set(data.messageId, executions.map(te =>
                            te.status === 'running'
                                ? { ...te, status: 'error' as const, output: 'Cancelled' }
                                : te
                        ))
                    }
                    return next
                })
                setMessages(prev => {
                    const updated = [...prev]
                    const lastIdx = updated.length - 1
                    if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                        updated[lastIdx] = { ...updated[lastIdx], isStreaming: false }
                    }
                    return updated
                })
                return
            }
            if (!data.isComplete) {
                setMessages(prev => {
                    const updated = [...prev]
                    const lastIdx = updated.length - 1
                    if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                        updated[lastIdx] = { ...updated[lastIdx], isStreaming: true }
                    }
                    return updated
                })
            } else {
                setMessages(prev => {
                    const updated = [...prev]
                    const lastIdx = updated.length - 1
                    if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                        updated[lastIdx] = { ...updated[lastIdx], isStreaming: false }
                    }
                    return updated
                })
            }
        }

        const handleMessagesUpdated = (updatedMessages: any[]) => {
            setMessages(prev => {
                const converted = convertMessages(updatedMessages)
                const lastPrev = prev[prev.length - 1]
                const lastConverted = converted[converted.length - 1]
                if (lastPrev?.role === 'assistant' && lastPrev.isStreaming &&
                    lastConverted?.role === 'assistant') {
                    converted[converted.length - 1] = { ...lastConverted, isStreaming: true }
                }
                return converted
            })
        }

        const handleAuditReport = (report: AuditReport) => {
            setAuditReports(prev => {
                const next = new Map(prev)
                next.set(report.messageId, report)
                return next
            })
        }

        const handleToolCallStarted = (event: ToolCallEvent) => {
            setToolExecutions(prev => {
                const next = new Map(prev)
                const existing = next.get(event.messageId) || []
                next.set(event.messageId, [...existing, {
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    args: event.args,
                    status: 'running',
                    startedAt: Date.now(),
                }])
                return next
            })
        }

        const handleToolCallCompleted = (event: ToolResultEvent & { isError?: boolean }) => {
            setToolExecutions(prev => {
                const next = new Map(prev)
                const existing = next.get(event.messageId) || []
                const updated = existing.map(te =>
                    te.toolCallId === event.toolCallId
                        ? { ...te, status: (event.isError ? 'error' : 'complete') as const, output: event.output, durationMs: event.durationMs }
                        : te
                )
                next.set(event.messageId, updated)
                return next
            })
        }

        const handleTokenUsage = (usage: TokenUsage & { contextLimit?: number; modelName?: string; resetTotal?: number }) => {
            dispatchToken({ type: 'usage', payload: usage })
        }

        const handleChatSource = (data: { messageId: string; source: { url: string; title?: string } }) => {
            setSourceSets(prev => {
                const next = new Map(prev)
                const existing = next.get(data.messageId) || []
                if (!existing.some(s => s.url === data.source.url)) {
                    next.set(data.messageId, [...existing, data.source])
                }
                return next
            })
        }

        const handleStepProgress = (data: { stepNumber: number; toolCalls: string[]; usage?: { inputTokens: number; outputTokens: number; totalTokens: number } }) => {
            setStepProgress({
                stepNumber: data.stepNumber,
                toolCalls: data.toolCalls,
                usage: data.usage,
            })
        }

        const handleChatReasoning = (data: { messageId: string; text: string }) => {
            setReasoningTexts(prev => {
                const next = new Map(prev)
                const existing = next.get(data.messageId) || ''
                next.set(data.messageId, existing + data.text)
                return next
            })
        }

        const handleHighlightClicked = (data: { id: string; category: string; severity: string }) => {
            setActiveHighlightId(data.id)
        }

        window.sidebarAPI.onChatResponse(handleChatResponse)
        window.sidebarAPI.onMessagesUpdated(handleMessagesUpdated)
        window.sidebarAPI.onAuditReportData(handleAuditReport)
        window.sidebarAPI.onToolCallStarted(handleToolCallStarted)
        window.sidebarAPI.onToolCallCompleted(handleToolCallCompleted)
        window.sidebarAPI.onTokenUsage(handleTokenUsage)
        window.sidebarAPI.onStepProgress(handleStepProgress)
        window.sidebarAPI.onChatSource(handleChatSource)
        window.sidebarAPI.onChatReasoning(handleChatReasoning)
        window.sidebarAPI.onHighlightClicked?.(handleHighlightClicked)

        return () => {
            window.sidebarAPI.removeChatResponseListener()
            window.sidebarAPI.removeMessagesUpdatedListener()
            window.sidebarAPI.removeAuditListeners()
            window.sidebarAPI.removeToolCallListeners()
            window.sidebarAPI.removeTokenUsageListener()
            window.sidebarAPI.removeStepProgressListener()
            window.sidebarAPI.removeChatSourceListener()
            window.sidebarAPI.removeChatReasoningListener()
            window.sidebarAPI.removeHighlightClickedListener?.()
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
        }
    }, [])
}

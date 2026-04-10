import React, { useMemo } from 'react'
import { Plus, AlertCircle } from 'lucide-react'
import { useChat } from '../contexts/ChatContext'
import { Button } from '@common/components/Button'
import { PageContextBar } from './PageContextBar'
import { ChatInput } from './ChatInput'
import { TokenUsageBar } from './TokenUsageBar'
import { AgentActivityPanel } from './AgentActivityPanel'
import { useAutoScroll } from '../lib/useAutoScroll'
import {
    SuggestedPrompts,
    ConversationTurnComponent,
} from './ChatMessages'
import type { ConversationTurn } from '../types/chat'

// Main Chat Component
export const Chat: React.FC = () => {
    const {
        messages,
        isLoading,
        sendMessage,
        cancelChat,
        clearChat,
        auditReports,
        toolExecutions,
        sentMessageIds,
        tokenUsage,
        totalTokensUsed,
        contextLimit,
        modelName,
        recentUsage,
        stepProgress,
        verbosity,
        setVerbosity,
        highlightElements,
        activeHighlightId,
        error,
        setError,
    } = useChat()
    const { scrollRef, containerRef } = useAutoScroll(messages, isLoading)

    const handleHighlight = async (highlights: { selector: string; color: string; label: string }[]) => {
        await highlightElements(highlights)
    }

    // Group messages into conversation turns and map each to its messageId
    const { conversationTurns, turnMessageIds } = useMemo(() => {
        const turns: ConversationTurn[] = []
        const msgIds: (string | undefined)[] = []
        let userTurnIndex = 0
        for (let i = 0; i < messages.length; i++) {
            if (messages[i].role === 'user') {
                const turn: ConversationTurn = { user: messages[i] }
                if (messages[i + 1]?.role === 'assistant') {
                    turn.assistant = messages[i + 1]
                    i++
                }
                turns.push(turn)
                msgIds.push(sentMessageIds[userTurnIndex])
                userTurnIndex++
            } else if (messages[i].role === 'assistant' &&
                (i === 0 || messages[i - 1]?.role !== 'user')) {
                turns.push({ assistant: messages[i] })
                msgIds.push(undefined) // orphan assistant turns have no messageId
            }
        }
        return { conversationTurns: turns, turnMessageIds: msgIds }
    }, [messages, sentMessageIds])

    // Show loading when: last message is user (waiting for assistant), OR
    // last message is assistant with empty content (tool calls happening, no text yet)
    const lastMsg = messages[messages.length - 1]
    const showLoadingAfterLastTurn = isLoading && (
        lastMsg?.role === 'user' ||
        (lastMsg?.role === 'assistant' && !lastMsg.content)
    )

    return (
        <div className="flex flex-col h-full bg-background">
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-3 mx-4 mt-2 rounded" role="alert">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="size-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        <div className="flex-1 text-sm text-red-800 dark:text-red-200">{error}</div>
                        <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800" aria-label="Dismiss error">×</button>
                    </div>
                </div>
            )}
            <PageContextBar />
            <AgentActivityPanel activity={stepProgress} totalTokens={totalTokensUsed} contextLimit={contextLimit} />

            <div className="flex-1 overflow-y-auto overflow-x-hidden" ref={containerRef}>
                <div className="h-8 max-w-3xl mx-auto px-4">
                    {messages.length > 0 && (
                        <Button
                            onClick={clearChat}
                            title="Start new chat"
                            variant="ghost"
                        >
                            <Plus className="size-4" />
                            New Chat
                        </Button>
                    )}
                </div>

                <div className="pb-4 relative max-w-3xl mx-auto px-4">
                    {messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full min-h-[60vh]">
                            <div className="text-center animate-fade-in max-w-md mx-auto gap-2 flex flex-col items-center">
                                <h3 className="text-3xl">🫐</h3>
                                <h4 className="text-lg font-semibold text-foreground">What can I help with?</h4>
                                <p className="text-muted-foreground text-xs">
                                    Analyze the current page, run audits, or ask anything
                                </p>
                                <SuggestedPrompts onSelect={sendMessage} />
                            </div>
                        </div>
                    ) : (
                        <>
                            {conversationTurns.map((turn, index) => {
                                const msgId = turnMessageIds[index]
                                const turnAuditReport = msgId ? auditReports.get(msgId) : undefined
                                const turnToolExecs = msgId ? toolExecutions.get(msgId) : undefined

                                return (
                                    <ConversationTurnComponent
                                        key={`turn-${index}`}
                                        turn={turn}
                                        isLoading={
                                            showLoadingAfterLastTurn &&
                                            index === conversationTurns.length - 1
                                        }
                                        auditReport={turnAuditReport}
                                        onHighlight={handleHighlight}
                                        toolExecs={turnToolExecs}
                                        allToolExecutions={toolExecutions}
                                        activeHighlightId={activeHighlightId}
                                    />
                                )
                            })}
                        </>
                    )}

                    <div ref={scrollRef} />
                </div>
            </div>

            <div>
                <TokenUsageBar tokenUsage={tokenUsage} totalTokensUsed={totalTokensUsed} contextLimit={contextLimit} modelName={modelName} recentUsage={recentUsage} />
                <div className="p-4 pt-0">
                    <ChatInput
                        onSend={sendMessage}
                        onCancel={cancelChat}
                        disabled={isLoading}
                        isLoading={isLoading}
                        verbosity={verbosity}
                        onVerbosityChange={setVerbosity}
                    />
                </div>
            </div>
        </div>
    )
}

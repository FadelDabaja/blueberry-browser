import React, { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { marked } from 'marked'
import { Copy, Check, Globe, FormInput, Accessibility, FileText } from 'lucide-react'
import { cn } from '@common/lib/utils'
import { AuditReportCard } from './AuditReport'
import { ToolCallStack } from './tool-calls'
import { highlightCode } from '../lib/highlighter'
import type { AuditReport, ToolExecution } from '../types/audit'
import type { ConversationTurn } from '../types/chat'

// Copy button for code blocks
const CopyButton: React.FC<{ text: string }> = ({ text }) => {
    const [copied, setCopied] = useState(false)
    const handleCopy = () => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <button
            onClick={handleCopy}
            className={cn(
                "p-1 rounded hover:bg-foreground/10 transition-colors",
                copied ? "text-success" : "text-foreground/60 hover:text-foreground/90"
            )}
            title="Copy code"
        >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
    )
}

// Shared dark mode detector — single MutationObserver, no IPC listeners
const darkModeListeners = new Set<(isDark: boolean) => void>()
let observerSetup = false
function setupDarkModeObserver() {
    if (observerSetup) return
    observerSetup = true
    const observer = new MutationObserver(() => {
        const isDark = document.documentElement.classList.contains('dark')
        darkModeListeners.forEach(fn => fn(isDark))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
}
function useIsDark(): boolean {
    const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
    useEffect(() => {
        setupDarkModeObserver()
        darkModeListeners.add(setIsDark)
        return () => { darkModeListeners.delete(setIsDark) }
    }, [])
    return isDark
}

// Syntax-highlighted code block
const HighlightedCodeBlock: React.FC<{ code: string; lang: string }> = ({ code, lang }) => {
    const [html, setHtml] = useState<string | null>(null)
    const isDark = useIsDark()

    useEffect(() => {
        let cancelled = false
        highlightCode(code, lang, isDark).then(h => { if (!cancelled) setHtml(h) })
        return () => { cancelled = true }
    }, [code, lang, isDark])

    return (
        <div className="rounded-xl border border-border overflow-hidden my-3">
            {/* Header bar */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 dark:bg-muted/40 border-b border-border/50">
                <span className="text-2xs text-muted-foreground font-mono">{lang || 'text'}</span>
                <CopyButton text={code} />
            </div>
            {/* Code body */}
            {html ? (
                <div
                    className="overflow-x-auto text-sm [&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:p-3 [&_code]:!bg-transparent"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            ) : (
                <pre className="p-3 text-sm overflow-x-auto bg-muted/20">
                    <code>{code}</code>
                </pre>
            )}
        </div>
    )
}

// Helper to extract text from pre > code children
function extractCodeText(children: React.ReactNode): string {
    if (!children) return ''
    if (typeof children === 'string') return children
    if (Array.isArray(children)) return children.map(extractCodeText).join('')
    if (typeof children === 'object' && 'props' in (children as any)) {
        const child = children as React.ReactElement<any>
        return extractCodeText(child.props.children)
    }
    return ''
}

// User Message Component
export const UserMessage: React.FC<{ content: string }> = ({ content }) => (
    <div className="relative max-w-[90%] ml-auto animate-fade-in overflow-hidden min-w-0">
        <div className="bg-muted dark:bg-muted/70 rounded-2xl px-4 py-3">
            <div className="text-foreground text-sm break-words" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {content}
            </div>
        </div>
    </div>
)

// Module-level markdown components (avoids re-creation on every render)
const markdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
    code: ({ className, children, ...props }) => {
        const match = /language-(\w+)/.exec(className || '')
        const codeString = extractCodeText(children).replace(/\n$/, '')

        if (match) {
            return <HighlightedCodeBlock code={codeString} lang={match[1]} />
        }

        return (
            <code className="bg-muted dark:bg-muted/50 px-1 py-0.5 rounded text-sm text-foreground" {...props}>
                {children}
            </code>
        )
    },
    pre: ({ children }) => {
        const child = React.Children.toArray(children)[0] as React.ReactElement<any>
        if (child?.type === HighlightedCodeBlock) {
            return <>{children}</>
        }
        const codeText = extractCodeText(children)
        return (
            <div className="relative group">
                <pre className="bg-muted dark:bg-muted/50 p-3 rounded-lg overflow-x-auto">{children}</pre>
                {codeText && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <CopyButton text={codeText} />
                    </div>
                )}
            </div>
        )
    },
    a: ({ children, href }) => {
        const isBlueberry = href?.startsWith('blueberry://')
        const handleClick = (e: React.MouseEvent) => {
            if (isBlueberry) {
                e.preventDefault()
                window.sidebarAPI?.openNewTab?.(href!)
            }
        }
        return (
            <a
                href={href}
                onClick={handleClick}
                className="text-blueberry hover:underline"
                target={isBlueberry ? undefined : '_blank'}
                rel={isBlueberry ? undefined : 'noopener noreferrer'}
            >
                {children}
            </a>
        )
    },
}

// Split markdown into blocks for independent memoization
function parseMarkdownIntoBlocks(markdown: string): string[] {
    const tokens = marked.lexer(markdown)
    return tokens.map(token => token.raw)
}

// Memoized single markdown block — only re-renders if content changes
const MemoizedMarkdownBlock = React.memo(
    ({ content }: { content: string }) => (
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>
            {content}
        </ReactMarkdown>
    ),
    (prev, next) => prev.content === next.content,
)

// Memoized Markdown — splits into blocks, each independently memoized
export const MemoizedMarkdown = React.memo(({ content, id }: { content: string; id: string }) => {
    const blocks = React.useMemo(() => parseMarkdownIntoBlocks(content), [content])
    return (
        <div className="prose prose-sm dark:prose-invert max-w-none
                        prose-headings:text-foreground prose-p:text-foreground
                        prose-strong:text-foreground prose-ul:text-foreground
                        prose-ol:text-foreground prose-li:text-foreground
                        prose-a:text-blueberry hover:prose-a:underline
                        prose-code:bg-muted prose-code:px-1 prose-code:py-0.5
                        prose-code:rounded prose-code:text-sm prose-code:text-foreground">
            {blocks.map((block, i) => (
                <MemoizedMarkdownBlock content={block} key={`${id}-block_${i}`} />
            ))}
        </div>
    )
})
export { MemoizedMarkdown as Markdown }

// Assistant Message Component - left border accent, no avatar
export const AssistantMessage: React.FC<{
    id: string
    content: string
    isStreaming?: boolean
    auditReport?: AuditReport
    toolExecs?: ToolExecution[]
    allToolExecutions?: Map<string, ToolExecution[]>
    onHighlight: (highlights: { selector: string; color: string; label: string }[]) => void
    activeHighlightId?: string | null
}> = ({ id, content, isStreaming, auditReport, toolExecs, allToolExecutions, onHighlight, activeHighlightId }) => (
    <div className="relative w-full animate-fade-in overflow-hidden">
        <div className="border-l-2 border-blueberry/30 pl-4 min-w-0 overflow-hidden">
            {toolExecs && toolExecs.length > 0 && (
                <ToolCallStack executions={toolExecs} allToolExecutions={allToolExecutions} />
            )}
            {content && (
                <div className="mt-1">
                    {isStreaming ? (
                        <div className="text-sm text-foreground break-words" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                            {content}
                            <span className="inline-block w-2 h-4 bg-blueberry ml-0.5 animate-pulse rounded-sm" />
                        </div>
                    ) : (
                        <MemoizedMarkdown content={content} id={id} />
                    )}
                </div>
            )}
            {auditReport && (
                <AuditReportCard report={auditReport} onHighlight={onHighlight} activeHighlightId={activeHighlightId} />
            )}
        </div>
    </div>
)

// Loading Indicator - subtle pulsing dots
export const LoadingIndicator: React.FC = () => (
    <div className="flex items-center gap-2 py-2 border-l-2 border-blueberry/30 pl-4">
        <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blueberry/60 animate-pulse" />
            <div className="w-1.5 h-1.5 rounded-full bg-blueberry/40 animate-pulse" style={{ animationDelay: '100ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-blueberry/20 animate-pulse" style={{ animationDelay: '200ms' }} />
        </div>
    </div>
)

// Suggested prompt chips for empty state - 2x2 grid
export const SuggestedPrompts: React.FC<{ onSelect: (text: string) => void }> = ({ onSelect }) => {
    const prompts = [
        { label: 'Audit this page', icon: Globe },
        { label: 'Test the forms', icon: FormInput },
        { label: 'Check accessibility', icon: Accessibility },
        { label: 'Summarize this page', icon: FileText },
    ]

    return (
        <div role="list" className="grid grid-cols-2 gap-2 mt-6 w-full max-w-sm mx-auto">
            {prompts.map(({ label, icon: Icon }) => (
                <button
                    key={label}
                    role="listitem"
                    onClick={() => onSelect(label)}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm",
                        "border border-border bg-background hover:bg-muted/50",
                        "text-muted-foreground hover:text-foreground",
                        "transition-colors duration-150"
                    )}
                >
                    <Icon className="size-4 shrink-0" />
                    <span className="text-left">{label}</span>
                </button>
            ))}
        </div>
    )
}

// Conversation Turn Component
export const ConversationTurnComponent: React.FC<{
    turn: ConversationTurn
    isLoading?: boolean
    auditReport?: AuditReport
    onHighlight: (highlights: { selector: string; color: string; label: string }[]) => void
    toolExecs?: ToolExecution[]
    allToolExecutions?: Map<string, ToolExecution[]>
    activeHighlightId?: string | null
}> = ({ turn, isLoading, auditReport, onHighlight, toolExecs, allToolExecutions, activeHighlightId }) => {
    const hasAssistant = !!turn.assistant
    const hasContent = hasAssistant && !!turn.assistant!.content
    const hasTools = toolExecs && toolExecs.length > 0

    return (
        <div className="pt-6 flex flex-col gap-4">
            {turn.user && <UserMessage content={turn.user.content} />}
            {hasAssistant && hasContent ? (
                // Normal assistant message with content (may also have tools/audit)
                <AssistantMessage
                    id={turn.assistant!.id}
                    content={turn.assistant!.content}
                    isStreaming={turn.assistant!.isStreaming}
                    auditReport={auditReport}
                    toolExecs={toolExecs}
                    allToolExecutions={allToolExecutions}
                    onHighlight={onHighlight}
                    activeHighlightId={activeHighlightId}
                />
            ) : hasTools ? (
                // No text yet but tools are running (e.g. navigate_to_url as first action)
                <div className="border-l-2 border-blueberry/30 pl-4">
                    <ToolCallStack executions={toolExecs} allToolExecutions={allToolExecutions} />
                </div>
            ) : isLoading && (
                // Pure loading state - no assistant, no tools yet
                <LoadingIndicator />
            )}
        </div>
    )
}

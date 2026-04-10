import React, { useState } from 'react'
import { AlertCircle, CheckCircle2, Send } from 'lucide-react'
import { cn } from '@common/lib/utils'
import type { ToolExecution } from '../../types/audit'

export const AskUserToolCard: React.FC<{ execution: ToolExecution }> = ({ execution }) => {
    const args = execution.args as {
        question?: string
        type?: 'select' | 'multiselect' | 'freeform'
        options?: { label: string; description?: string | null }[] | null
        placeholder?: string | null
    }
    const question = args.question || 'Question'
    const qType = args.type || 'freeform'
    const options = args.options || []
    const placeholder = args.placeholder || 'Type your response...'

    const [selected, setSelected] = useState<string[]>([])
    const [freeformText, setFreeformText] = useState('')
    const [answered, setAnswered] = useState(false)
    const [answerText, setAnswerText] = useState('')

    const isComplete = execution.status === 'complete'

    const submit = (response: string) => {
        if (answered || !response) return
        setAnswered(true)
        setAnswerText(response)
        window.sidebarAPI.respondToQuestion(execution.toolCallId, response)
    }

    const handleOptionClick = (label: string) => {
        if (answered) return
        if (qType === 'select') {
            submit(label)
        } else {
            setSelected(prev =>
                prev.includes(label) ? prev.filter(s => s !== label) : [...prev, label]
            )
        }
    }

    const handleSubmit = () => {
        if (qType === 'freeform') {
            submit(freeformText.trim())
        } else if (qType === 'multiselect') {
            submit(selected.join(', '))
        }
    }

    // Completed state: compact inline
    const isError = execution.status === 'error'
    if (isComplete || answered || isError) {
        if (isError) {
            return (
                <div className="flex items-start gap-2 my-1 text-xs px-2.5 py-1.5 text-red-600">
                    <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                    <span>Question failed: {typeof execution.output === 'string' ? execution.output : 'Error'}</span>
                </div>
            )
        }
        const displayAnswer = answerText || (typeof execution.output === 'string' ? execution.output : '')
        return (
            <div className="flex items-start gap-2 my-1 text-xs animate-fade-in px-2.5 py-1.5">
                <CheckCircle2 className="size-3.5 text-blueberry shrink-0 mt-0.5" />
                <div className="min-w-0">
                    <span className="text-muted-foreground">{question}</span>
                    <span className="mx-1.5 text-muted-foreground/50">&rarr;</span>
                    <span className="font-medium text-foreground">{displayAnswer}</span>
                </div>
            </div>
        )
    }

    // Running state: interactive question UI
    return (
        <div aria-live="polite" className="rounded-xl border border-blueberry/20 bg-blueberry/5 dark:bg-blueberry/10 p-3 my-1 animate-fade-in">
            <p className="text-sm font-medium text-foreground mb-2.5">{question}</p>

            {qType === 'freeform' ? (
                <div className="flex gap-2">
                    <textarea
                        value={freeformText}
                        onChange={e => setFreeformText(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey && freeformText.trim()) {
                                e.preventDefault()
                                handleSubmit()
                            }
                        }}
                        placeholder={placeholder}
                        className={cn(
                            "flex-1 px-3 py-2 rounded-lg text-sm resize-none",
                            "bg-background border border-border text-foreground",
                            "outline-none focus:border-blueberry/40",
                            "placeholder:text-muted-foreground",
                            "min-h-[40px] max-h-[120px]"
                        )}
                        rows={1}
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={!freeformText.trim()}
                        className={cn(
                            "self-end p-2 rounded-lg transition-colors shrink-0",
                            freeformText.trim()
                                ? "bg-blueberry text-white hover:opacity-90"
                                : "bg-muted text-muted-foreground cursor-not-allowed"
                        )}
                    >
                        <Send className="size-3.5" />
                    </button>
                </div>
            ) : (
                <div className="flex flex-wrap gap-1.5">
                    {options.map(opt => {
                        const isSelected = selected.includes(opt.label)
                        return (
                            <button
                                key={opt.label}
                                onClick={() => handleOptionClick(opt.label)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-sm transition-colors",
                                    "border",
                                    isSelected
                                        ? "border-blueberry/40 bg-blueberry/15 text-foreground"
                                        : "border-border bg-background text-foreground hover:bg-muted/50 hover:border-blueberry/20"
                                )}
                                title={opt.description || undefined}
                            >
                                {opt.label}
                            </button>
                        )
                    })}
                </div>
            )}

            {qType === 'multiselect' && selected.length > 0 && (
                <button
                    onClick={handleSubmit}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blueberry text-white hover:opacity-90 transition-opacity"
                >
                    <Send className="size-3" />
                    Submit ({selected.length})
                </button>
            )}
        </div>
    )
}

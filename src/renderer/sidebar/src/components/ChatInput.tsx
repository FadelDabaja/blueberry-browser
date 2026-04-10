import React, { useState, useRef, useEffect } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { cn } from '@common/lib/utils'
import type { Verbosity } from '../types/chat'

const VERBOSITY_LABELS: Record<Verbosity, string> = {
    concise: 'Concise',
    normal: 'Normal',
    detailed: 'Detailed',
}

export const ChatInput: React.FC<{
    onSend: (message: string) => void
    onCancel?: () => void
    disabled: boolean
    isLoading?: boolean
    verbosity: Verbosity
    onVerbosityChange: (v: Verbosity) => void
}> = ({ onSend, onCancel, disabled, isLoading, verbosity, onVerbosityChange }) => {
    const [value, setValue] = useState('')
    const [isFocused, setIsFocused] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const submittingRef = useRef(false)

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            const scrollHeight = textareaRef.current.scrollHeight
            const newHeight = Math.min(scrollHeight, 200)
            textareaRef.current.style.height = `${newHeight}px`
        }
    }, [value])

    const handleSubmit = () => {
        if (value.trim() && !disabled && !submittingRef.current) {
            submittingRef.current = true
            onSend(value.trim())
            setValue('')
            if (textareaRef.current) {
                textareaRef.current.style.height = '24px'
            }
            // Reset guard after microtask to allow next submit
            queueMicrotask(() => { submittingRef.current = false })
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        }
        if (e.key === 'Escape' && isLoading && onCancel) {
            e.preventDefault()
            onCancel()
        }
    }

    return (
        <div className={cn(
            "w-full border p-3 rounded-2xl bg-background dark:bg-secondary",
            "transition-all duration-200",
            isFocused ? "border-blueberry/20 dark:border-blueberry/30 shadow-sm" : "border-border"
        )}>
            <div className="w-full px-2 py-1">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={handleKeyDown}
                    placeholder="Send a message..."
                    aria-label="Type your message"
                    className={cn(
                        "w-full resize-none bg-transparent outline-none",
                        "text-foreground placeholder:text-muted-foreground",
                        "min-h-[24px] max-h-[200px] text-sm leading-6",
                        "focus:ring-0"
                    )}
                    rows={1}
                />
            </div>

            <div className="w-full flex items-center gap-1.5 px-1 mt-1">
                {/* Verbosity selector */}
                <div className="flex items-center bg-muted/50 rounded-full p-0.5" role="radiogroup" aria-label="Response verbosity">
                    {(['concise', 'normal', 'detailed'] as Verbosity[]).map((v) => (
                        <button
                            key={v}
                            onClick={() => onVerbosityChange(v)}
                            role="radio"
                            aria-checked={verbosity === v}
                            className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-150",
                                verbosity === v
                                    ? "bg-blueberry text-white"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {VERBOSITY_LABELS[v]}
                        </button>
                    ))}
                </div>
                <div className="flex-1" />
                {isLoading ? (
                    <button
                        onClick={onCancel}
                        aria-label="Stop generation"
                        title="Stop generation (Escape)"
                        className={cn(
                            "size-8 rounded-full flex items-center justify-center",
                            "transition-all duration-200",
                            "bg-red-500 text-white",
                            "hover:bg-red-600 active:scale-[0.96]"
                        )}
                    >
                        <Square className="size-3.5" />
                    </button>
                ) : (
                    <button
                        onClick={handleSubmit}
                        disabled={disabled || !value.trim()}
                        aria-label="Send message"
                        title="Send message (Enter)"
                        className={cn(
                            "size-8 rounded-full flex items-center justify-center",
                            "transition-all duration-200",
                            "bg-blueberry text-white",
                            "hover:opacity-80 active:scale-[0.96] disabled:opacity-50"
                        )}
                    >
                        <ArrowUp className="size-4" />
                    </button>
                )}
            </div>
        </div>
    )
}

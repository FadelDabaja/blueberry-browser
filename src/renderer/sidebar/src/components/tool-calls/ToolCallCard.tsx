import React, { useState } from 'react'
import { Check, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@common/lib/utils'
import type { ToolExecution } from '../../types/audit'
import { formatDuration } from '../../lib/formatters'
import { TOOL_LABELS } from './toolCallConstants'
import { truncateOutput, formatArgs } from './toolCallUtils'
import { AskUserToolCard } from './AskUserCard'
import { ReportToolCard } from './ReportCard'
import { TaskToolCard } from './TaskCard'

export const ToolCallCard: React.FC<{ execution: ToolExecution }> = ({ execution }) => {
    const [expanded, setExpanded] = useState(false)

    // ask_user gets its own interactive card
    if (execution.toolName === 'ask_user') {
        return <AskUserToolCard execution={execution} />
    }
    // generate_report gets its own card with View Report button
    if (execution.toolName === 'generate_report') {
        return <ReportToolCard execution={execution} />
    }
    // task creation tools get a grouped card
    if (execution.toolName === 'create_tasks_batch') {
        return <TaskToolCard execution={execution} />
    }
    const label = TOOL_LABELS[execution.toolName] || execution.toolName
    const isRunning = execution.status === 'running'
    const isError = execution.status === 'error'
    const isComplete = execution.status === 'complete'

    return (
        <div className={cn(
            'rounded-lg text-xs animate-tool-card-in overflow-hidden',
            'transition-colors duration-200',
            isRunning && 'bg-blueberry/5',
            isComplete && 'bg-muted/20',
            isError && 'bg-red-50 dark:bg-red-900/10'
        )}>
            <button
                onClick={() => !isRunning && setExpanded(!expanded)}
                aria-expanded={expanded}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left"
            >
                {isRunning && (
                    <span className="size-1.5 rounded-full bg-blueberry animate-pulse shrink-0" />
                )}
                {isComplete && (
                    <Check className="size-3 text-green-600 dark:text-green-400 shrink-0" />
                )}
                {isError && (
                    <AlertCircle className="size-3 text-red-500 shrink-0" />
                )}

                <span className="flex-1 text-muted-foreground truncate">
                    {label}
                </span>

                {isComplete && execution.durationMs != null && (
                    <span className="text-muted-foreground/60 tabular-nums shrink-0">
                        {formatDuration(execution.durationMs)}
                    </span>
                )}

                {!isRunning && (
                    expanded
                        ? <ChevronDown className="size-3 text-muted-foreground shrink-0" />
                        : <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                )}
            </button>

            {expanded && (
                <div className="px-2.5 pb-2 space-y-1 border-t border-border/30">
                    {Object.keys(execution.args).length > 0 && (
                        <pre className="text-2xs text-muted-foreground whitespace-pre-wrap mt-1.5 font-mono">
                            {formatArgs(execution.args)}
                        </pre>
                    )}
                    {execution.output != null && (
                        <div className={cn("text-2xs mt-1", isError ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                            <span className="text-foreground/60">&rarr; </span>
                            <span className="font-mono">{truncateOutput(execution.output)}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

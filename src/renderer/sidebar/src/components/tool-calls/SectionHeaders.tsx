import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Bot, Zap } from 'lucide-react'
import { cn } from '@common/lib/utils'
import type { ToolExecution } from '../../types/audit'
import { formatDuration } from '../../lib/formatters'

export const SubagentSectionHeader: React.FC<{
    execution: ToolExecution
    nestedTools: ToolExecution[]
    children: React.ReactNode
}> = ({ execution, nestedTools, children }) => {
    const [collapsed, setCollapsed] = useState(false)
    const agentType = (execution.args as { agentType?: string }).agentType || 'specialist'
    const taskDesc = (execution.args as { task?: string }).task || ''
    const isRunning = execution.status === 'running'
    const isComplete = execution.status === 'complete'
    const isError = execution.status === 'error'
    const nestedComplete = nestedTools.filter(t => t.status === 'complete').length
    const nestedTotal = nestedTools.length

    return (
        <div className={cn(
            'rounded-lg border overflow-hidden animate-tool-card-in',
            isRunning && 'border-blueberry/30 bg-blueberry/5',
            isComplete && 'border-green-200 dark:border-green-800/40 bg-green-50/30 dark:bg-green-950/10',
            isError && 'border-red-200 dark:border-red-800/40 bg-red-50/30 dark:bg-red-950/10',
        )}>
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
            >
                {collapsed
                    ? <ChevronRight className="size-3.5 text-blueberry shrink-0" />
                    : <ChevronDown className="size-3.5 text-blueberry shrink-0" />
                }
                <Bot className="size-3.5 text-blueberry shrink-0" />
                <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-foreground capitalize">{agentType}</span>
                    <span className="text-2xs text-muted-foreground ml-1.5">agent</span>
                    {taskDesc && (
                        <div className="text-2xs text-muted-foreground truncate mt-0.5">{taskDesc}</div>
                    )}
                </div>
                {isRunning && (
                    <span className="size-1.5 rounded-full bg-blueberry animate-pulse shrink-0" />
                )}
                {isComplete && execution.durationMs != null && (
                    <span className="text-2xs text-muted-foreground/60 tabular-nums shrink-0">
                        {formatDuration(execution.durationMs)}
                    </span>
                )}
                {nestedTotal > 0 && (
                    <span className="text-2xs text-muted-foreground tabular-nums shrink-0">
                        {nestedComplete}/{nestedTotal}
                    </span>
                )}
            </button>
            {!collapsed && (
                <div className="border-t border-border/30 pl-3">
                    {children}
                </div>
            )}
        </div>
    )
}

export const ParallelSectionHeader: React.FC<{
    execution: ToolExecution
    taskCount: number
    concurrency: number
    children: React.ReactNode
}> = ({ execution, taskCount, concurrency, children }) => {
    const [collapsed, setCollapsed] = useState(false)
    const isRunning = execution.status === 'running'
    const isComplete = execution.status === 'complete'
    const isError = execution.status === 'error'

    return (
        <div className={cn(
            'rounded-lg border overflow-hidden animate-tool-card-in',
            isRunning && 'border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-950/20',
            isComplete && 'border-green-200 dark:border-green-800/40 bg-green-50/30 dark:bg-green-950/10',
            isError && 'border-red-200 dark:border-red-800/40 bg-red-50/30 dark:bg-red-950/10',
        )}>
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
            >
                {collapsed
                    ? <ChevronRight className="size-3.5 text-violet-600 shrink-0" />
                    : <ChevronDown className="size-3.5 text-violet-600 shrink-0" />
                }
                <Zap className="size-3.5 text-violet-600 shrink-0" />
                <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-foreground">Parallel Tasks</span>
                    <span className="text-2xs text-muted-foreground ml-1.5">
                        ({taskCount} tasks, {concurrency} concurrent)
                    </span>
                </div>
                {isRunning && (
                    <span className="size-1.5 rounded-full bg-violet-500 animate-pulse shrink-0" />
                )}
                {isComplete && execution.durationMs != null && (
                    <span className="text-2xs text-muted-foreground/60 tabular-nums shrink-0">
                        {formatDuration(execution.durationMs)}
                    </span>
                )}
            </button>
            {!collapsed && (
                <div className="border-t border-border/30">
                    {children}
                </div>
            )}
        </div>
    )
}

import React, { useState } from 'react'
import { Check, AlertCircle, ChevronDown, ChevronRight, CheckSquare } from 'lucide-react'
import { cn } from '@common/lib/utils'
import type { ToolExecution } from '../../types/audit'
import { SEVERITY_CONFIG as SHARED_SEVERITY } from '../../lib/severity'

export const TaskToolCard: React.FC<{ execution: ToolExecution }> = ({ execution }) => {
    const [expanded, setExpanded] = useState(false)
    const isRunning = execution.status === 'running'
    const isError = execution.status === 'error'

    if (isRunning) {
        return (
            <div className="flex items-center gap-2 my-1 text-xs px-2.5 py-1.5">
                <span className="size-1.5 rounded-full bg-blueberry animate-pulse shrink-0" />
                <CheckSquare className="size-3.5 text-blueberry shrink-0" />
                <span className="text-muted-foreground">Creating tasks...</span>
            </div>
        )
    }

    if (isError) {
        return (
            <div className="flex items-start gap-2 my-1 text-xs px-2.5 py-1.5 text-red-600">
                <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                <span>Task creation failed</span>
            </div>
        )
    }

    // Parse created tasks from output (supports both old and new formats)
    const output = execution.output as
        | { tasks?: { id?: string; title?: string; severity?: string; source?: string }[]; count?: number; groupName?: string }
        | { task?: { id?: string; title?: string; severity?: string; source?: string }; message?: string }
        | null

    const tasks: { title: string; severity: string }[] = []
    let groupName = ''
    if (output && 'tasks' in output && Array.isArray(output.tasks)) {
        for (const t of output.tasks) {
            tasks.push({ title: t.title || 'Task', severity: t.severity || 'info' })
        }
        groupName = (output as any).groupName || ''
    } else if (output && 'task' in output && output.task) {
        tasks.push({ title: output.task.title || 'Task', severity: output.task.severity || 'info' })
        groupName = output.task.source || ''
    }

    const count = tasks.length

    return (
        <div className="rounded-xl border border-blueberry/20 bg-blueberry/5 dark:bg-blueberry/10 p-3 my-1 animate-fade-in">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-start gap-2.5 text-left"
            >
                <div className="size-8 rounded-lg bg-blueberry/15 flex items-center justify-center shrink-0">
                    <CheckSquare className="size-4 text-blueberry" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                        {count > 1 ? `${count} tasks created` : tasks[0]?.title || 'Task created'}
                    </p>
                    {groupName && (
                        <p className="text-2xs text-muted-foreground mt-0.5 truncate">{groupName}</p>
                    )}
                    {count > 1 && !expanded && !groupName && (
                        <p className="text-2xs text-muted-foreground mt-0.5 truncate">
                            {tasks.slice(0, 3).map(t => t.title).join(', ')}
                            {count > 3 && ` +${count - 3} more`}
                        </p>
                    )}
                </div>
                {count > 1 && (
                    expanded
                        ? <ChevronDown className="size-3.5 text-muted-foreground shrink-0 mt-1" />
                        : <ChevronRight className="size-3.5 text-muted-foreground shrink-0 mt-1" />
                )}
            </button>

            {expanded && count > 1 && (
                <div className="mt-2 space-y-1 border-t border-border/30 pt-2">
                    {tasks.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                            <Check className="size-3 text-green-500 shrink-0" />
                            <span className={cn('text-2xs font-medium uppercase', (SHARED_SEVERITY[t.severity] || SHARED_SEVERITY.info).color)}>
                                {t.severity}
                            </span>
                            <span className="text-foreground truncate">{t.title}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

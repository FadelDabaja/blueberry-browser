import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Globe, Check, X, Loader2 } from 'lucide-react'
import { cn } from '@common/lib/utils'
import type { ToolExecution } from '../types/audit'

interface ParallelTask {
  id: string
  task?: string
  url: string
  agentType: string
  status: 'running' | 'complete' | 'error'
  summary?: string
  error?: string
  nestedTools?: ToolExecution[]
}

interface ParallelTasksCardProps {
  tasks: ParallelTask[]
  concurrency: number
}

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function getDisplayPath(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname === '/' ? '/' : u.pathname.replace(/\/$/, '')
    return path
  } catch {
    return url
  }
}

const ParallelTaskRow: React.FC<{ task: ParallelTask }> = ({ task }) => {
  const [showNested, setShowNested] = useState(false)
  const hasNested = task.nestedTools && task.nestedTools.length > 0
  const nestedComplete = task.nestedTools?.filter(t => t.status === 'complete').length ?? 0

  const borderColor = task.status === 'running'
    ? 'border-l-violet-500'
    : task.status === 'complete'
      ? 'border-l-green-500'
      : 'border-l-red-500'

  return (
    <div className={cn('border-l-2 pl-2.5 py-1.5 mx-2', borderColor)}>
      <div className="flex items-center gap-1.5 min-w-0">
        {task.status === 'running' && <Loader2 className="size-3 text-violet-500 animate-spin shrink-0" />}
        {task.status === 'complete' && <Check className="size-3 text-green-500 shrink-0" />}
        {task.status === 'error' && <X className="size-3 text-red-500 shrink-0" />}
        <span className="text-xs text-foreground truncate" title={task.url}>
          {getDisplayPath(task.url)}
        </span>
        <span className="text-2xs text-muted-foreground/60 capitalize shrink-0 ml-auto">{task.agentType}</span>
      </div>

      {task.summary && (
        <div className="text-2xs text-foreground/70 mt-1 line-clamp-2">{task.summary}</div>
      )}
      {task.error && (
        <div className="text-2xs text-red-500 mt-0.5 truncate">{task.error}</div>
      )}

      {hasNested && (
        <button
          onClick={() => setShowNested(!showNested)}
          className="mt-1 text-2xs text-muted-foreground/60 hover:text-muted-foreground flex items-center gap-0.5 transition-colors"
        >
          {showNested ? <ChevronDown className="size-2.5" /> : <ChevronRight className="size-2.5" />}
          {nestedComplete}/{task.nestedTools!.length} tools
        </button>
      )}

      {showNested && hasNested && (
        <div className="mt-1 pl-2 border-l border-violet-200 dark:border-violet-800/50 space-y-0.5">
          {task.nestedTools!.map((tool, idx) => (
            <div
              key={tool.toolCallId || idx}
              className={cn(
                'flex items-center gap-1.5 text-2xs py-0.5',
                tool.status === 'error' && 'text-red-500',
              )}
            >
              {tool.status === 'running' && <span className="size-1 rounded-full bg-violet-500 animate-pulse shrink-0" />}
              {tool.status === 'complete' && <span className="size-1 rounded-full bg-green-500 shrink-0" />}
              {tool.status === 'error' && <span className="size-1 rounded-full bg-red-500 shrink-0" />}
              <span className="text-muted-foreground flex-1 truncate">{tool.toolName}</span>
              {tool.durationMs != null && (
                <span className="text-muted-foreground/60 tabular-nums shrink-0">
                  {formatDuration(tool.durationMs)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const ParallelTasksCard: React.FC<ParallelTasksCardProps> = ({ tasks }) => {
  return (
    <div className="bg-background/50 py-1 space-y-0.5">
      {tasks.map((task) => (
        <ParallelTaskRow key={task.id} task={task} />
      ))}
    </div>
  )
}

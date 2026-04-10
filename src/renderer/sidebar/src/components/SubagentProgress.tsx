import React, { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Globe, Check, X, Loader2 } from 'lucide-react'
import { cn } from '@common/lib/utils'
import type { ToolExecution } from '../types/audit'

interface SubagentProgressProps {
  toolExecution: ToolExecution
  nestedTools: ToolExecution[]
}

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

interface ParallelTaskDef {
  id: string
  url: string
  agentType: string
  task?: string
}

interface ParsedParallelInfo {
  execution: ToolExecution
  taskDefs: ParallelTaskDef[]
  concurrency: number
  nestedByTask: Map<string, ToolExecution[]>
  resultMap: Map<string, { status: string; summary?: string; error?: string }>
}

function parseParallelExecution(
  parallelExec: ToolExecution,
  allNested: ToolExecution[],
): ParsedParallelInfo {
  const args = parallelExec.args as { tasks?: ParallelTaskDef[]; concurrency?: number }
  const taskDefs = args.tasks || []
  const concurrency = args.concurrency || 3

  const resultMap = new Map<string, { status: string; summary?: string; error?: string }>()
  const output = parallelExec.output as { results?: Array<{ id: string; status: string; summary?: string; error?: string }> } | null
  if (output && typeof output === 'object' && Array.isArray(output.results)) {
    for (const r of output.results) resultMap.set(r.id, r)
  }

  const nestedByTask = new Map<string, ToolExecution[]>()
  for (const tool of allNested) {
    for (const td of taskDefs) {
      if (tool.toolCallId.includes(`parallel-${td.id}`)) {
        if (!nestedByTask.has(td.id)) nestedByTask.set(td.id, [])
        nestedByTask.get(td.id)!.push(tool)
        break
      }
    }
  }

  return { execution: parallelExec, taskDefs, concurrency, nestedByTask, resultMap }
}

/** Extract a readable path from a URL */
function getDisplayUrl(url: string): { host: string; path: string } {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    const path = u.pathname === '/' ? '/' : u.pathname.replace(/\/$/, '')
    return { host, path }
  } catch {
    return { host: url, path: '' }
  }
}

/** Compact row for a crawled page */
const CrawledPageRow: React.FC<{
  def: ParallelTaskDef
  result?: { status: string; summary?: string; error?: string }
  nestedTools: ToolExecution[]
  parentDone: boolean
}> = ({ def, result, nestedTools, parentDone }) => {
  const [expanded, setExpanded] = useState(false)
  const status = result
    ? (result.status === 'success' ? 'complete' : 'error')
    : (parentDone ? 'complete' : 'running')
  const nestedComplete = nestedTools.filter(t => t.status === 'complete').length
  const { host, path } = getDisplayUrl(def.url)

  const borderColor = status === 'running'
    ? 'border-l-violet-500'
    : status === 'complete'
      ? 'border-l-green-500'
      : 'border-l-red-500'

  return (
    <div className={cn('border-l-2 pl-2.5 py-1.5', borderColor)}>
      <div className="flex items-center gap-1.5 min-w-0">
        {status === 'running' && <Loader2 className="size-3 text-violet-500 animate-spin shrink-0" />}
        {status === 'complete' && <Check className="size-3 text-green-500 shrink-0" />}
        {status === 'error' && <X className="size-3 text-red-500 shrink-0" />}
        <span className="text-xs text-foreground truncate" title={def.url}>
          {path || '/'}
        </span>
        {nestedTools.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-2xs text-muted-foreground/60 hover:text-muted-foreground shrink-0 ml-auto flex items-center gap-0.5"
          >
            {expanded ? <ChevronDown className="size-2.5" /> : <ChevronRight className="size-2.5" />}
            {nestedComplete}/{nestedTools.length}
          </button>
        )}
      </div>
      {result?.error && (
        <div className="text-2xs text-red-500 mt-0.5 truncate">{result.error}</div>
      )}
      {expanded && nestedTools.length > 0 && (
        <div className="mt-1 pl-2 border-l border-violet-200 dark:border-violet-800/40 space-y-0.5">
          {nestedTools.map((tool, idx) => (
            <div key={tool.toolCallId || idx} className="flex items-center gap-1.5 text-2xs py-0.5">
              {tool.status === 'running' && <span className="size-1 rounded-full bg-violet-500 animate-pulse shrink-0" />}
              {tool.status === 'complete' && <span className="size-1 rounded-full bg-green-500 shrink-0" />}
              {tool.status === 'error' && <span className="size-1 rounded-full bg-red-500 shrink-0" />}
              <span className="text-muted-foreground truncate flex-1">{tool.toolName}</span>
              {tool.durationMs != null && (
                <span className="text-muted-foreground/60 tabular-nums shrink-0">{formatDuration(tool.durationMs)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Crawled pages section with progress */
const NestedParallelSection: React.FC<{ info: ParsedParallelInfo }> = ({ info }) => {
  const { execution, taskDefs, nestedByTask, resultMap } = info
  const isRunning = execution.status === 'running'
  const completedCount = taskDefs.filter(td => resultMap.has(td.id)).length
  const errorCount = taskDefs.filter(td => resultMap.get(td.id)?.status === 'error').length

  // Extract common host from tasks
  const hosts = new Set(taskDefs.map(td => getDisplayUrl(td.url).host))
  const siteLabel = hosts.size === 1 ? hosts.values().next().value : `${hosts.size} sites`

  return (
    <div className={cn(
      'rounded-lg border overflow-hidden my-1.5',
      isRunning
        ? 'border-violet-300/60 dark:border-violet-700/40 bg-violet-50/40 dark:bg-violet-950/15'
        : 'border-border/50 bg-muted/5',
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Globe className={cn('size-3.5 shrink-0', isRunning ? 'text-violet-500' : 'text-muted-foreground')} />
        <span className="text-xs font-medium text-foreground">Pages</span>
        <span className="text-2xs text-muted-foreground">{siteLabel}</span>
        <span className="ml-auto text-xs font-semibold tabular-nums text-foreground">
          {completedCount}<span className="text-muted-foreground font-normal">/{taskDefs.length}</span>
        </span>
        {isRunning && <Loader2 className="size-3 text-violet-500 animate-spin shrink-0" />}
        {!isRunning && errorCount === 0 && <Check className="size-3 text-green-500 shrink-0" />}
        {!isRunning && errorCount > 0 && (
          <span className="text-2xs text-red-500 font-medium">{errorCount} failed</span>
        )}
        {execution.durationMs != null && (
          <span className="text-2xs text-muted-foreground/60 tabular-nums shrink-0">
            {formatDuration(execution.durationMs)}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {taskDefs.length > 0 && (
        <div className="mx-3 h-1.5 bg-muted/30 rounded-full overflow-hidden mb-2">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isRunning
                ? 'bg-gradient-to-r from-violet-400 to-violet-500'
                : errorCount > 0
                  ? 'bg-gradient-to-r from-green-400 to-amber-400'
                  : 'bg-gradient-to-r from-green-400 to-green-500',
            )}
            style={{ width: `${Math.max((completedCount / taskDefs.length) * 100, 2)}%` }}
          />
        </div>
      )}

      {/* Page list */}
      <div className="px-2 pb-2 space-y-0.5">
        {taskDefs.map(td => (
          <CrawledPageRow
            key={td.id}
            def={td}
            result={resultMap.get(td.id)}
            nestedTools={nestedByTask.get(td.id) || []}
            parentDone={execution.status === 'complete'}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Renders the nested tool list inside a subagent section.
 * Detects run_parallel_tasks calls and renders them as crawled page sections
 * with per-URL progress tracking.
 */
export const SubagentProgress: React.FC<SubagentProgressProps> = ({ nestedTools }) => {
  if (nestedTools.length === 0) {
    return (
      <div className="px-3 py-2 text-2xs text-muted-foreground">
        No tool calls recorded yet...
      </div>
    )
  }

  const { regularTools, parallelSections } = useMemo(() => {
    const regular: ToolExecution[] = []
    const parallel: ParsedParallelInfo[] = []
    const consumedIds = new Set<string>()

    for (let i = 0; i < nestedTools.length; i++) {
      const tool = nestedTools[i]
      if (consumedIds.has(tool.toolCallId)) continue

      if (tool.toolName === 'run_parallel_tasks') {
        const parallelNested: ToolExecution[] = []
        for (let j = i + 1; j < nestedTools.length; j++) {
          const candidate = nestedTools[j]
          if (candidate.toolName === 'run_parallel_tasks') break
          if (tool.status === 'running' ||
            (tool.durationMs != null && candidate.startedAt <= tool.startedAt + tool.durationMs)) {
            parallelNested.push(candidate)
            consumedIds.add(candidate.toolCallId)
          }
        }
        parallel.push(parseParallelExecution(tool, parallelNested))
        consumedIds.add(tool.toolCallId)
      } else {
        regular.push(tool)
      }
    }

    return { regularTools: regular, parallelSections: parallel }
  }, [nestedTools])

  const renderItems = useMemo(() => {
    const items: Array<{ type: 'tool'; tool: ToolExecution } | { type: 'parallel'; info: ParsedParallelInfo }> = []
    const parallelByTime = [...parallelSections].sort((a, b) => a.execution.startedAt - b.execution.startedAt)
    let pIdx = 0

    for (const tool of regularTools) {
      while (pIdx < parallelByTime.length && parallelByTime[pIdx].execution.startedAt <= tool.startedAt) {
        items.push({ type: 'parallel', info: parallelByTime[pIdx] })
        pIdx++
      }
      items.push({ type: 'tool', tool })
    }
    while (pIdx < parallelByTime.length) {
      items.push({ type: 'parallel', info: parallelByTime[pIdx] })
      pIdx++
    }

    return items
  }, [regularTools, parallelSections])

  return (
    <div className="bg-background/50 px-3 py-2 space-y-0.5">
      {renderItems.map((item, idx) => {
        if (item.type === 'parallel') {
          return <NestedParallelSection key={`p-${item.info.execution.toolCallId}`} info={item.info} />
        }
        const tool = item.tool
        return (
          <div key={tool.toolCallId || idx} className="flex items-center gap-2 text-xs py-1">
            {tool.status === 'running' && (
              <span className="size-1.5 rounded-full bg-blueberry animate-pulse shrink-0" />
            )}
            {tool.status === 'complete' && (
              <span className="size-1.5 rounded-full bg-green-500 shrink-0" />
            )}
            {tool.status === 'error' && (
              <span className="size-1.5 rounded-full bg-red-500 shrink-0" />
            )}
            <span className="text-muted-foreground flex-1 truncate">{tool.toolName}</span>
            {tool.durationMs != null && (
              <span className="text-muted-foreground/60 tabular-nums shrink-0">
                {formatDuration(tool.durationMs)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

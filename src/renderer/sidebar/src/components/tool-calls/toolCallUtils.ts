import type { ToolExecution } from '../../types/audit'
import { SUBAGENT_TOOLS } from './toolCallConstants'
import type { GroupedExecution, ParallelTaskArg, ParallelResultEntry } from './toolCallTypes'

export const truncateOutput = (output: unknown): string => {
    if (!output) return ''
    if (typeof output === 'string') return output.slice(0, 200)
    try {
        const str = JSON.stringify(output, null, 2)
        return str.length > 200 ? str.slice(0, 200) + '...' : str
    } catch {
        return String(output).slice(0, 200)
    }
}

export const formatArgs = (args: Record<string, unknown>): string => {
    const entries = Object.entries(args)
    if (entries.length === 0) return ''
    return entries
        .map(([key, val]) => {
            const v = typeof val === 'string' ? val : JSON.stringify(val)
            const display = v && v.length > 60 ? v.slice(0, 60) + '...' : v
            return `${key}: ${display}`
        })
        .join('\n')
}

export const buildParallelTasks = (
    execution: ToolExecution,
    nestedByTask?: Map<string, ToolExecution[]>,
) => {
    const args = execution.args as { tasks?: ParallelTaskArg[]; concurrency?: number }
    const taskDefs = args.tasks || []
    const concurrency = args.concurrency || 3

    // Parse output results if available
    const output = execution.output as { results?: ParallelResultEntry[] } | string | null | undefined
    const resultMap = new Map<string, ParallelResultEntry>()

    if (output && typeof output === 'object' && 'results' in output && Array.isArray(output.results)) {
        for (const r of output.results) {
            resultMap.set(r.id, r)
        }
    } else if (typeof output === 'string') {
        try {
            const parsed = JSON.parse(output) as { results?: ParallelResultEntry[] }
            if (parsed.results) {
                for (const r of parsed.results) {
                    resultMap.set(r.id, r)
                }
            }
        } catch {
            // not parseable, ignore
        }
    }

    const tasks = taskDefs.map(td => {
        const result = resultMap.get(td.id)
        const taskNestedTools = nestedByTask?.get(td.id) || []
        let status: 'running' | 'complete' | 'error' = 'running'
        if (result) {
            status = result.status === 'success' ? 'complete' : 'error'
        } else if (execution.status === 'complete' || execution.status === 'error') {
            status = execution.status === 'complete' ? 'complete' : 'error'
        }
        return {
            id: td.id,
            task: td.task,
            url: td.url,
            agentType: td.agentType,
            status,
            summary: result?.summary,
            error: result?.error,
            nestedTools: taskNestedTools,
        }
    })

    return { tasks, concurrency }
}

/**
 * Groups flat executions into hierarchical structures:
 * - Subagent tools (run_specialized_task) absorb subsequent sub-* prefixed tool calls
 * - Parallel tools (run_parallel_tasks) resolve nested tools from allToolExecutions map
 * - Regular tools remain ungrouped
 */
export const groupExecutions = (
    executions: ToolExecution[],
    allToolExecutions?: Map<string, ToolExecution[]>,
): GroupedExecution[] => {
    const groups: GroupedExecution[] = []
    // Collect toolCallIds that belong to subagent nested tools so we skip them at top level
    const consumedIds = new Set<string>()
    let i = 0

    while (i < executions.length) {
        const exec = executions[i]

        if (consumedIds.has(exec.toolCallId)) {
            i++
            continue
        }

        if (exec.toolName === 'run_specialized_task') {
            // Collect nested tools: those with sub- prefixed toolCallId that appear after this subagent
            const nested: ToolExecution[] = []
            const subagentStart = exec.startedAt
            let j = i + 1
            while (j < executions.length) {
                const candidate = executions[j]
                if (SUBAGENT_TOOLS.has(candidate.toolName)) break
                // Heuristic: sub-prefixed IDs belong to subagent, or tools started during subagent window
                const isSubPrefixed = candidate.toolCallId.startsWith('sub-')
                const withinTimeWindow = exec.status === 'running' ||
                    (exec.durationMs != null && candidate.startedAt <= subagentStart + exec.durationMs)
                if (isSubPrefixed || withinTimeWindow) {
                    nested.push(candidate)
                    consumedIds.add(candidate.toolCallId)
                    j++
                } else {
                    break
                }
            }
            groups.push({ type: 'subagent', execution: exec, nestedTools: nested })
            i = j
        } else if (exec.toolName === 'run_parallel_tasks') {
            // Collect time-window nested tools from the same execution list
            const nested: ToolExecution[] = []
            const subagentStart = exec.startedAt
            let j = i + 1
            while (j < executions.length) {
                const candidate = executions[j]
                if (SUBAGENT_TOOLS.has(candidate.toolName)) break
                if (exec.status === 'complete' && exec.durationMs != null) {
                    if (candidate.startedAt > subagentStart + exec.durationMs) break
                }
                nested.push(candidate)
                consumedIds.add(candidate.toolCallId)
                j++
            }

            // Resolve per-task nested tools from allToolExecutions map
            // Parallel subtasks broadcast with messageId "parallel-{taskId}"
            const parallelNestedByTask = new Map<string, ToolExecution[]>()
            if (allToolExecutions) {
                const taskArgs = (exec.args as { tasks?: ParallelTaskArg[] }).tasks || []
                for (const taskDef of taskArgs) {
                    const taskExecs = allToolExecutions.get(`parallel-${taskDef.id}`) || []
                    if (taskExecs.length > 0) {
                        parallelNestedByTask.set(taskDef.id, taskExecs)
                    }
                }
            }

            groups.push({
                type: 'parallel',
                execution: exec,
                nestedTools: nested,
                parallelNestedByTask,
            })
            i = j
        } else {
            groups.push({ type: 'tool', execution: exec, nestedTools: [] })
            i++
        }
    }

    return groups
}

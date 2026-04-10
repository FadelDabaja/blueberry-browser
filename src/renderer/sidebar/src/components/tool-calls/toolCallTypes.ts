import type { ToolExecution } from '../../types/audit'

export interface GroupedExecution {
    type: 'tool' | 'subagent' | 'parallel'
    execution: ToolExecution
    nestedTools: ToolExecution[]
    /** For parallel groups: per-task nested tools keyed by task id */
    parallelNestedByTask?: Map<string, ToolExecution[]>
}

export interface ParallelTaskArg {
    id: string
    task: string
    agentType: string
    url: string
}

export interface ParallelResultEntry {
    id: string
    status: 'success' | 'error'
    summary?: string
    error?: string
}

export interface ToolCallStackProps {
    executions: ToolExecution[]
    /** Full tool executions map for resolving parallel subtask nested tools */
    allToolExecutions?: Map<string, ToolExecution[]>
}

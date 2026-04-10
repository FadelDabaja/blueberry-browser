import React, { useMemo } from 'react'
import { SubagentProgress } from '../SubagentProgress'
import { ParallelTasksCard } from '../ParallelTasksCard'
import type { ToolCallStackProps } from './toolCallTypes'
import { groupExecutions, buildParallelTasks } from './toolCallUtils'
import { ToolCallCard } from './ToolCallCard'
import { SubagentSectionHeader, ParallelSectionHeader } from './SectionHeaders'

export const ToolCallStack: React.FC<ToolCallStackProps> = ({ executions, allToolExecutions }) => {
    if (executions.length === 0) return null

    const runningCount = executions.filter(e => e.status === 'running').length

    const grouped = useMemo(
        () => groupExecutions(executions, allToolExecutions),
        [executions, allToolExecutions],
    )

    return (
        <div className="flex flex-col gap-0.5 my-2">
            {grouped.map(group => {
                if (group.type === 'parallel') {
                    const { tasks, concurrency } = buildParallelTasks(
                        group.execution,
                        group.parallelNestedByTask,
                    )
                    return (
                        <ParallelSectionHeader
                            key={group.execution.toolCallId}
                            execution={group.execution}
                            taskCount={tasks.length}
                            concurrency={concurrency}
                        >
                            <ParallelTasksCard
                                tasks={tasks}
                                concurrency={concurrency}
                            />
                        </ParallelSectionHeader>
                    )
                }
                if (group.type === 'subagent') {
                    return (
                        <SubagentSectionHeader
                            key={group.execution.toolCallId}
                            execution={group.execution}
                            nestedTools={group.nestedTools}
                        >
                            <SubagentProgress
                                toolExecution={group.execution}
                                nestedTools={group.nestedTools}
                            />
                        </SubagentSectionHeader>
                    )
                }
                return (
                    <ToolCallCard key={group.execution.toolCallId} execution={group.execution} />
                )
            })}
            {runningCount > 1 && (
                <div className="text-2xs text-blueberry/70 px-2.5 py-0.5">
                    Running {runningCount} tools...
                </div>
            )}
        </div>
    )
}

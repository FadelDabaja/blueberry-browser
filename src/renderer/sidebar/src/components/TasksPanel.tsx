import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { CheckSquare, Search, ExternalLink, Trash2, Check, RotateCcw, CircleDot, ChevronDown, ChevronRight, ChevronsUpDown, Eye, CheckCircle2 } from 'lucide-react'
import { cn } from '@common/lib/utils'
import { getRelativeTime } from '../lib/formatters'
import { SEVERITY_ORDER, getSeverityConfig } from '../lib/severity'

interface TaskGroup {
    id: string
    name: string
    createdAt: string
}

interface Task {
    id: string
    groupId: string
    title: string
    description: string
    severity: 'critical' | 'serious' | 'moderate' | 'minor' | 'info'
    source: string
    status: 'open' | 'closed'
    createdAt: string
    url?: string
    category?: string
    selector?: string
    fix?: string
    codeSnippet?: string
}

type FilterStatus = 'open' | 'closed' | 'all'

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
    const config = getSeverityConfig(severity)
    return (
        <span className={cn('px-1.5 py-0.5 rounded text-2xs font-medium', config.bg, config.color)}>
            {config.label}
        </span>
    )
}

const TaskCard: React.FC<{
    task: Task
    onToggleStatus: (id: string, status: 'open' | 'closed') => void
    onDelete: (id: string) => void
    onOpenUrl: (url: string) => void
}> = ({ task, onToggleStatus, onDelete, onOpenUrl }) => {
    const [expanded, setExpanded] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const isClosed = task.status === 'closed'

    const handleDelete = () => {
        if (confirmDelete) {
            onDelete(task.id)
        } else {
            setConfirmDelete(true)
            setTimeout(() => setConfirmDelete(false), 3000)
        }
    }

    return (
        <div className={cn(
            'rounded-lg border transition-colors',
            isClosed
                ? 'border-border/50 bg-muted/20 opacity-70'
                : 'border-border bg-card hover:border-blueberry/20'
        )}>
            <div className="flex items-start gap-2 p-3">
                <button
                    onClick={() => onToggleStatus(task.id, isClosed ? 'open' : 'closed')}
                    className={cn(
                        'size-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                        isClosed
                            ? 'border-green-500 bg-green-500/10 text-green-500'
                            : 'border-border hover:border-blueberry/40'
                    )}
                    aria-label={isClosed ? 'Reopen task' : 'Close task'}
                >
                    {isClosed && <Check className="size-3" />}
                </button>

                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn(
                            'text-sm font-medium',
                            isClosed ? 'line-through text-muted-foreground' : 'text-foreground'
                        )}>
                            {task.title}
                        </span>
                        <SeverityBadge severity={task.severity} />
                        {task.category && (
                            <span className="text-2xs text-muted-foreground bg-muted/30 px-1 py-0.5 rounded">{task.category}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-2xs text-muted-foreground">{getRelativeTime(task.createdAt)}</span>
                    </div>
                </div>
            </div>

            {expanded && (
                <div className="px-3 pb-3 pt-0 border-t border-border/30 mt-0">
                    <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{task.description}</p>
                    {task.fix && (
                        <div className="mt-2 flex items-start gap-1.5 text-xs text-green-700 dark:text-green-400 bg-green-500/10 rounded-md px-2.5 py-1.5">
                            <CheckCircle2 className="size-3 mt-0.5 shrink-0" />
                            <span>{task.fix}</span>
                        </div>
                    )}
                    {task.codeSnippet && (
                        <pre className="mt-2 text-2xs bg-muted/40 rounded px-2 py-1.5 overflow-x-auto text-foreground/80 font-mono whitespace-pre-wrap">
                            {task.codeSnippet}
                        </pre>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                        {task.url && (
                            <button
                                onClick={() => onOpenUrl(task.url!)}
                                className="inline-flex items-center gap-1 text-2xs text-blueberry hover:underline"
                            >
                                <ExternalLink className="size-3" />
                                Open URL
                            </button>
                        )}
                        {task.selector && (
                            <button
                                onClick={() => window.sidebarAPI.highlightElements([{ selector: task.selector!, color: '#6366f1', label: task.title.slice(0, 30) }])}
                                className="inline-flex items-center gap-1 text-2xs text-blueberry hover:underline"
                            >
                                <Eye className="size-3" />
                                Highlight
                            </button>
                        )}
                        <button
                            onClick={handleDelete}
                            className={cn(
                                "inline-flex items-center gap-1 text-2xs ml-auto",
                                confirmDelete
                                    ? "text-red-600 dark:text-red-400 font-medium"
                                    : "text-destructive hover:underline"
                            )}
                        >
                            <Trash2 className="size-3" />
                            {confirmDelete ? 'Confirm delete?' : 'Delete'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

const GroupSection: React.FC<{
    groupId: string
    groupName: string
    tasks: Task[]
    isRecent: boolean
    forceCollapsed?: boolean
    onToggleStatus: (id: string, status: 'open' | 'closed') => void
    onDelete: (id: string) => void
    onDeleteGroup: (id: string) => void
    onOpenUrl: (url: string) => void
}> = ({ groupId, groupName, tasks, isRecent, forceCollapsed, onToggleStatus, onDelete, onDeleteGroup, onOpenUrl }) => {
    const [collapsed, setCollapsed] = useState(!isRecent)
    const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false)
    const openCount = tasks.filter(t => t.status === 'open').length

    useEffect(() => {
        if (forceCollapsed !== undefined) setCollapsed(forceCollapsed)
    }, [forceCollapsed])

    const handleDeleteGroup = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (confirmDeleteGroup) {
            onDeleteGroup(groupId)
        } else {
            setConfirmDeleteGroup(true)
            setTimeout(() => setConfirmDeleteGroup(false), 3000)
        }
    }

    return (
        <div className="border-b border-border/40 last:border-b-0">
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted/30 transition-colors"
                aria-expanded={!collapsed}
            >
                {collapsed
                    ? <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                    : <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                }
                <span className="text-xs font-semibold text-foreground truncate">{groupName}</span>
                <span className="text-2xs text-muted-foreground ml-auto shrink-0 flex items-center gap-2">
                    <span>
                        {openCount > 0 && <span className="text-blueberry font-medium">{openCount}</span>}
                        {openCount > 0 && <span className="text-muted-foreground/50"> / </span>}
                        <span>{tasks.length}</span>
                    </span>
                    {groupId !== 'ungrouped' && (
                        <span
                            role="button"
                            onClick={handleDeleteGroup}
                            className={cn(
                                "inline-flex items-center",
                                confirmDeleteGroup
                                    ? "text-red-600 dark:text-red-400 font-medium"
                                    : "text-muted-foreground/50 hover:text-destructive"
                            )}
                        >
                            <Trash2 className="size-3" />
                        </span>
                    )}
                </span>
            </button>
            {!collapsed && (
                <div className="px-3 pb-2 space-y-2">
                    {tasks.map(task => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            onToggleStatus={onToggleStatus}
                            onDelete={onDelete}
                            onOpenUrl={onOpenUrl}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export const TasksPanel: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>([])
    const [groups, setGroups] = useState<TaskGroup[]>([])
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<FilterStatus>('open')
    const [loading, setLoading] = useState(true)
    const [allCollapsed, setAllCollapsed] = useState<boolean | undefined>(undefined)

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const [taskData, groupData] = await Promise.all([
                window.sidebarAPI.listTasks(),
                window.sidebarAPI.listGroups(),
            ])
            setTasks(taskData)
            setGroups(groupData)
        } catch (error) {
            console.error('Failed to load tasks:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleToggleStatus = async (id: string, newStatus: 'open' | 'closed') => {
        try {
            await window.sidebarAPI.updateTask(id, { status: newStatus })
            setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
        } catch (error) {
            console.error('Failed to update task:', error)
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await window.sidebarAPI.deleteTask(id)
            setTasks(prev => prev.filter(t => t.id !== id))
        } catch (error) {
            console.error('Failed to delete task:', error)
        }
    }

    const handleDeleteGroup = async (groupId: string) => {
        try {
            await window.sidebarAPI.deleteGroup(groupId)
            setGroups(prev => prev.filter(g => g.id !== groupId))
            setTasks(prev => prev.filter(t => t.groupId !== groupId))
        } catch (error) {
            console.error('Failed to delete group:', error)
        }
    }

    const handleOpenUrl = (url: string) => {
        window.sidebarAPI.navigateToUrl(url)
    }

    // Build group name lookup map
    const groupNameMap = useMemo(() => {
        const map = new Map<string, string>()
        for (const g of groups) {
            map.set(g.id, g.name)
        }
        map.set('ungrouped', 'Ungrouped')
        return map
    }, [groups])

    const filtered = useMemo(() => {
        let result = tasks
        if (filter !== 'all') {
            result = result.filter(t => t.status === filter)
        }
        if (search) {
            const lower = search.toLowerCase()
            result = result.filter(t =>
                t.title.toLowerCase().includes(lower) ||
                t.description.toLowerCase().includes(lower) ||
                t.source.toLowerCase().includes(lower) ||
                (groupNameMap.get(t.groupId) || '').toLowerCase().includes(lower)
            )
        }
        return result
    }, [tasks, filter, search, groupNameMap])

    // Group by groupId, then sort within each group by severity
    const grouped = useMemo(() => {
        const groupMap = new Map<string, Task[]>()
        for (const task of filtered) {
            const key = task.groupId || 'ungrouped'
            if (!groupMap.has(key)) groupMap.set(key, [])
            groupMap.get(key)!.push(task)
        }
        for (const [, taskList] of groupMap) {
            taskList.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 5) - (SEVERITY_ORDER[b.severity] ?? 5))
        }
        // Sort groups: put groups with more critical tasks first
        return [...groupMap.entries()].sort((a, b) => {
            const aMin = Math.min(...a[1].map(t => SEVERITY_ORDER[t.severity] ?? 5))
            const bMin = Math.min(...b[1].map(t => SEVERITY_ORDER[t.severity] ?? 5))
            return aMin - bMin
        })
    }, [filtered])

    const openCount = tasks.filter(t => t.status === 'open').length
    const closedCount = tasks.filter(t => t.status === 'closed').length

    const isRecentGroup = (tasks: Task[]): boolean => {
        const fiveMinAgo = Date.now() - 5 * 60 * 1000
        return tasks.some(t => new Date(t.createdAt).getTime() > fiveMinAgo)
    }

    const toggleAllCollapsed = () => {
        setAllCollapsed(prev => prev === undefined ? true : !prev)
    }

    return (
        <div className="flex flex-col h-full animate-panel-slide">
            {/* Header with search and filter */}
            <div className="p-3 border-b border-border space-y-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
                    <Search className="size-3.5 text-muted-foreground shrink-0" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search tasks..."
                        aria-label="Search tasks"
                        className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                    />
                </div>

                <div className="flex rounded-lg border border-border overflow-hidden">
                    {([
                        { id: 'open' as const, label: 'Open', count: openCount, icon: CircleDot },
                        { id: 'closed' as const, label: 'Closed', count: closedCount, icon: Check },
                        { id: 'all' as const, label: 'All', count: tasks.length, icon: null },
                    ]).map(({ id, label, count, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setFilter(id)}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1 py-1.5 text-xs transition-colors",
                                filter === id
                                    ? "bg-blueberry/10 text-blueberry font-medium"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                            )}
                        >
                            {Icon && <Icon className="size-3" />}
                            {label}
                            <span className="text-2xs opacity-60">({count})</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Task list */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="p-4 space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="rounded-lg border border-border p-3 animate-pulse">
                                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                                <div className="h-3 bg-muted rounded w-1/2" />
                            </div>
                        ))}
                    </div>
                ) : grouped.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                        <CheckSquare className="size-8 opacity-30" />
                        <p className="text-sm">
                            {tasks.length === 0
                                ? 'No tasks yet'
                                : `No ${filter === 'all' ? '' : filter} tasks found`}
                        </p>
                        <p className="text-2xs text-muted-foreground/60">
                            Ask the agent to create tasks from audit findings
                        </p>
                    </div>
                ) : (
                    <div>
                        {grouped.map(([gId, groupTasks]) => (
                            <GroupSection
                                key={gId}
                                groupId={gId}
                                groupName={groupNameMap.get(gId) || gId}
                                tasks={groupTasks}
                                isRecent={isRecentGroup(groupTasks)}
                                forceCollapsed={allCollapsed}
                                onToggleStatus={handleToggleStatus}
                                onDelete={handleDelete}
                                onDeleteGroup={handleDeleteGroup}
                                onOpenUrl={handleOpenUrl}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer with refresh + collapse all */}
            <div className="p-3 border-t border-border flex items-center justify-between">
                <span className="text-2xs text-muted-foreground">
                    {openCount} open, {closedCount} closed
                </span>
                <div className="flex items-center gap-2">
                    {grouped.length > 1 && (
                        <button
                            onClick={toggleAllCollapsed}
                            aria-label="Collapse/expand all groups"
                            className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ChevronsUpDown className="size-3" />
                        </button>
                    )}
                    <button
                        onClick={loadData}
                        aria-label="Refresh tasks"
                        className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <RotateCcw className="size-3" />
                        Refresh
                    </button>
                </div>
            </div>
        </div>
    )
}

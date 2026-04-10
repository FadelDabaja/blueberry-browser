import React, { useState, useEffect } from 'react'
import { Clock, Trash2, Globe, ChevronDown, ChevronRight, Search, RotateCcw } from 'lucide-react'
import { cn } from '@common/lib/utils'
import { getRelativeTime } from '../lib/formatters'

export interface HistoryEntry {
    id: string
    url: string
    title: string
    favicon: string
    timestamp: number
}

const getDomain = (url: string): string => {
    try { return new URL(url).hostname } catch { return url }
}

const getDateGroup = (ts: number): string => {
    const now = new Date()
    const date = new Date(ts)
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)
    if (diffDays === 0 && now.getDate() === date.getDate()) return 'Today'
    if (diffDays <= 1 || (diffDays === 0 && now.getDate() !== date.getDate())) return 'Yesterday'
    if (diffDays < 7) return 'This Week'
    return 'Earlier'
}

export const HistorySection: React.FC = () => {
    const [expanded, setExpanded] = useState(false)
    const [entries, setEntries] = useState<HistoryEntry[]>([])
    const [search, setSearch] = useState('')
    const [confirmClear, setConfirmClear] = useState(false)

    const loadHistory = async () => {
        try {
            const data = await window.sidebarAPI.getHistory(undefined, 200)
            setEntries(data)
        } catch (error) {
            console.error('Failed to load history:', error)
        }
    }

    useEffect(() => {
        if (expanded && entries.length === 0) loadHistory()
    }, [expanded])

    const handleClear = async () => {
        if (!confirmClear) {
            setConfirmClear(true)
            setTimeout(() => setConfirmClear(false), 3000)
            return
        }
        try {
            await window.sidebarAPI.clearHistory()
            setEntries([])
            setConfirmClear(false)
        } catch (error) {
            console.error('Failed to clear history:', error)
        }
    }

    const handleNavigate = async (url: string) => {
        try {
            await window.sidebarAPI.navigateToUrl(url)
        } catch (error) {
            console.error('Failed to navigate:', error)
        }
    }

    const filtered = search
        ? entries.filter(e =>
            e.title.toLowerCase().includes(search.toLowerCase()) ||
            e.url.toLowerCase().includes(search.toLowerCase())
        )
        : entries

    // Group by date
    const grouped = (() => {
        const groups: { label: string; items: HistoryEntry[] }[] = []
        let currentGroup = ''
        for (const entry of filtered) {
            const group = getDateGroup(entry.timestamp)
            if (group !== currentGroup) {
                currentGroup = group
                groups.push({ label: group, items: [] })
            }
            groups[groups.length - 1].items.push(entry)
        }
        return groups
    })()

    return (
        <div className="rounded-xl border border-border bg-card">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-2 p-4"
            >
                {expanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                <Clock className="size-4 text-blueberry" />
                <h3 className="text-sm font-semibold text-foreground">Browsing History</h3>
                <span className="text-2xs text-muted-foreground ml-auto">{entries.length} entries</span>
            </button>
            {expanded && (
                <div className="border-t border-border">
                    <div className="p-3 space-y-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
                            <Search className="size-3.5 text-muted-foreground shrink-0" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search history..."
                                aria-label="Search history"
                                className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-1">
                                <Clock className="size-6 opacity-30" />
                                <p className="text-xs">No history</p>
                            </div>
                        ) : (
                            <div className="py-1">
                                {grouped.map(group => (
                                    <div key={group.label}>
                                        <div className="px-4 py-1 text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            {group.label}
                                        </div>
                                        {group.items.map(entry => (
                                            <button
                                                key={entry.id}
                                                onClick={() => handleNavigate(entry.url)}
                                                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted/50 transition-colors text-left"
                                            >
                                                {entry.favicon ? (
                                                    <img
                                                        src={`https://www.google.com/s2/favicons?domain=${getDomain(entry.url)}&sz=16`}
                                                        className="size-4 shrink-0 rounded-sm"
                                                        alt=""
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                                    />
                                                ) : (
                                                    <Globe className="size-4 text-muted-foreground shrink-0" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-foreground truncate">{entry.title}</p>
                                                    <p className="text-2xs text-muted-foreground truncate">{getDomain(entry.url)}</p>
                                                </div>
                                                <span className="text-2xs text-muted-foreground shrink-0">
                                                    {getRelativeTime(entry.timestamp)}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="p-3 border-t border-border flex items-center justify-between">
                        <button
                            onClick={loadHistory}
                            className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <RotateCcw className="size-3" />
                            Refresh
                        </button>
                        {entries.length > 0 && (
                            <button
                                onClick={handleClear}
                                className={cn(
                                    "flex items-center gap-1 text-2xs transition-colors",
                                    confirmClear
                                        ? "text-red-600 dark:text-red-400 font-medium"
                                        : "text-destructive hover:text-destructive/80"
                                )}
                            >
                                <Trash2 className="size-3" />
                                {confirmClear ? 'Confirm clear?' : 'Clear history'}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

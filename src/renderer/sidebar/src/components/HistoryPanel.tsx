import React, { useState, useEffect, useMemo } from 'react'
import { Clock, Search, Trash2, Globe } from 'lucide-react'
import { cn } from '@common/lib/utils'

interface HistoryEntry {
    id: string
    url: string
    title: string
    favicon: string
    timestamp: number
}

const getDomain = (url: string): string => {
    try {
        return new URL(url).hostname
    } catch {
        return url
    }
}

const getRelativeTime = (ts: number): string => {
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`
    return new Date(ts).toLocaleDateString()
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

export const HistoryPanel: React.FC = () => {
    const [entries, setEntries] = useState<HistoryEntry[]>([])
    const [search, setSearch] = useState('')

    useEffect(() => {
        loadHistory()
    }, [])

    const loadHistory = async () => {
        try {
            const data = await window.sidebarAPI.getHistory(undefined, 200)
            setEntries(data)
        } catch (error) {
            console.error('Failed to load history:', error)
        }
    }

    const handleClear = async () => {
        try {
            await window.sidebarAPI.clearHistory()
            setEntries([])
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

    const filtered = useMemo(() => {
        if (!search) return entries
        const lower = search.toLowerCase()
        return entries.filter(
            e => e.title.toLowerCase().includes(lower) || e.url.toLowerCase().includes(lower)
        )
    }, [entries, search])

    // Group by date
    const grouped = useMemo(() => {
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
    }, [filtered])

    return (
        <div className="flex flex-col h-full animate-panel-slide">
            {/* Search bar */}
            <div className="p-3 border-b border-border">
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

            {/* History list */}
            <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                        <Clock className="size-8 opacity-30" />
                        <p className="text-sm">No history yet</p>
                    </div>
                ) : (
                    <div className="py-2">
                        {grouped.map(group => (
                            <div key={group.label}>
                                <div className="px-4 py-1.5 text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    {group.label}
                                </div>
                                {group.items.map(entry => (
                                    <button
                                        key={entry.id}
                                        onClick={() => handleNavigate(entry.url)}
                                        aria-label={`${entry.title} - ${getDomain(entry.url)} - ${getRelativeTime(entry.timestamp)}`}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-4 py-2.5",
                                            "hover:bg-muted/50 transition-colors text-left"
                                        )}
                                    >
                                        <Globe className="size-4 text-muted-foreground shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-foreground truncate">
                                                {entry.title}
                                            </p>
                                            <p className="text-2xs text-muted-foreground truncate">
                                                {getDomain(entry.url)}
                                            </p>
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

            {/* Clear button */}
            {entries.length > 0 && (
                <div className="p-3 border-t border-border">
                    <button
                        onClick={handleClear}
                        className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors"
                    >
                        <Trash2 className="size-3.5" />
                        Clear history
                    </button>
                </div>
            )}
        </div>
    )
}

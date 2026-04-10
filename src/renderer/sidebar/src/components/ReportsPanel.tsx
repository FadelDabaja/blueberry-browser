import React, { useState, useEffect, useRef } from 'react'
import { FileText, Trash2, ExternalLink, RotateCcw } from 'lucide-react'
import { cn } from '@common/lib/utils'
import { getRelativeTime } from '../lib/formatters'

interface ReportMeta {
    id: string
    title: string
    createdAt: string
}

const ReportCard: React.FC<{
    report: ReportMeta
    onOpen: (id: string) => void
    onDelete: (id: string) => void
}> = ({ report, onOpen, onDelete }) => {
    const [confirmDelete, setConfirmDelete] = useState(false)
    const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

    useEffect(() => () => { clearTimeout(confirmTimeoutRef.current) }, [])

    const handleDelete = () => {
        if (confirmDelete) {
            clearTimeout(confirmTimeoutRef.current)
            onDelete(report.id)
        } else {
            setConfirmDelete(true)
            confirmTimeoutRef.current = setTimeout(() => setConfirmDelete(false), 3000)
        }
    }

    return (
        <div className="rounded-lg border border-border bg-card hover:border-blueberry/20 transition-colors">
            <div className="flex items-start gap-3 p-3">
                <div className="size-9 rounded-lg bg-blueberry/10 flex items-center justify-center shrink-0">
                    <FileText className="size-4 text-blueberry" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{report.title}</p>
                    <p className="text-2xs text-muted-foreground mt-0.5">{getRelativeTime(report.createdAt)}</p>
                </div>
            </div>
            <div className="flex items-center gap-1 px-3 pb-3">
                <button
                    onClick={() => onOpen(report.id)}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-1.5",
                        "py-1.5 rounded-lg text-xs font-medium transition-colors",
                        "bg-blueberry/10 text-blueberry hover:bg-blueberry/20"
                    )}
                >
                    <ExternalLink className="size-3" />
                    Open
                </button>
                <button
                    onClick={handleDelete}
                    className={cn(
                        "flex items-center justify-center gap-1.5",
                        "py-1.5 px-3 rounded-lg text-xs font-medium transition-colors",
                        confirmDelete
                            ? "bg-red-500/10 text-red-600 dark:text-red-400"
                            : "bg-muted/50 text-muted-foreground hover:text-destructive hover:bg-red-500/10"
                    )}
                >
                    <Trash2 className="size-3" />
                    {confirmDelete ? 'Confirm' : 'Delete'}
                </button>
            </div>
        </div>
    )
}

export const ReportsPanel: React.FC = () => {
    const [reports, setReports] = useState<ReportMeta[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const loadReports = async () => {
        setIsLoading(true)
        try {
            const data = await window.sidebarAPI.listReports()
            setReports(data)
        } catch (error) {
            console.error('Failed to load reports:', error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadReports()
    }, [])

    const handleOpen = (id: string) => {
        window.sidebarAPI.openNewTab(`blueberry://report/${id}`)
    }

    const handleDelete = async (id: string) => {
        try {
            await window.sidebarAPI.deleteReport(id)
            setReports(prev => prev.filter(r => r.id !== id))
        } catch (error) {
            console.error('Failed to delete report:', error)
        }
    }

    return (
        <div className="flex flex-col h-full animate-panel-slide">
            {/* Header */}
            <div className="p-3 border-b border-border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileText className="size-4 text-blueberry" />
                        <h2 className="text-sm font-semibold text-foreground">Reports</h2>
                        <span className="text-2xs text-muted-foreground">({reports.length})</span>
                    </div>
                    <button
                        onClick={loadReports}
                        className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <RotateCcw className="size-3" />
                    </button>
                </div>
            </div>

            {/* Report list */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="p-3 space-y-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="rounded-lg border border-border bg-card p-3 animate-pulse">
                                <div className="flex items-start gap-3">
                                    <div className="size-9 rounded-lg bg-muted" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3.5 bg-muted rounded w-3/4" />
                                        <div className="h-2.5 bg-muted rounded w-1/3" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : reports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                        <FileText className="size-8 opacity-30" />
                        <p className="text-sm">No reports yet</p>
                        <p className="text-2xs text-muted-foreground/60 text-center px-4">
                            Ask the agent to generate a report after an audit or analysis
                        </p>
                    </div>
                ) : (
                    <div className="p-3 space-y-2">
                        {reports.map(report => (
                            <ReportCard
                                key={report.id}
                                report={report}
                                onOpen={handleOpen}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

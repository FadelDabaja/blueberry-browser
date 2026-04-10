import React from 'react'
import { AlertCircle, FileText, ExternalLink } from 'lucide-react'
import { cn } from '@common/lib/utils'
import type { ToolExecution } from '../../types/audit'

export const ReportToolCard: React.FC<{ execution: ToolExecution }> = ({ execution }) => {
    const isRunning = execution.status === 'running'
    const isError = execution.status === 'error'

    if (isRunning) {
        return (
            <div className="flex items-center gap-2 my-1 text-xs px-2.5 py-1.5">
                <span className="size-1.5 rounded-full bg-blueberry animate-pulse shrink-0" />
                <FileText className="size-3.5 text-blueberry shrink-0" />
                <span className="text-muted-foreground">Generating report...</span>
            </div>
        )
    }

    if (isError) {
        return (
            <div className="flex items-start gap-2 my-1 text-xs px-2.5 py-1.5 text-red-600">
                <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                <span>Report generation failed</span>
            </div>
        )
    }

    // Parse output
    const output = execution.output as { url?: string; title?: string; id?: string } | null
    const reportUrl = output?.url || ''
    const reportTitle = output?.title || 'Report'

    const handleOpen = () => {
        if (reportUrl && window.sidebarAPI?.openNewTab) {
            window.sidebarAPI.openNewTab(reportUrl)
        }
    }

    return (
        <div className="rounded-xl border border-blueberry/20 bg-blueberry/5 dark:bg-blueberry/10 p-3 my-1 animate-fade-in">
            <div className="flex items-start gap-2.5">
                <div className="size-8 rounded-lg bg-blueberry/15 flex items-center justify-center shrink-0">
                    <FileText className="size-4 text-blueberry" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{reportTitle}</p>
                    <p className="text-2xs text-muted-foreground mt-0.5">Report generated successfully</p>
                </div>
            </div>
            {reportUrl && (
                <button
                    onClick={handleOpen}
                    className={cn(
                        "mt-2.5 w-full flex items-center justify-center gap-1.5",
                        "py-1.5 rounded-lg text-xs font-medium transition-colors",
                        "bg-blueberry text-white hover:opacity-90"
                    )}
                >
                    <ExternalLink className="size-3" />
                    View Report
                </button>
            )}
        </div>
    )
}

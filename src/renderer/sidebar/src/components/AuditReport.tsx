import React, { useState, useEffect } from 'react'
import { ChevronRight, ExternalLink, Eye, CheckCircle2, Filter } from 'lucide-react'
import { cn } from '@common/lib/utils'
import type { AuditReport as AuditReportType, AuditCategory, AuditIssue, HighlightRequest } from '../types/audit'
import { getSeverityConfig } from '../lib/severity'

// Score Ring SVG — gradient stroke
const ScoreRing: React.FC<{ score: number; size?: number }> = ({ score, size = 72 }) => {
    const strokeWidth = 6
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (score / 100) * circumference

    const gradientId = `score-gradient-${score}`
    // Using Tailwind green/amber/red palette values
    const startColor = score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444'
    const endColor = score >= 80 ? '#16a34a' : score >= 50 ? '#ca8a04' : '#dc2626'

    return (
        <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90" aria-label={`Score: ${score}/100`}>
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={startColor} />
                        <stop offset="100%" stopColor={endColor} />
                    </linearGradient>
                </defs>
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" strokeWidth={strokeWidth}
                    className="stroke-muted/20"
                />
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke={`url(#${gradientId})`}
                    strokeWidth={strokeWidth} strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className="text-lg font-bold text-foreground leading-none">{score}</span>
                <span className="text-2xs text-muted-foreground leading-none mt-0.5">/100</span>
            </div>
        </div>
    )
}

// Severity Badge — pill with icon
const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
    const config = getSeverityConfig(severity)
    const Icon = config.icon
    return (
        <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-semibold uppercase tracking-wide',
            config.bg, config.color
        )}>
            <Icon className="size-2.5" />
            {config.label}
        </span>
    )
}

// Issue Card — clean card with left accent
const IssueCard: React.FC<{
    issue: AuditIssue
    index: number
    categoryIndex: number
    onHighlight: (highlights: HighlightRequest[]) => void
    activeHighlightId?: string | null
}> = ({ issue, index, categoryIndex, onHighlight, activeHighlightId }) => {
    const config = getSeverityConfig(issue.severity)
    const [showDetails, setShowDetails] = useState(false)
    const cardRef = React.useRef<HTMLDivElement>(null)

    // Generate stable IDs for this issue's highlights
    const highlightIds = issue.elements
        .filter(el => el.selector)
        .map((_, i) => `issue-${categoryIndex}-${index}-${i}`)

    // React to overlay click: glow + scroll into view
    const isActive = activeHighlightId != null && highlightIds.includes(activeHighlightId)
    React.useEffect(() => {
        if (isActive && cardRef.current) {
            cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
    }, [isActive])

    const handleHighlight = () => {
        const highlights: HighlightRequest[] = issue.elements
            .filter(el => el.selector)
            .map((el, i) => ({
                id: `issue-${categoryIndex}-${index}-${i}`,
                selector: el.selector,
                color: config.highlight,
                label: `#${index + 1}${issue.elements.length > 1 ? `.${i + 1}` : ''}`,
            }))
        if (highlights.length > 0) onHighlight(highlights)
        // Scroll to the first highlight in the page
        if (highlightIds.length > 0) {
            window.sidebarAPI.scrollToHighlight?.(highlightIds[0])
        }
    }

    return (
        <div ref={cardRef} className={cn(
            'rounded-lg border-l-[3px] bg-background shadow-sm mb-2 overflow-hidden transition-all hover:shadow-md',
            issue.severity === 'critical' && 'border-l-red-500',
            issue.severity === 'serious' && 'border-l-orange-500',
            issue.severity === 'moderate' && 'border-l-amber-500',
            issue.severity === 'minor' && 'border-l-blue-500',
            isActive && 'ring-2 ring-blueberry/60 shadow-lg shadow-blueberry/10',
        )}>
            <div className="p-3">
                <div className="flex items-start gap-2.5">
                    <SeverityBadge severity={issue.severity} />
                    <p className="text-sm font-medium text-foreground flex-1 leading-snug min-w-0">{issue.title}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{issue.description}</p>

                {issue.suggestedFix && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-success-foreground bg-success/10 rounded-md px-2.5 py-1.5">
                        <CheckCircle2 className="size-3 mt-0.5 shrink-0" />
                        <span>{issue.suggestedFix}</span>
                    </div>
                )}

                {issue.elements.length > 0 && issue.elements[0].html && (
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        aria-expanded={showDetails}
                        className="mt-2 text-caption text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {showDetails ? 'Hide HTML' : 'Show HTML snippet'}
                    </button>
                )}

                {showDetails && issue.elements[0]?.html && (
                    <pre className="mt-1 text-caption bg-muted/40 dark:bg-muted/40 rounded px-2 py-1.5 overflow-x-auto text-foreground/80 font-mono">
                        {issue.elements[0].html}
                    </pre>
                )}

                <div className="flex items-center gap-3 mt-2.5">
                    {issue.elements.some(el => el.selector) && (
                        <button
                            onClick={handleHighlight}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blueberry hover:text-blueberry/80 transition-colors"
                        >
                            <Eye className="size-3" />
                            Highlight
                        </button>
                    )}
                    {issue.helpUrl && (
                        <a
                            href={issue.helpUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Learn more about ${issue.title}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ExternalLink className="size-3" />
                            Learn more
                        </a>
                    )}
                </div>
            </div>
        </div>
    )
}

// Category Section — expandable with score indicator
const CategorySection: React.FC<{
    category: AuditCategory
    categoryIndex: number
    onHighlight: (highlights: HighlightRequest[]) => void
    activeHighlightId?: string | null
}> = ({ category, categoryIndex, onHighlight, activeHighlightId }) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const [filtering, setFiltering] = useState(false)

    // Auto-expand when a highlight in this category is clicked on the page
    useEffect(() => {
        if (!activeHighlightId || isExpanded) return
        const matchesCategory = category.issues.some((_, issueIdx) =>
            category.issues[issueIdx].elements
                .filter(el => el.selector)
                .some((_, elIdx) => activeHighlightId === `issue-${categoryIndex}-${issueIdx}-${elIdx}`)
        )
        if (matchesCategory) setIsExpanded(true)
    }, [activeHighlightId])

    const handleFilter = (e: React.MouseEvent) => {
        e.stopPropagation()
        const newFiltering = !filtering
        setFiltering(newFiltering)
        if (newFiltering) {
            window.sidebarAPI.filterHighlights?.([category.name.toLowerCase()])
        } else {
            window.sidebarAPI.filterHighlights?.([])
        }
    }

    const scoreColor = category.score >= 80
        ? 'text-success-foreground'
        : category.score >= 50
            ? 'text-warning-foreground'
            : 'text-red-600 dark:text-red-400'

    const barColor = category.score >= 80
        ? 'bg-gradient-to-r from-green-400 to-green-500'
        : category.score >= 50
            ? 'bg-gradient-to-r from-amber-400 to-amber-500'
            : 'bg-gradient-to-r from-red-400 to-red-500'

    return (
        <div className="border border-border/60 rounded-xl overflow-hidden mb-2 bg-background/50">
            <div
                role="button"
                tabIndex={0}
                onClick={() => setIsExpanded(!isExpanded)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsExpanded(!isExpanded) } }}
                aria-expanded={isExpanded}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer"
            >
                <ChevronRight className={cn(
                    'size-3.5 text-muted-foreground transition-transform duration-200',
                    isExpanded && 'rotate-90'
                )} />
                <span className="text-sm font-medium text-foreground flex-1 text-left">{category.name}</span>
                <button
                    onClick={handleFilter}
                    className={cn(
                        'p-0.5 rounded transition-colors',
                        filtering ? 'text-blueberry bg-blueberry/10' : 'text-muted-foreground/50 hover:text-muted-foreground'
                    )}
                    aria-label={filtering ? 'Show all highlights' : `Filter highlights to ${category.name}`}
                >
                    <Filter className="size-3" />
                </button>
                {/* Score bar + number */}
                <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                        <div
                            className={cn('h-full rounded-full transition-all duration-700', barColor)}
                            style={{ width: `${category.score}%` }}
                        />
                    </div>
                    <span className={cn('text-xs font-semibold tabular-nums w-7 text-right', scoreColor)}>
                        {category.score}
                    </span>
                </div>
                {category.issues.length > 0 && (
                    <span className="text-caption font-medium bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-md tabular-nums">
                        {category.issues.length}
                    </span>
                )}
            </div>

            {isExpanded && (
                <div className="px-4 pb-3 pt-1 border-t border-border/30">
                    {category.issues.length > 0 ? (
                        category.issues.map((issue, i) => (
                            <IssueCard key={i} issue={issue} index={i} categoryIndex={categoryIndex} onHighlight={onHighlight} activeHighlightId={activeHighlightId} />
                        ))
                    ) : (
                        <div className="flex items-center gap-2 py-2 text-sm text-success-foreground">
                            <CheckCircle2 className="size-4" />
                            No issues found
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// Severity summary pills for the header
const SeveritySummary: React.FC<{ counts: Record<string, number> }> = ({ counts }) => {
    const items = [
        { key: 'critical', color: 'bg-red-500', label: 'Critical' },
        { key: 'serious', color: 'bg-orange-500', label: 'Serious' },
        { key: 'moderate', color: 'bg-amber-500', label: 'Moderate' },
        { key: 'minor', color: 'bg-blue-500', label: 'Minor' },
    ].filter(item => counts[item.key] > 0)

    if (items.length === 0) return <span className="text-xs text-success-foreground font-medium">All clear!</span>

    return (
        <div className="flex flex-wrap gap-1.5">
            {items.map(({ key, color, label }) => (
                <div key={key} className="flex items-center gap-1 text-caption text-muted-foreground">
                    <span className={cn('size-1.5 rounded-full', color)} />
                    <span className="font-medium">{counts[key]}</span>
                    <span>{label}</span>
                </div>
            ))}
        </div>
    )
}

// Main AuditReport Component
export const AuditReportCard: React.FC<{
    report: AuditReportType
    onHighlight: (highlights: HighlightRequest[]) => void
    activeHighlightId?: string | null
}> = ({ report, onHighlight, activeHighlightId }) => {
    const severityCounts: Record<string, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 }
    let totalIssues = 0
    for (const cat of report.categories) {
        for (const issue of cat.issues) {
            severityCounts[issue.severity] = (severityCounts[issue.severity] || 0) + 1
            totalIssues++
        }
    }

    return (
        <div className="mt-4 rounded-2xl border border-border/60 bg-background overflow-hidden shadow-sm">
            {/* Header with gradient accent */}
            <div className="relative px-5 py-4 border-b border-border/40">
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-blueberry/60 via-violet-500/60 to-blueberry/30" />
                <div className="flex items-center gap-4">
                    <ScoreRing score={report.overallScore} />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground">Audit Report</h3>
                            <span className="text-caption text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                                {totalIssues} issue{totalIssues !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div className="mt-1.5">
                            <SeveritySummary counts={severityCounts} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Categories */}
            <div className="p-3 space-y-0">
                {report.categories.map((category, i) => (
                    <CategorySection key={i} category={category} categoryIndex={i} onHighlight={onHighlight} activeHighlightId={activeHighlightId} />
                ))}
            </div>
        </div>
    )
}

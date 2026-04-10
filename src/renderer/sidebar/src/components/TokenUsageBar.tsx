import React from 'react'
import { Zap } from 'lucide-react'
import { cn } from '@common/lib/utils'
import { formatTokens } from '../lib/formatters'

export const TokenUsageBar: React.FC<{
    tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number } | null
    totalTokensUsed: number
    contextLimit: number | null
    modelName: string | null
}> = ({ tokenUsage, totalTokensUsed, contextLimit, modelName }) => {
    if (!tokenUsage && totalTokensUsed === 0) return null

    const usagePercent = contextLimit ? Math.min((totalTokensUsed / contextLimit) * 100, 100) : 0
    const remaining = contextLimit ? contextLimit - totalTokensUsed : null
    const isHigh = usagePercent > 75

    return (
        <div className="px-4 py-2 space-y-1.5 border-t border-border/40">
            {contextLimit && totalTokensUsed > 0 && (
                <div className="flex items-center gap-2.5">
                    <div
                        className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden"
                        role="progressbar"
                        aria-valuenow={Math.round(usagePercent)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Context usage"
                    >
                        <div
                            className={cn(
                                "h-full rounded-full transition-all duration-500",
                                isHigh
                                    ? "bg-gradient-to-r from-amber-400 to-amber-500"
                                    : "bg-gradient-to-r from-blueberry/70 to-blueberry"
                            )}
                            style={{ width: `${Math.max(usagePercent, 1)}%` }}
                        />
                    </div>
                    <span className={cn(
                        "text-xs font-semibold tabular-nums min-w-[2.5rem] text-right",
                        isHigh ? "text-warning-foreground" : "text-muted-foreground"
                    )}>
                        {Math.round(usagePercent)}%
                    </span>
                </div>
            )}
            <div className="flex items-center gap-1.5 text-2xs text-muted-foreground flex-wrap">
                <Zap className="size-3 text-blueberry/60 shrink-0" />
                {modelName && (
                    <>
                        <span className="font-medium text-foreground/70">{modelName}</span>
                        <span className="text-muted-foreground/30">&middot;</span>
                    </>
                )}
                {tokenUsage && (
                    <span>{formatTokens(tokenUsage.inputTokens)} in / {formatTokens(tokenUsage.outputTokens)} out</span>
                )}
                {remaining != null && remaining > 0 && (
                    <>
                        <span className="text-muted-foreground/30">&middot;</span>
                        <span>{formatTokens(remaining)} left</span>
                    </>
                )}
                {totalTokensUsed > 0 && (
                    <>
                        <span className="text-muted-foreground/30">&middot;</span>
                        <span>{formatTokens(totalTokensUsed)} total</span>
                    </>
                )}
            </div>
        </div>
    )
}

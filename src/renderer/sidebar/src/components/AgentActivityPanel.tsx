import React from 'react'
import { Brain, Zap } from 'lucide-react'
import { cn } from '@common/lib/utils'
import { formatTokens } from '../lib/formatters'

interface AgentActivity {
  stepNumber: number
  toolCalls: string[]
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

interface AgentActivityPanelProps {
  activity: AgentActivity | null
  totalTokens: number
  contextLimit: number | null
}

export const AgentActivityPanel: React.FC<AgentActivityPanelProps> = ({
  activity,
  totalTokens,
  contextLimit
}) => {
  if (!activity) return null

  const usagePercent = contextLimit ? Math.min((totalTokens / contextLimit) * 100, 100) : 0
  const isHigh = usagePercent > 75

  return (
    <div className="px-4 py-2 bg-muted/30 border-y border-border animate-fade-in">
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <Brain className="size-3.5 text-blueberry" />
          <span className="text-muted-foreground">Step {activity.stepNumber}</span>
        </div>

        {activity.toolCalls.length > 0 && (
          <div className="flex items-center gap-1">
            <Zap className="size-3 text-warning" />
            <span className="text-muted-foreground">{activity.toolCalls.length} tools active</span>
          </div>
        )}

        {activity.usage && (
          <div className="flex items-center gap-1 ml-auto">
            <span className={cn(
              "tabular-nums",
              isHigh ? "text-warning-foreground" : "text-muted-foreground"
            )}>
              {formatTokens(activity.usage.totalTokens)} tokens
            </span>
          </div>
        )}
      </div>

      {activity.toolCalls.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {activity.toolCalls.map((tool, idx) => (
            <span key={idx} className="px-1.5 py-0.5 rounded bg-blueberry/10 text-blueberry text-2xs">
              {tool}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

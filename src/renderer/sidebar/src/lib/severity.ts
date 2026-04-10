import { Shield, AlertTriangle, Info } from 'lucide-react'
import type { FC } from 'react'

export interface SeverityConfig {
    color: string
    bg: string
    border: string
    highlight: string
    icon: FC<{ className?: string }>
    label: string
}

export const SEVERITY_CONFIG: Record<string, SeverityConfig> = {
    critical: {
        color: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-500/10 dark:bg-red-500/15',
        border: 'border-red-300 dark:border-red-700/60',
        highlight: '#ef4444',
        icon: Shield,
        label: 'Critical',
    },
    serious: {
        color: 'text-orange-600 dark:text-orange-400',
        bg: 'bg-orange-500/10 dark:bg-orange-500/15',
        border: 'border-orange-300 dark:border-orange-700/60',
        highlight: '#f97316',
        icon: AlertTriangle,
        label: 'Serious',
    },
    moderate: {
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-500/10 dark:bg-amber-500/15',
        border: 'border-amber-300 dark:border-amber-700/60',
        highlight: '#eab308',
        icon: Info,
        label: 'Moderate',
    },
    minor: {
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-500/10 dark:bg-blue-500/15',
        border: 'border-blue-300 dark:border-blue-700/60',
        highlight: '#3b82f6',
        icon: Info,
        label: 'Minor',
    },
    info: {
        color: 'text-gray-600 dark:text-gray-400',
        bg: 'bg-gray-100 dark:bg-gray-800/30',
        border: 'border-gray-300 dark:border-gray-700/60',
        highlight: '#6b7280',
        icon: Info,
        label: 'Info',
    },
}

export const SEVERITY_ORDER: Record<string, number> = {
    critical: 0,
    serious: 1,
    moderate: 2,
    minor: 3,
    info: 4,
}

export const getSeverityConfig = (severity: string): SeverityConfig =>
    SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info

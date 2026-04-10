import React, { useCallback, useRef } from 'react'
import { MessageSquare, CheckSquare, FileText, Settings } from 'lucide-react'
import { cn } from '@common/lib/utils'

export type SidebarPanel = 'chat' | 'tasks' | 'reports' | 'settings'

const TABS: { id: SidebarPanel; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
]

export const SidebarTabBar: React.FC<{
    active: SidebarPanel
    onChange: (panel: SidebarPanel) => void
}> = ({ active, onChange }) => {
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

    const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
        let nextIndex: number | null = null
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault()
            nextIndex = (index + 1) % TABS.length
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault()
            nextIndex = (index - 1 + TABS.length) % TABS.length
        } else if (e.key === 'Home') {
            e.preventDefault()
            nextIndex = 0
        } else if (e.key === 'End') {
            e.preventDefault()
            nextIndex = TABS.length - 1
        }
        if (nextIndex !== null) {
            tabRefs.current[nextIndex]?.focus()
            onChange(TABS[nextIndex].id)
        }
    }, [onChange])

    return (
        <div className="shrink-0 border-t border-border backdrop-blur-xl bg-background/80 h-9">
            <div className="flex items-center justify-around h-full px-2" role="tablist" aria-label="Sidebar panels">
                {TABS.map(({ id, label, icon: Icon }, index) => {
                    const isActive = active === id
                    return (
                        <button
                            key={id}
                            ref={el => { tabRefs.current[index] = el }}
                            onClick={() => onChange(id)}
                            onKeyDown={e => handleKeyDown(e, index)}
                            role="tab"
                            aria-selected={isActive}
                            aria-controls={`panel-${id}`}
                            tabIndex={isActive ? 0 : -1}
                            className={cn(
                                "relative flex items-center gap-1 px-2.5 py-1.5 rounded-md min-h-[44px]",
                                "transition-colors duration-150",
                                isActive
                                    ? "text-blueberry bg-blueberry/5"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Icon className="size-3.5" />
                            <span className="text-2xs font-medium">{label}</span>
                            {isActive && (
                                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full bg-blueberry" />
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

import React from 'react'
import { Plus, X } from 'lucide-react'
import { useBrowser } from '../contexts/BrowserContext'
import { Favicon } from '../components/Favicon'
import { cn } from '@common/lib/utils'

const IS_MAC = navigator.platform.toUpperCase().includes('MAC')

const getFaviconUrl = (url: string) => {
    try {
        const domain = new URL(url).hostname
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    } catch {
        return null
    }
}

const TabPill: React.FC<{
    title: string
    favicon?: string | null
    isActive: boolean
    onClose: () => void
    onActivate: () => void
}> = ({ title, favicon, isActive, onClose, onActivate }) => (
    <button
        onClick={() => !isActive && onActivate()}
        title={title || 'New Tab'}
        className={cn(
            "relative flex items-center gap-1.5 h-7 pl-2 pr-1 rounded-md max-w-[160px] min-w-[60px]",
            "text-xs select-none cursor-pointer app-region-no-drag group/tab",
            "transition-colors duration-150",
            isActive
                ? "bg-muted dark:bg-secondary text-foreground shadow-tab"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
    >
        <div className="shrink-0">
            <Favicon src={favicon} className="!size-3.5" />
        </div>
        <span className="flex-1 truncate text-left">{title || 'New Tab'}</span>
        <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onClose(); } }}
            aria-label={`Close tab: ${title || 'New Tab'}`}
            className={cn(
                "shrink-0 p-1 rounded transition-all",
                "hover:bg-foreground/10",
                isActive
                    ? "opacity-80 hover:opacity-100"
                    : "opacity-0 group-hover/tab:opacity-100"
            )}
        >
            <X className="size-3" />
        </span>
        {isActive && (
            <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-blueberry" />
        )}
    </button>
)

export const TabBar: React.FC = () => {
    const { tabs, createTab, closeTab, switchTab } = useBrowser()

    return (
        <div className="flex items-center overflow-hidden">
            {/* Traffic lights spacing only on macOS */}
            {IS_MAC && <div className="pl-[80px] shrink-0" />}

            {/* Tab pills - scrollable */}
            <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
                {tabs.map(tab => (
                    <TabPill
                        key={tab.id}
                        title={tab.title}
                        favicon={getFaviconUrl(tab.url)}
                        isActive={tab.isActive}
                        onClose={() => closeTab(tab.id)}
                        onActivate={() => switchTab(tab.id)}
                    />
                ))}
            </div>

            {/* Add tab button */}
            <button
                onClick={() => createTab('https://www.google.com')}
                aria-label="Open new tab"
                title="New tab"
                className="shrink-0 size-6 flex items-center justify-center rounded-md
                           hover:bg-muted/50 text-muted-foreground hover:text-foreground
                           transition-colors app-region-no-drag ml-0.5"
            >
                <Plus className="size-3.5" />
            </button>
        </div>
    )
}

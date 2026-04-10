import React, { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight, RefreshCw, Loader2, PanelLeftClose, PanelLeft, MessageCircle, Lock, LayoutDashboard } from 'lucide-react'
import { useBrowser } from '../contexts/BrowserContext'
import { Favicon } from '../components/Favicon'
import { DarkModeToggle } from '../components/DarkModeToggle'
import { cn } from '@common/lib/utils'

const NAV_BUTTON_CLASS = "size-6 flex items-center justify-center rounded-md hover:bg-muted/50 disabled:opacity-40 text-foreground transition-colors"

export const AddressBar: React.FC = () => {
    const { activeTab, navigateToUrl, goBack, goForward, reload, isLoading, createTab } = useBrowser()
    const [url, setUrl] = useState('')
    const [isEditing, setIsEditing] = useState(false)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    useEffect(() => {
        if (activeTab && !isEditing) {
            setUrl(activeTab.url || '')
        }
    }, [activeTab, isEditing])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!url.trim()) return

        let finalUrl = url.trim()
        if (finalUrl.startsWith('blueberry://')) {
            // blueberry://chat needs its own tab with chat preload
            if (finalUrl.startsWith('blueberry://chat')) {
                createTab(finalUrl)
                setIsEditing(false)
                ;(document.activeElement as HTMLElement)?.blur()
                return
            }
            // Other blueberry:// URLs (e.g. reports) navigate in current tab
        } else if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
            if (finalUrl.includes('.') && !finalUrl.includes(' ')) {
                finalUrl = `https://${finalUrl}`
            } else {
                finalUrl = `https://www.google.com/search?q=${encodeURIComponent(finalUrl)}`
            }
        }

        navigateToUrl(finalUrl)
        setIsEditing(false)
        ;(document.activeElement as HTMLElement)?.blur()
    }

    const handleFocus = () => setIsEditing(true)

    const handleBlur = () => {
        // Delay URL reset to allow form submit to fire first
        requestAnimationFrame(() => {
            setIsEditing(false)
            if (activeTab) setUrl(activeTab.url || '')
        })
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setIsEditing(false)
            if (activeTab) setUrl(activeTab.url || '')
            ;(e.target as HTMLInputElement).blur()
        }
    }

    const getDomain = () => {
        if (!activeTab?.url) return ''
        try { return new URL(activeTab.url).hostname.replace('www.', '') }
        catch { return activeTab.url }
    }

    const getFavicon = () => {
        if (!activeTab?.url) return null
        try {
            const domain = new URL(activeTab.url).hostname
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
        } catch { return null }
    }

    const isHttps = activeTab?.url?.startsWith('https://')

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen)
        if (window.topBarAPI) window.topBarAPI.toggleSidebar()
    }

    const canGoBack = activeTab !== null
    const canGoForward = activeTab !== null

    return (
        <div className="flex items-center gap-1 flex-1 min-w-0 pr-2">
            {/* Nav buttons */}
            <div className="flex items-center gap-0.5 app-region-no-drag shrink-0">
                <button
                    onClick={goBack}
                    disabled={!canGoBack || isLoading}
                    aria-label="Go back"
                    title="Go back"
                    className={NAV_BUTTON_CLASS}
                >
                    <ArrowLeft className="size-3.5" />
                </button>
                <button
                    onClick={goForward}
                    disabled={!canGoForward || isLoading}
                    aria-label="Go forward"
                    title="Go forward"
                    className={NAV_BUTTON_CLASS}
                >
                    <ArrowRight className="size-3.5" />
                </button>
                <button
                    onClick={reload}
                    disabled={!activeTab || isLoading}
                    aria-label={isLoading ? "Loading" : "Reload page"}
                    title={isLoading ? "Loading..." : "Reload"}
                    className={NAV_BUTTON_CLASS}
                >
                    {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                </button>
            </div>

            {/* Address pill */}
            {isEditing ? (
                <form onSubmit={handleSubmit} className="flex-1 min-w-0 app-region-no-drag">
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        className="w-full h-7 px-3 text-xs rounded-full bg-muted/50 dark:bg-secondary border border-border/50 text-foreground focus:border-blueberry/40 focus:ring-2 focus:ring-blueberry/20 outline-none transition-colors"
                        placeholder="Enter URL or search"
                        spellCheck={false}
                        autoFocus
                    />
                </form>
            ) : (
                <div
                    onClick={handleFocus}
                    title={activeTab?.url || undefined}
                    className={cn(
                        "flex-1 h-7 px-3 rounded-full flex items-center gap-2 min-w-0",
                        "bg-muted/40 dark:bg-secondary/50 cursor-text app-region-no-drag",
                        "hover:bg-muted/60 dark:hover:bg-secondary/70 transition-colors"
                    )}
                >
                    {isHttps ? (
                        <Lock className="size-3 text-success shrink-0" />
                    ) : (
                        <div className="shrink-0">
                            <Favicon src={getFavicon()} className="!size-3.5" />
                        </div>
                    )}
                    <span className="text-xs truncate text-foreground">
                        {activeTab ? getDomain() : 'No active tab'}
                    </span>
                </div>
            )}

            {/* Right actions */}
            <div className="flex items-center gap-0.5 shrink-0 app-region-no-drag">
                <button
                    onClick={() => navigateToUrl('blueberry://architecture')}
                    title="Architecture Overview"
                    className="size-6 flex items-center justify-center rounded-md hover:bg-muted/50 text-foreground transition-colors"
                >
                    <LayoutDashboard className="size-3.5" />
                </button>
                <button
                    onClick={() => createTab('blueberry://chat')}
                    title="Open Blueberry Chat"
                    className="size-6 flex items-center justify-center rounded-md hover:bg-blueberry/10 text-blueberry transition-colors"
                >
                    <MessageCircle className="size-3.5" />
                </button>
                <button
                    onClick={toggleSidebar}
                    title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
                    className="size-6 flex items-center justify-center rounded-md hover:bg-muted/50 text-foreground transition-colors"
                >
                    {isSidebarOpen ? <PanelLeftClose className="size-3.5" /> : <PanelLeft className="size-3.5" />}
                </button>
                <DarkModeToggle />
            </div>
        </div>
    )
}

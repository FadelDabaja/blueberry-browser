import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react'

interface TabInfo {
    id: string
    title: string
    url: string
    isActive: boolean
}

interface BrowserContextType {
    tabs: TabInfo[]
    activeTab: TabInfo | null
    isLoading: boolean

    // Tab management
    createTab: (url?: string) => Promise<void>
    closeTab: (tabId: string) => Promise<void>
    switchTab: (tabId: string) => Promise<void>
    refreshTabs: () => Promise<void>

    // Navigation
    navigateToUrl: (url: string) => Promise<void>
    goBack: () => Promise<void>
    goForward: () => Promise<void>
    reload: () => Promise<void>

    // Tab actions
    takeScreenshot: (tabId: string) => Promise<string | null>
    runJavaScript: (tabId: string, code: string) => Promise<any>
}

const BrowserContext = createContext<BrowserContextType | null>(null)

export const useBrowser = () => {
    const context = useContext(BrowserContext)
    if (!context) {
        throw new Error('useBrowser must be used within a BrowserProvider')
    }
    return context
}

export const BrowserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [tabs, setTabs] = useState<TabInfo[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([])

    const activeTab = useMemo(() => tabs.find(tab => tab.isActive) || null, [tabs])

    const refreshTabs = useCallback(async () => {
        try {
            const tabsData = await window.topBarAPI.getTabs()
            setTabs(tabsData)
        } catch (error) {
            console.error('Failed to refresh tabs:', error)
        }
    }, [])

    const createTab = useCallback(async (url?: string) => {
        setIsLoading(true)
        try {
            await window.topBarAPI.createTab(url)
            await refreshTabs()
        } catch (error) {
            console.error('Failed to create tab:', error)
        } finally {
            setIsLoading(false)
        }
    }, [refreshTabs])

    const closeTab = useCallback(async (tabId: string) => {
        setIsLoading(true)
        try {
            await window.topBarAPI.closeTab(tabId)
            await refreshTabs()
        } catch (error) {
            console.error('Failed to close tab:', error)
        } finally {
            setIsLoading(false)
        }
    }, [refreshTabs])

    const switchTab = useCallback(async (tabId: string) => {
        setIsLoading(true)
        try {
            await window.topBarAPI.switchTab(tabId)
            await refreshTabs()
        } catch (error) {
            console.error('Failed to switch tab:', error)
        } finally {
            setIsLoading(false)
        }
    }, [refreshTabs])

    const navigateToUrl = useCallback(async (url: string) => {
        if (!activeTab) return

        setIsLoading(true)
        try {
            await window.topBarAPI.navigateTab(activeTab.id, url)
            // Wait a bit for navigation to start, then refresh tabs to get updated URL
            const t = setTimeout(() => refreshTabs(), 500); timeoutRefs.current.push(t)
        } catch (error) {
            console.error('Failed to navigate:', error)
        } finally {
            setIsLoading(false)
        }
    }, [activeTab, refreshTabs])

    const goBack = useCallback(async () => {
        if (!activeTab) return

        try {
            await window.topBarAPI.goBack(activeTab.id)
            const t = setTimeout(() => refreshTabs(), 500); timeoutRefs.current.push(t)
        } catch (error) {
            console.error('Failed to go back:', error)
        }
    }, [activeTab, refreshTabs])

    const goForward = useCallback(async () => {
        if (!activeTab) return

        try {
            await window.topBarAPI.goForward(activeTab.id)
            const t = setTimeout(() => refreshTabs(), 500); timeoutRefs.current.push(t)
        } catch (error) {
            console.error('Failed to go forward:', error)
        }
    }, [activeTab, refreshTabs])

    const reload = useCallback(async () => {
        if (!activeTab) return

        try {
            await window.topBarAPI.reload(activeTab.id)
            const t = setTimeout(() => refreshTabs(), 500); timeoutRefs.current.push(t)
        } catch (error) {
            console.error('Failed to reload:', error)
        }
    }, [activeTab, refreshTabs])

    const takeScreenshot = useCallback(async (tabId: string) => {
        try {
            return await window.topBarAPI.tabScreenshot(tabId)
        } catch (error) {
            console.error('Failed to take screenshot:', error)
            return null
        }
    }, [])

    const runJavaScript = useCallback(async (tabId: string, code: string) => {
        try {
            return await window.topBarAPI.tabRunJs(tabId, code)
        } catch (error) {
            console.error('Failed to run JavaScript:', error)
            return null
        }
    }, [])

    // Initialize tabs on mount + cleanup timeouts
    useEffect(() => {
        refreshTabs()
        return () => {
            timeoutRefs.current.forEach(t => clearTimeout(t))
            timeoutRefs.current = []
        }
    }, [refreshTabs])

    // Listen for tabs-updated events from main process (e.g. target="_blank" opens)
    useEffect(() => {
        window.topBarAPI.onTabsUpdated(() => {
            refreshTabs()
        })
        return () => {
            window.topBarAPI.removeTabsUpdatedListener()
        }
    }, [refreshTabs])

    // Periodic refresh as fallback to keep tabs in sync
    useEffect(() => {
        const interval = setInterval(refreshTabs, 5000)
        return () => clearInterval(interval)
    }, [refreshTabs])

    const value = useMemo<BrowserContextType>(() => ({
        tabs,
        activeTab,
        isLoading,
        createTab,
        closeTab,
        switchTab,
        refreshTabs,
        navigateToUrl,
        goBack,
        goForward,
        reload,
        takeScreenshot,
        runJavaScript,
    }), [tabs, activeTab, isLoading, createTab, closeTab, switchTab, refreshTabs, navigateToUrl, goBack, goForward, reload, takeScreenshot, runJavaScript])

    return (
        <BrowserContext.Provider value={value}>
            {children}
        </BrowserContext.Provider>
    )
}


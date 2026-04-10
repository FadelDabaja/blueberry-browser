import React, { useState, useEffect } from 'react'
import { Globe } from 'lucide-react'

interface PageContext {
    url: string
    title: string
    favicon: string
}

const getDomain = (url: string): string => {
    try {
        return new URL(url).hostname
    } catch {
        return url
    }
}

export const PageContextBar: React.FC = () => {
    const [context, setContext] = useState<PageContext | null>(null)

    useEffect(() => {
        // Load initial context
        const loadContext = async () => {
            try {
                const info = await window.sidebarAPI.getActiveTabInfo()
                if (info) {
                    setContext({ url: info.url, title: info.title, favicon: '' })
                }
            } catch {
                // ignore
            }
        }
        loadContext()

        // Listen for updates
        const handleUpdate = (data: PageContext) => {
            setContext(data)
        }
        window.sidebarAPI.onPageContextUpdated(handleUpdate)

        return () => {
            window.sidebarAPI.removePageContextListener()
        }
    }, [])

    if (!context || !context.url) return null

    const domain = getDomain(context.url)

    return (
        <div
            className="flex items-center gap-2 px-3 border-b border-border bg-background/80 backdrop-blur-sm shrink-0 h-8"
            title={context.url}
        >
            <Globe className="size-3 text-muted-foreground shrink-0" />
            <span className="text-2xs text-foreground font-medium truncate">
                {context.title || domain}
            </span>
            <span className="text-2xs text-muted-foreground truncate">
                {domain}
            </span>
        </div>
    )
}

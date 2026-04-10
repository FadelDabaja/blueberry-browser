import React, { useState } from 'react'
import { ChatProvider } from './contexts/ChatContext'
import { Chat } from './components/Chat'
import { TasksPanel } from './components/TasksPanel'
import { ReportsPanel } from './components/ReportsPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { SidebarTabBar, type SidebarPanel } from './components/SidebarTabBar'
import { useDarkMode } from '@common/hooks/useDarkMode'
import { useCallback, useRef } from 'react'

// Resize handle for the left edge of the sidebar
const ResizeHandle: React.FC = () => {
    const startXRef = useRef(0)
    const isDragging = useRef(false)

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault()
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        startXRef.current = e.screenX
        isDragging.current = true
        window.sidebarAPI.resizeStart()
    }, [])

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging.current) return
        const deltaX = e.screenX - startXRef.current
        window.sidebarAPI.resizeMove(deltaX)
    }, [])

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDragging.current) return
        isDragging.current = false
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
        window.sidebarAPI.resizeEnd()
    }, [])

    return (
        <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-50
                       hover:bg-blueberry/20 active:bg-blueberry/30 transition-colors"
        />
    )
}

const SidebarContent: React.FC = () => {
    // useDarkMode handles document.documentElement.classList toggle internally
    useDarkMode()
    const [panel, setPanel] = useState<SidebarPanel>('chat')

    return (
        <div className="h-screen flex flex-col bg-background border-l border-border relative">
            <ResizeHandle />
            <div className="flex-1 overflow-hidden relative">
                {/* Keep Chat always mounted so it preserves state */}
                <div className={panel === 'chat' ? 'h-full' : 'hidden'} id="panel-chat" role="tabpanel">
                    <Chat />
                </div>
                {panel === 'tasks' && <div id="panel-tasks" role="tabpanel"><TasksPanel /></div>}
                {panel === 'reports' && <div id="panel-reports" role="tabpanel"><ReportsPanel /></div>}
                {panel === 'settings' && <div id="panel-settings" role="tabpanel"><SettingsPanel /></div>}
            </div>
            <SidebarTabBar active={panel} onChange={setPanel} />
        </div>
    )
}

export const SidebarApp: React.FC = () => {
    return (
        <ChatProvider>
            <SidebarContent />
        </ChatProvider>
    )
}

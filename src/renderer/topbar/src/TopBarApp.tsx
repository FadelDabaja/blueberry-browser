import React from 'react'
import { BrowserProvider } from './contexts/BrowserContext'
import { TabBar } from './components/TabBar'
import { AddressBar } from './components/AddressBar'
import { WindowControls } from './components/WindowControls'

const IS_MAC = navigator.platform.toLowerCase().includes('mac')

export const TopBarApp: React.FC = () => {
    return (
        <BrowserProvider>
            <div className="flex items-center h-11 bg-background app-region-drag select-none border-b border-border/50">
                <TabBar />
                <div className="h-5 w-px bg-border/50 mx-1 shrink-0" />
                <AddressBar />
                {!IS_MAC && <WindowControls />}
            </div>
        </BrowserProvider>
    )
}

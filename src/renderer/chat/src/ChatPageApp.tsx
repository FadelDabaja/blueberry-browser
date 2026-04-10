import React, { useEffect } from 'react'
import { ChatProvider } from '../../sidebar/src/contexts/ChatContext'
import { Chat } from '../../sidebar/src/components/Chat'
import { useDarkMode } from '@common/hooks/useDarkMode'

const ChatPageContent: React.FC = () => {
    const { isDarkMode } = useDarkMode()

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }, [isDarkMode])

    return (
        <div className="h-screen flex flex-col bg-background">
            <div className="flex-1 overflow-hidden max-w-3xl w-full mx-auto">
                <Chat />
            </div>
        </div>
    )
}

export const ChatPageApp: React.FC = () => {
    return (
        <ChatProvider>
            <ChatPageContent />
        </ChatProvider>
    )
}

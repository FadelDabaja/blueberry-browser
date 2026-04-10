import { useRef, useEffect, useLayoutEffect } from 'react'
import type { Message } from '../types/chat'

// Auto-scroll hook - triggers on message count AND content changes
export const useAutoScroll = (messages: Message[], isLoading: boolean) => {
    const scrollRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const shouldAutoScroll = useRef(true)

    // Track if user has scrolled up
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container
            shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 100
        }

        container.addEventListener('scroll', handleScroll)
        return () => container.removeEventListener('scroll', handleScroll)
    }, [])

    // Auto-scroll on content changes
    useLayoutEffect(() => {
        if (shouldAutoScroll.current) {
            setTimeout(() => {
                scrollRef.current?.scrollIntoView({
                    behavior: isLoading ? 'instant' : 'smooth',
                    block: 'end'
                })
            }, 50)
        }
    }, [messages, messages[messages.length - 1]?.content, isLoading])

    return { scrollRef, containerRef }
}

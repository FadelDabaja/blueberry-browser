/** Relative time from an ISO string or timestamp */
export const getRelativeTime = (input: string | number): string => {
    const ts = typeof input === 'number' ? input : new Date(input).getTime()
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`
    return new Date(ts).toLocaleDateString()
}

/** Format a duration in ms to human-readable */
export const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`
    const secs = ms / 1000
    if (secs < 60) return `${secs.toFixed(1)}s`
    const mins = Math.floor(secs / 60)
    const remainingSecs = Math.round(secs % 60)
    return `${mins}m ${remainingSecs}s`
}

/** Format a token count with K/M suffix */
export const formatTokens = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return `${n}`
}

import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatDuration, formatTokens, getRelativeTime } from './formatters'

describe('formatDuration', () => {
    it('returns ms for values under 1000', () => {
        expect(formatDuration(0)).toBe('0ms')
        expect(formatDuration(500)).toBe('500ms')
        expect(formatDuration(999)).toBe('999ms')
    })

    it('returns seconds with one decimal for values under 60s', () => {
        expect(formatDuration(1000)).toBe('1.0s')
        expect(formatDuration(1500)).toBe('1.5s')
        expect(formatDuration(59999)).toBe('60.0s')
    })

    it('returns minutes and seconds for values >= 60s', () => {
        expect(formatDuration(60000)).toBe('1m 0s')
        expect(formatDuration(90000)).toBe('1m 30s')
        expect(formatDuration(125000)).toBe('2m 5s')
    })
})

describe('formatTokens', () => {
    it('returns raw number under 1000', () => {
        expect(formatTokens(0)).toBe('0')
        expect(formatTokens(500)).toBe('500')
        expect(formatTokens(999)).toBe('999')
    })

    it('returns k suffix for thousands', () => {
        expect(formatTokens(1000)).toBe('1.0k')
        expect(formatTokens(1500)).toBe('1.5k')
        expect(formatTokens(999_999)).toBe('1000.0k')
    })

    it('returns M suffix for millions', () => {
        expect(formatTokens(1_000_000)).toBe('1.0M')
        expect(formatTokens(2_500_000)).toBe('2.5M')
    })
})

describe('getRelativeTime', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    const fixedNow = new Date('2026-04-10T12:00:00Z').getTime()

    it('returns "Just now" for < 1 minute ago', () => {
        vi.useFakeTimers({ now: fixedNow })
        expect(getRelativeTime(fixedNow - 30_000)).toBe('Just now')
    })

    it('returns "Xm ago" for minutes', () => {
        vi.useFakeTimers({ now: fixedNow })
        expect(getRelativeTime(fixedNow - 5 * 60_000)).toBe('5m ago')
        expect(getRelativeTime(fixedNow - 59 * 60_000)).toBe('59m ago')
    })

    it('returns "Xh ago" for hours', () => {
        vi.useFakeTimers({ now: fixedNow })
        expect(getRelativeTime(fixedNow - 2 * 3600_000)).toBe('2h ago')
    })

    it('returns "Yesterday" for 1 day ago', () => {
        vi.useFakeTimers({ now: fixedNow })
        expect(getRelativeTime(fixedNow - 24 * 3600_000)).toBe('Yesterday')
    })

    it('returns "Xd ago" for 2-6 days', () => {
        vi.useFakeTimers({ now: fixedNow })
        expect(getRelativeTime(fixedNow - 3 * 24 * 3600_000)).toBe('3d ago')
    })

    it('returns locale date string for >= 7 days', () => {
        vi.useFakeTimers({ now: fixedNow })
        const ts = fixedNow - 10 * 24 * 3600_000
        expect(getRelativeTime(ts)).toBe(new Date(ts).toLocaleDateString())
    })

    it('accepts ISO string input', () => {
        vi.useFakeTimers({ now: fixedNow })
        const iso = new Date(fixedNow - 5 * 60_000).toISOString()
        expect(getRelativeTime(iso)).toBe('5m ago')
    })
})

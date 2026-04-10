import { describe, it, expect } from 'vitest'
import {
    buildControllerScript,
    buildAddHighlightsScript,
    buildClearScript,
    buildFilterScript,
    buildSelectHighlightScript,
    buildHighlightScript,
} from './overlayController'

describe('buildControllerScript', () => {
    it('returns a self-invoking function', () => {
        const script = buildControllerScript()
        expect(script).toMatch(/^\(function\(\)/)
        expect(script).toContain('window.__blueberry')
    })

    it('includes addHighlights API', () => {
        const script = buildControllerScript()
        expect(script).toContain('addHighlights')
        expect(script).toContain('clearAll')
        expect(script).toContain('filterByCategory')
        expect(script).toContain('scrollToHighlight')
    })

    it('includes MAX_HIGHLIGHTS limit', () => {
        expect(buildControllerScript()).toContain('MAX_HIGHLIGHTS')
    })
})

describe('buildAddHighlightsScript', () => {
    const items = [{
        id: 'h-1',
        selector: '#main',
        category: 'accessibility',
        severity: 'critical',
        label: 'Missing alt',
        description: 'Image needs alt text',
        color: '#ef4444',
    }]

    it('includes controller initialization', () => {
        const script = buildAddHighlightsScript(items)
        expect(script).toContain('window.__blueberry')
    })

    it('includes escaped item data', () => {
        const script = buildAddHighlightsScript(items)
        expect(script).toContain('h-1')
        expect(script).toContain('#main')
        expect(script).toContain('accessibility')
    })

    it('escapes special characters in fields', () => {
        const xssItems = [{
            id: 'h-1',
            selector: "div[data-x='test']",
            category: 'test',
            severity: 'info',
            label: "It's <bad>",
            description: 'Has `backtick` and $dollar',
            color: '#000',
        }]
        const script = buildAddHighlightsScript(xssItems)
        expect(script).toContain("\\'") // escaped single quote
        expect(script).toContain('\\`') // escaped backtick
        expect(script).toContain('\\$') // escaped dollar
    })
})

describe('buildClearScript', () => {
    it('calls clearAll and removes containers', () => {
        const script = buildClearScript()
        expect(script).toContain('clearAll')
        expect(script).toContain('__blueberry_overlay_container__')
        expect(script).toContain('delete window.__blueberry')
    })
})

describe('buildFilterScript', () => {
    it('passes escaped categories to filterByCategory', () => {
        const script = buildFilterScript(['accessibility', 'contrast'])
        expect(script).toContain('filterByCategory')
        expect(script).toContain('accessibility')
        expect(script).toContain('contrast')
    })

    it('escapes special characters in category names', () => {
        const script = buildFilterScript(["it's"])
        expect(script).toContain("\\'")
    })
})

describe('buildSelectHighlightScript', () => {
    it('calls scrollToHighlight with escaped id', () => {
        const script = buildSelectHighlightScript('h-42')
        expect(script).toContain('scrollToHighlight')
        expect(script).toContain('h-42')
    })
})

describe('buildHighlightScript', () => {
    it('wraps legacy format into HighlightItems', () => {
        const script = buildHighlightScript([
            { selector: '.foo', color: '#f00', label: 'Issue' },
        ])
        expect(script).toContain('.foo')
        expect(script).toContain('#f00')
        expect(script).toContain('Issue')
        expect(script).toContain('manual') // default category
    })
})

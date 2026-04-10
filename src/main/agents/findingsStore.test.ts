import { describe, it, expect } from 'vitest'
import { FindingsStore } from './findingsStore'

const makeFinding = (overrides: Partial<{ category: string; severity: string; description: string }> = {}) => ({
    category: overrides.category ?? 'accessibility',
    severity: (overrides.severity ?? 'moderate') as any,
    description: overrides.description ?? 'Test finding',
    sourceAgent: 'main',
})

describe('FindingsStore', () => {
    it('adds findings with auto-generated id and timestamp', () => {
        const store = new FindingsStore()
        const finding = store.add(makeFinding())
        expect(finding.id).toBe('f-1')
        expect(finding.timestamp).toBeGreaterThan(0)
    })

    it('increments id counter', () => {
        const store = new FindingsStore()
        store.add(makeFinding())
        const second = store.add(makeFinding())
        expect(second.id).toBe('f-2')
    })

    it('addBatch adds multiple findings', () => {
        const store = new FindingsStore()
        const results = store.addBatch([makeFinding(), makeFinding(), makeFinding()])
        expect(results).toHaveLength(3)
        expect(store.count).toBe(3)
    })

    it('getAll returns a copy', () => {
        const store = new FindingsStore()
        store.add(makeFinding())
        const all = store.getAll()
        all.pop()
        expect(store.count).toBe(1)
    })

    it('getByCategory filters correctly', () => {
        const store = new FindingsStore()
        store.add(makeFinding({ category: 'seo' }))
        store.add(makeFinding({ category: 'accessibility' }))
        store.add(makeFinding({ category: 'seo' }))

        expect(store.getByCategory('seo')).toHaveLength(2)
        expect(store.getByCategory('accessibility')).toHaveLength(1)
        expect(store.getByCategory('performance')).toHaveLength(0)
    })

    it('getBySeverity filters correctly', () => {
        const store = new FindingsStore()
        store.add(makeFinding({ severity: 'critical' }))
        store.add(makeFinding({ severity: 'moderate' }))
        store.add(makeFinding({ severity: 'critical' }))

        expect(store.getBySeverity('critical')).toHaveLength(2)
        expect(store.getBySeverity('minor')).toHaveLength(0)
    })

    it('getSummary returns empty string for empty store', () => {
        const store = new FindingsStore()
        expect(store.getSummary()).toBe('')
    })

    it('getSummary includes count, severity, and categories', () => {
        const store = new FindingsStore()
        store.add(makeFinding({ severity: 'critical', category: 'seo' }))
        store.add(makeFinding({ severity: 'moderate', category: 'accessibility' }))
        store.add(makeFinding({ severity: 'critical', category: 'seo' }))

        const summary = store.getSummary()
        expect(summary).toContain('3 total')
        expect(summary).toContain('2 critical')
        expect(summary).toContain('1 moderate')
        expect(summary).toContain('seo(2)')
        expect(summary).toContain('accessibility(1)')
    })

    it('getSummary orders severity (critical before moderate)', () => {
        const store = new FindingsStore()
        store.add(makeFinding({ severity: 'moderate' }))
        store.add(makeFinding({ severity: 'critical' }))

        const summary = store.getSummary()
        const critIdx = summary.indexOf('critical')
        const modIdx = summary.indexOf('moderate')
        expect(critIdx).toBeLessThan(modIdx)
    })

    it('getStructured groups by category', () => {
        const store = new FindingsStore()
        store.add(makeFinding({ category: 'seo' }))
        store.add(makeFinding({ category: 'seo' }))
        store.add(makeFinding({ category: 'contrast' }))

        const structured = store.getStructured()
        expect(structured).toHaveLength(2)
        expect(structured.find(s => s.category === 'seo')!.count).toBe(2)
        expect(structured.find(s => s.category === 'contrast')!.count).toBe(1)
    })

    it('clear resets store', () => {
        const store = new FindingsStore()
        store.add(makeFinding())
        store.add(makeFinding())
        store.clear()

        expect(store.count).toBe(0)
        expect(store.getAll()).toEqual([])

        // id counter also resets
        const next = store.add(makeFinding())
        expect(next.id).toBe('f-1')
    })
})

import { describe, it, expect } from 'vitest'
import { truncateIpcOutput, unwrapToolResults, extractFindings } from './streamProcessor'
import { FindingsStore } from '../agents/findingsStore'

describe('truncateIpcOutput', () => {
    it('replaces screenshot tool output with hasScreenshot flag', () => {
        expect(truncateIpcOutput('take_screenshot', { data: 'base64...' })).toEqual({ hasScreenshot: true })
        expect(truncateIpcOutput('analyze_visual_design', { data: 'base64...' })).toEqual({ hasScreenshot: true })
    })

    it('truncates subagent summary', () => {
        const longSummary = 'x'.repeat(1000)
        const result = truncateIpcOutput('run_specialized_task', { summary: longSummary, stepsUsed: 3 }) as any
        expect(result.summary.length).toBe(500)
        expect(result.stepsUsed).toBe(3)
    })

    it('passes through subagent output without summary', () => {
        const output = { error: 'failed' }
        expect(truncateIpcOutput('run_specialized_task', output)).toBe(output)
    })

    it('truncates parallel task result summaries', () => {
        const output = {
            totalTasks: 2,
            results: [
                { id: '1', status: 'success', summary: 'a'.repeat(500), error: null },
                { id: '2', status: 'error', summary: null, error: 'boom' },
            ],
        }
        const result = truncateIpcOutput('run_parallel_tasks', output) as any
        expect(result.totalTasks).toBe(2)
        expect(result.results[0].summary.length).toBe(200)
        expect(result.results[1].error).toBe('boom')
    })

    it('truncates long string output', () => {
        const long = 'z'.repeat(1000)
        const result = truncateIpcOutput('some_tool', long) as string
        expect(result.length).toBe(503) // 500 + "..."
        expect(result.endsWith('...')).toBe(true)
    })

    it('passes through short output unchanged', () => {
        expect(truncateIpcOutput('navigate', { url: 'https://example.com' })).toEqual({ url: 'https://example.com' })
    })
})

describe('unwrapToolResults', () => {
    it('unwraps specialized task toolResults', () => {
        const target: { toolName: string; result: any }[] = []
        unwrapToolResults('run_specialized_task', {
            toolResults: [
                { toolName: 'check_seo', result: { title: 'ok' } },
                { toolName: 'run_contrast_check', result: { failCount: 0 } },
            ],
        }, target)

        expect(target).toHaveLength(2)
        expect(target[0].toolName).toBe('check_seo')
        expect(target[1].toolName).toBe('run_contrast_check')
    })

    it('unwraps parallel task results', () => {
        const target: { toolName: string; result: any }[] = []
        unwrapToolResults('run_parallel_tasks', {
            results: [
                { status: 'success', toolResults: [{ toolName: 'check_seo', result: {} }] },
                { status: 'error', toolResults: [] },
                { status: 'success', toolResults: [{ toolName: 'run_contrast_check', result: {} }] },
            ],
        }, target)

        expect(target).toHaveLength(2)
    })

    it('pushes regular tools directly', () => {
        const target: { toolName: string; result: any }[] = []
        unwrapToolResults('navigate', { url: 'https://example.com' }, target)
        expect(target).toEqual([{ toolName: 'navigate', result: { url: 'https://example.com' } }])
    })
})

describe('extractFindings', () => {
    it('extracts contrast findings', () => {
        const store = new FindingsStore()
        extractFindings('run_contrast_check', {
            failingElements: [
                { ratio: 2.0, required: 4.5, text: 'Click', foreground: '#ccc', background: '#fff', selector: 'a.btn' },
                { ratio: 4.0, required: 4.5, text: 'More', foreground: '#666', background: '#fff', selector: 'a.more' },
            ],
        }, store)

        expect(store.count).toBe(2)
        expect(store.getAll()[0].severity).toBe('critical') // ratio < 3
        expect(store.getAll()[1].severity).toBe('serious') // ratio >= 3
    })

    it('extracts accessibility violations', () => {
        const store = new FindingsStore()
        extractFindings('run_accessibility_audit', {
            violations: [
                { impact: 'serious', description: 'Missing alt', nodes: [{ target: ['img'] }] },
            ],
        }, store)

        expect(store.count).toBe(1)
        expect(store.getAll()[0].category).toBe('accessibility')
    })

    it('extracts DOM quality heading issues', () => {
        const store = new FindingsStore()
        extractFindings('check_dom_quality', {
            headingIssues: ['H1 missing', { issue: 'Skipped level', selector: 'h3' }],
        }, store)

        expect(store.count).toBe(2)
        expect(store.getAll()[0].category).toBe('dom-quality')
    })

    it('extracts SEO findings', () => {
        const store = new FindingsStore()
        extractFindings('check_seo', {
            title: { isGood: false, length: 5 },
            metaDescription: { value: null },
        }, store)

        expect(store.count).toBe(2)
    })

    it('extracts console error findings', () => {
        const store = new FindingsStore()
        extractFindings('get_console_logs', {
            entries: [
                { level: 'error', message: 'TypeError' },
                { level: 'log', message: 'debug' },
            ],
        }, store)

        expect(store.count).toBe(1) // only errors
    })

    it('extracts network error findings', () => {
        const store = new FindingsStore()
        extractFindings('get_network_errors', {
            entries: [{ statusCode: 500, url: '/api' }, { statusCode: 404, url: '/missing' }],
        }, store)

        expect(store.count).toBe(2)
        expect(store.getAll()[0].severity).toBe('serious') // 500
        expect(store.getAll()[1].severity).toBe('moderate') // 404
    })

    it('extracts performance findings', () => {
        const store = new FindingsStore()
        extractFindings('get_performance_metrics', { timing: { load: 6000 } }, store)

        expect(store.count).toBe(1)
        expect(store.getAll()[0].severity).toBe('critical') // > 5000
    })

    it('does nothing for null output or null store', () => {
        const store = new FindingsStore()
        extractFindings('run_contrast_check', null, store)
        expect(store.count).toBe(0)

        extractFindings('run_contrast_check', { failingElements: [] }, null as any)
        // no error thrown
    })
})

import { describe, it, expect } from 'vitest'
import { buildAuditReport } from './auditReportBuilder'

describe('buildAuditReport', () => {
    it('returns null when no audit tools were run', () => {
        expect(buildAuditReport([], 'msg-1')).toBeNull()
        expect(buildAuditReport([{ toolName: 'navigate', result: {} }], 'msg-1')).toBeNull()
    })

    it('builds accessibility category from violations', () => {
        const result = buildAuditReport([{
            toolName: 'run_accessibility_audit',
            result: {
                violations: [{
                    impact: 'critical',
                    help: 'Images must have alt text',
                    description: 'Ensures <img> elements have alt attributes',
                    helpUrl: 'https://example.com',
                    nodes: [{ html: '<img src="x">', target: ['img.hero'] }],
                }],
                totalViolations: 1,
                passes: 49,
            },
        }], 'msg-1')!

        expect(result).not.toBeNull()
        expect(result.messageId).toBe('msg-1')
        expect(result.categories).toHaveLength(1)

        const cat = result.categories[0]
        expect(cat.name).toBe('Accessibility')
        expect(cat.score).toBe(98) // 49/50 * 100
        expect(cat.issues).toHaveLength(1)
        expect(cat.issues[0].severity).toBe('critical')
        expect(cat.issues[0].elements[0].selector).toBe('img.hero')
    })

    it('builds DOM Quality category', () => {
        const result = buildAuditReport([{
            toolName: 'check_dom_quality',
            result: {
                headingIssues: ['H1 missing', { issue: 'Skipped H2', selector: 'h3.foo' }],
                images: { missingAlt: 3 },
                landmarks: { main: false },
                nestingDepth: 20,
            },
        }], 'msg-1')!

        const cat = result.categories[0]
        expect(cat.name).toBe('DOM Quality')
        expect(cat.issues.length).toBeGreaterThanOrEqual(4)
        expect(cat.issues.find(i => i.title === 'Deep DOM Nesting')).toBeTruthy()
        expect(cat.issues.find(i => i.title === 'Images Missing Alt Text')).toBeTruthy()
    })

    it('builds Color Contrast category', () => {
        const result = buildAuditReport([{
            toolName: 'run_contrast_check',
            result: {
                failingElements: [
                    { ratio: 2.1, required: 4.5, text: 'Click', foreground: '#ccc', background: '#fff', element: '<a>', selector: 'a.btn' },
                ],
                totalChecked: 20,
                failCount: 1,
            },
        }], 'msg-1')!

        const cat = result.categories[0]
        expect(cat.name).toBe('Color Contrast')
        expect(cat.score).toBe(95) // 19/20 * 100
        expect(cat.issues[0].severity).toBe('critical') // ratio 2.1 < 3
    })

    it('builds SEO category with multiple issues', () => {
        const result = buildAuditReport([{
            toolName: 'check_seo',
            result: {
                title: { isGood: false, length: 10 },
                metaDescription: { value: null },
                viewport: false,
                h1Count: 0,
                openGraph: { title: null },
            },
        }], 'msg-1')!

        const cat = result.categories[0]
        expect(cat.name).toBe('SEO')
        expect(cat.issues.find(i => i.title === 'Missing Viewport Meta Tag')).toBeTruthy()
        expect(cat.issues.find(i => i.title === 'Missing H1')).toBeTruthy()
        expect(cat.issues.find(i => i.title === 'Missing Meta Description')).toBeTruthy()
    })

    it('builds Forms category', () => {
        const result = buildAuditReport([{
            toolName: 'analyze_forms',
            result: {
                forms: [{
                    index: 0,
                    isWrapped: false,
                    hasSubmitButton: false,
                    inputCount: 3,
                    containerSelector: '.form-area',
                    issues: ['Input missing label'],
                }],
            },
        }], 'msg-1')!

        const cat = result.categories[0]
        expect(cat.name).toBe('Forms')
        expect(cat.issues).toHaveLength(3) // unwrapped + no submit + label issue
    })

    it('builds JavaScript Errors category', () => {
        const result = buildAuditReport([{
            toolName: 'get_console_logs',
            result: {
                entries: [
                    { level: 'error', message: 'Uncaught TypeError', sourceId: 'app.js', line: 42 },
                    { level: 'warning', message: 'Deprecated API usage' },
                    { level: 'log', message: 'debug info' },
                ],
            },
        }], 'msg-1')!

        const cat = result.categories[0]
        expect(cat.name).toBe('JavaScript Errors')
        expect(cat.issues).toHaveLength(2) // error + warning, not log
    })

    it('builds Network Errors category', () => {
        const result = buildAuditReport([{
            toolName: 'get_network_errors',
            result: {
                entries: [
                    { statusCode: 500, method: 'GET', url: '/api/data' },
                    { statusCode: 404, method: 'GET', url: '/missing.js' },
                ],
            },
        }], 'msg-1')!

        const cat = result.categories[0]
        expect(cat.name).toBe('Network Errors')
        expect(cat.issues).toHaveLength(2)
        expect(cat.issues[0].severity).toBe('serious') // 500
        expect(cat.issues[1].severity).toBe('moderate') // 404
    })

    it('builds Performance category', () => {
        const result = buildAuditReport([{
            toolName: 'get_performance_metrics',
            result: {
                timing: { load: 6000 },
                dom: { elementCount: 4000 },
                lcp: 5000,
            },
        }], 'msg-1')!

        const cat = result.categories[0]
        expect(cat.name).toBe('Performance')
        expect(cat.issues).toHaveLength(3)
        expect(cat.issues.find(i => i.severity === 'critical')).toBeTruthy() // load > 5000
    })

    it('computes overall score as average of categories', () => {
        const result = buildAuditReport([
            { toolName: 'check_seo', result: { title: { isGood: true }, metaDescription: { value: 'ok' }, viewport: true, h1Count: 1, openGraph: { title: 'ok' } } },
            { toolName: 'run_contrast_check', result: { failingElements: [], totalChecked: 10, failCount: 0 } },
        ], 'msg-1')!

        // SEO: 0 issues → score 100, Contrast: 0 failing → score 100
        expect(result.overallScore).toBe(100)
    })
})

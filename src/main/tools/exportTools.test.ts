import { describe, it, expect } from 'vitest'
import { escapeHtml, wrapMarkdownInHtml } from './exportTools'

describe('escapeHtml', () => {
    it('escapes ampersand', () => {
        expect(escapeHtml('a & b')).toBe('a &amp; b')
    })

    it('escapes angle brackets', () => {
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
    })

    it('escapes quotes', () => {
        expect(escapeHtml('"hello" & \'world\'')).toBe('&quot;hello&quot; &amp; &#39;world&#39;')
    })

    it('handles combined XSS string', () => {
        expect(escapeHtml('<img onerror="alert(1)">')).toBe('&lt;img onerror=&quot;alert(1)&quot;&gt;')
    })
})

describe('wrapMarkdownInHtml', () => {
    it('wraps content in valid HTML document', () => {
        const html = wrapMarkdownInHtml('Test Report', 'Hello world')
        expect(html).toContain('<!DOCTYPE html>')
        expect(html).toContain('<title>Test Report</title>')
        expect(html).toContain('<p>Hello world</p>')
    })

    it('escapes title for XSS', () => {
        const html = wrapMarkdownInHtml('<script>alert(1)</script>', 'content')
        expect(html).not.toContain('<script>alert(1)</script>')
        expect(html).toContain('&lt;script&gt;')
    })

    it('converts headings', () => {
        const html = wrapMarkdownInHtml('T', '# H1\n## H2\n### H3')
        expect(html).toContain('<h1>H1</h1>')
        expect(html).toContain('<h2>H2</h2>')
        expect(html).toContain('<h3>H3</h3>')
    })

    it('converts bold and italic', () => {
        const html = wrapMarkdownInHtml('T', '**bold** and *italic*')
        expect(html).toContain('<strong>bold</strong>')
        expect(html).toContain('<em>italic</em>')
    })

    it('converts inline code', () => {
        const html = wrapMarkdownInHtml('T', 'Use `console.log`')
        expect(html).toContain('<code>console.log</code>')
    })

    it('converts code blocks with language', () => {
        const html = wrapMarkdownInHtml('T', '```js\nconst x = 1;\n```')
        expect(html).toContain('<pre><code class="language-js">')
        expect(html).toContain('const x = 1;')
    })

    it('converts unordered lists', () => {
        const html = wrapMarkdownInHtml('T', '- item 1\n- item 2')
        expect(html).toContain('<ul>')
        expect(html).toContain('<li>item 1</li>')
        expect(html).toContain('<li>item 2</li>')
    })

    it('converts ordered lists', () => {
        const html = wrapMarkdownInHtml('T', '1. first\n2. second')
        expect(html).toContain('<ol>')
        expect(html).toContain('<li>first</li>')
    })

    it('converts blockquotes', () => {
        const html = wrapMarkdownInHtml('T', '> This is a quote')
        expect(html).toContain('<blockquote>')
        expect(html).toContain('This is a quote')
    })

    it('converts horizontal rules', () => {
        const html = wrapMarkdownInHtml('T', '---')
        expect(html).toContain('<hr>')
    })

    it('converts links', () => {
        const html = wrapMarkdownInHtml('T', '[Click](https://example.com)')
        expect(html).toContain('<a href="https://example.com">Click</a>')
    })

    it('converts tables with headers', () => {
        const md = '| Name | Score |\n| --- | --- |\n| A | 100 |'
        const html = wrapMarkdownInHtml('T', md)
        expect(html).toContain('<table>')
        expect(html).toContain('<thead>')
        expect(html).toContain('<th>Name')
        expect(html).toContain('<td>A')
    })

    it('converts strikethrough', () => {
        const html = wrapMarkdownInHtml('T', '~~deleted~~')
        expect(html).toContain('<del>deleted</del>')
    })
})

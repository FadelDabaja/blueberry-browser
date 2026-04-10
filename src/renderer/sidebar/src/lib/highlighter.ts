import { createHighlighter, type Highlighter } from 'shiki'

let highlighterPromise: Promise<Highlighter> | null = null

const THEMES = ['github-dark', 'github-light'] as const
const LANGS = [
    'javascript', 'typescript', 'python', 'html', 'css', 'json',
    'bash', 'shell', 'yaml', 'markdown', 'jsx', 'tsx', 'sql',
    'rust', 'go', 'java', 'c', 'cpp', 'ruby', 'php', 'swift',
    'kotlin', 'xml', 'toml', 'ini', 'diff',
] as const

function getHighlighter(): Promise<Highlighter> {
    if (!highlighterPromise) {
        highlighterPromise = createHighlighter({
            themes: [...THEMES],
            langs: [...LANGS],
        })
    }
    return highlighterPromise
}

export async function highlightCode(code: string, lang: string, isDark: boolean): Promise<string> {
    try {
        const highlighter = await getHighlighter()
        const theme = isDark ? 'github-dark' : 'github-light'
        const validLang = LANGS.includes(lang as any) ? lang : 'text'

        return highlighter.codeToHtml(code, {
            lang: validLang,
            theme,
        })
    } catch {
        // Fallback: return escaped HTML
        const escaped = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
        return `<pre><code>${escaped}</code></pre>`
    }
}

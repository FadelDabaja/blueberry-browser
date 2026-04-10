import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from './systemPromptBuilder'
import { MAX_CONTEXT_LENGTH, VERBOSITY_PROMPTS } from '../config/models'

describe('buildSystemPrompt', () => {
  it('returns a string containing agent intro text', () => {
    const prompt = buildSystemPrompt(null, null)
    expect(prompt).toContain('browser agent')
    expect(prompt).toContain('Blueberry Browser')
  })

  it('includes URL when provided', () => {
    const prompt = buildSystemPrompt('https://example.com', null)
    expect(prompt).toContain('Current page URL: https://example.com')
  })

  it('omits URL section when null', () => {
    const prompt = buildSystemPrompt(null, null)
    expect(prompt).not.toContain('Current page URL:')
  })

  it('includes full page text when <= MAX_CONTEXT_LENGTH', () => {
    const pageText = 'Hello world content'
    const prompt = buildSystemPrompt(null, pageText)
    expect(prompt).toContain('Page content (text):')
    expect(prompt).toContain(pageText)
    expect(prompt).not.toContain(pageText + '...')
  })

  it('truncates page text when > MAX_CONTEXT_LENGTH', () => {
    const pageText = 'x'.repeat(MAX_CONTEXT_LENGTH + 500)
    const prompt = buildSystemPrompt(null, pageText)
    expect(prompt).toContain('Page content (text):')
    expect(prompt).toContain('x'.repeat(MAX_CONTEXT_LENGTH) + '...')
    expect(prompt).not.toContain('x'.repeat(MAX_CONTEXT_LENGTH + 1))
  })

  it('omits page text section when null', () => {
    const prompt = buildSystemPrompt(null, null)
    expect(prompt).not.toContain('Page content (text):')
  })

  it('appends verbosity prompt for "concise"', () => {
    const prompt = buildSystemPrompt(null, null, 'concise')
    expect(prompt).toContain(VERBOSITY_PROMPTS.concise)
  })

  it('appends verbosity prompt for "detailed"', () => {
    const prompt = buildSystemPrompt(null, null, 'detailed')
    expect(prompt).toContain(VERBOSITY_PROMPTS.detailed)
  })

  it('does not append verbosity for "normal"', () => {
    const prompt = buildSystemPrompt(null, null, 'normal')
    // normal prompt is empty string, so no extra section
    expect(prompt).not.toContain('Response Style')
  })

  it('includes diagnostics summary when provided', () => {
    const prompt = buildSystemPrompt(null, null, 'normal', '3 JS errors, 1 network failure')
    expect(prompt).toContain('## Active Diagnostics')
    expect(prompt).toContain('3 JS errors, 1 network failure')
  })

  it('omits diagnostics section when not provided', () => {
    const prompt = buildSystemPrompt(null, null)
    expect(prompt).not.toContain('Active Diagnostics')
  })
})

import { describe, it, expect, vi } from 'vitest'
import {
  getAgentTypeValues,
  getAgentTypeDescription,
  isRecursiveAgent,
  resolveTools,
  AGENT_REGISTRY,
  AGENT_TYPE_NAMES,
} from './agents'

describe('getAgentTypeValues', () => {
  it('returns a non-empty tuple', () => {
    const values = getAgentTypeValues()
    expect(values.length).toBeGreaterThan(0)
  })

  it('first element is a string', () => {
    const values = getAgentTypeValues()
    expect(typeof values[0]).toBe('string')
  })

  it('matches AGENT_TYPE_NAMES', () => {
    const values = getAgentTypeValues()
    expect(values).toEqual(AGENT_TYPE_NAMES)
  })
})

describe('getAgentTypeDescription', () => {
  it('returns a string containing agent names', () => {
    const desc = getAgentTypeDescription()
    expect(typeof desc).toBe('string')
    for (const name of AGENT_TYPE_NAMES) {
      expect(desc).toContain(`'${name}'`)
    }
  })

  it('contains agent descriptions', () => {
    const desc = getAgentTypeDescription()
    expect(desc).toContain(AGENT_REGISTRY.audit.description)
  })
})

describe('isRecursiveAgent', () => {
  it('returns true for crawler (recursive agent)', () => {
    expect(isRecursiveAgent('crawler')).toBe(true)
  })

  it('returns false for audit (non-recursive agent)', () => {
    expect(isRecursiveAgent('audit')).toBe(false)
  })

  it('returns false for unknown agent', () => {
    expect(isRecursiveAgent('nonexistent_agent')).toBe(false)
  })
})

describe('resolveTools', () => {
  const mockTools = {
    audit: { run_accessibility_audit: { execute: vi.fn() } },
    navigation: { navigate_to_url: { execute: vi.fn() } },
    interaction: { click_element: { execute: vi.fn() } },
    diagnostic: { get_console_logs: { execute: vi.fn() } },
  }

  it('resolves tools by category:name spec', () => {
    const resolved = resolveTools(
      ['audit:run_accessibility_audit', 'navigation:navigate_to_url'],
      mockTools as any,
    )
    expect(Object.keys(resolved)).toEqual(['run_accessibility_audit', 'navigate_to_url'])
    expect(resolved.run_accessibility_audit).toBe(mockTools.audit.run_accessibility_audit)
  })

  it('returns empty for missing tool and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const resolved = resolveTools(['audit:nonexistent_tool'], mockTools as any)
    expect(Object.keys(resolved)).toHaveLength(0)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent_tool'))
    warnSpy.mockRestore()
  })

  it('returns empty for missing category and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const resolved = resolveTools(['unknown:some_tool'], mockTools as any)
    expect(Object.keys(resolved)).toHaveLength(0)
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('handles empty toolNames array', () => {
    const resolved = resolveTools([], mockTools as any)
    expect(Object.keys(resolved)).toHaveLength(0)
  })
})

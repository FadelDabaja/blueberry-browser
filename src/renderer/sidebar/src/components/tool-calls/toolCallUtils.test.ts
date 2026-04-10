import { describe, it, expect } from 'vitest'
import { truncateOutput, formatArgs, buildParallelTasks, groupExecutions } from './toolCallUtils'
import type { ToolExecution } from '../../types/audit'

describe('truncateOutput', () => {
  it('returns empty string for falsy values', () => {
    expect(truncateOutput(null)).toBe('')
    expect(truncateOutput(undefined)).toBe('')
    expect(truncateOutput('')).toBe('')
    expect(truncateOutput(0)).toBe('')
  })

  it('returns short string as-is', () => {
    expect(truncateOutput('hello')).toBe('hello')
  })

  it('slices long string to 200 chars', () => {
    const long = 'a'.repeat(300)
    expect(truncateOutput(long)).toBe('a'.repeat(200))
  })

  it('JSON stringifies objects', () => {
    const obj = { key: 'value' }
    expect(truncateOutput(obj)).toContain('"key"')
  })

  it('truncates long JSON with ellipsis', () => {
    const obj = { data: 'x'.repeat(300) }
    const result = truncateOutput(obj)
    expect(result.length).toBeLessThanOrEqual(203) // 200 + '...'
    expect(result.endsWith('...')).toBe(true)
  })

  it('handles non-serializable with String()', () => {
    const sym = Symbol('test')
    const result = truncateOutput(sym)
    expect(result).toContain('Symbol')
  })
})

describe('formatArgs', () => {
  it('returns empty string for empty object', () => {
    expect(formatArgs({})).toBe('')
  })

  it('formats simple key-value pairs', () => {
    const result = formatArgs({ url: 'https://example.com' })
    expect(result).toBe('url: https://example.com')
  })

  it('formats multiple entries with newlines', () => {
    const result = formatArgs({ a: 'one', b: 'two' })
    expect(result).toBe('a: one\nb: two')
  })

  it('truncates long values at 60 chars + "..."', () => {
    const long = 'x'.repeat(100)
    const result = formatArgs({ key: long })
    expect(result).toBe(`key: ${'x'.repeat(60)}...`)
  })

  it('JSON stringifies non-string values', () => {
    const result = formatArgs({ count: 42 as any })
    expect(result).toBe('count: 42')
  })
})

describe('buildParallelTasks', () => {
  const makeExec = (args: Record<string, unknown>, output?: unknown, status: ToolExecution['status'] = 'complete'): ToolExecution => ({
    toolCallId: 'tc-1',
    toolName: 'run_parallel_tasks',
    args,
    status,
    output,
    startedAt: Date.now(),
  })

  it('maps task definitions with success results', () => {
    const exec = makeExec(
      { tasks: [{ id: 't1', task: 'Audit page', agentType: 'audit', url: 'https://a.com' }] },
      { results: [{ id: 't1', status: 'success', summary: 'Done' }] },
    )
    const { tasks, concurrency } = buildParallelTasks(exec)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].status).toBe('complete')
    expect(tasks[0].summary).toBe('Done')
    expect(concurrency).toBe(3)
  })

  it('maps error results', () => {
    const exec = makeExec(
      { tasks: [{ id: 't1', task: 'Test', agentType: 'audit', url: 'https://a.com' }] },
      { results: [{ id: 't1', status: 'error', error: 'boom' }] },
    )
    const { tasks } = buildParallelTasks(exec)
    expect(tasks[0].status).toBe('error')
    expect(tasks[0].error).toBe('boom')
  })

  it('shows running when no result and execution is running', () => {
    const exec = makeExec(
      { tasks: [{ id: 't1', task: 'Test', agentType: 'audit', url: 'https://a.com' }] },
      undefined,
      'running',
    )
    const { tasks } = buildParallelTasks(exec)
    expect(tasks[0].status).toBe('running')
  })

  it('parses string output (JSON) for results', () => {
    const exec = makeExec(
      { tasks: [{ id: 't1', task: 'Test', agentType: 'audit', url: 'https://a.com' }] },
      JSON.stringify({ results: [{ id: 't1', status: 'success', summary: 'OK' }] }),
    )
    const { tasks } = buildParallelTasks(exec)
    expect(tasks[0].status).toBe('complete')
    expect(tasks[0].summary).toBe('OK')
  })

  it('uses custom concurrency from args', () => {
    const exec = makeExec({ tasks: [], concurrency: 5 }, undefined)
    const { concurrency } = buildParallelTasks(exec)
    expect(concurrency).toBe(5)
  })
})

describe('groupExecutions', () => {
  const now = Date.now()

  const makeTool = (name: string, id: string, startedAt = now): ToolExecution => ({
    toolCallId: id,
    toolName: name,
    args: {},
    status: 'complete',
    startedAt,
    durationMs: 100,
  })

  it('groups regular tools as type "tool"', () => {
    const execs = [makeTool('click_element', 'tc-1')]
    const groups = groupExecutions(execs)
    expect(groups).toHaveLength(1)
    expect(groups[0].type).toBe('tool')
  })

  it('groups run_specialized_task as type "subagent" and absorbs subsequent sub- prefixed tools', () => {
    // Subagent is complete with a 50ms duration — nested tools within window, after outside
    const subagent = makeTool('run_specialized_task', 'tc-1', now)
    subagent.status = 'complete'
    subagent.durationMs = 50
    const nested1 = makeTool('take_screenshot', 'sub-1', now + 10)
    const nested2 = makeTool('check_seo', 'sub-2', now + 20)
    const after = makeTool('click_element', 'tc-2', now + 200)

    const groups = groupExecutions([subagent, nested1, nested2, after])
    expect(groups).toHaveLength(2)
    expect(groups[0].type).toBe('subagent')
    expect(groups[0].nestedTools).toHaveLength(2)
    expect(groups[1].type).toBe('tool')
  })

  it('groups run_parallel_tasks as type "parallel"', () => {
    const parallel = makeTool('run_parallel_tasks', 'tc-1', now)
    parallel.status = 'running'
    const nested = makeTool('check_seo', 'sub-1', now + 10)

    const groups = groupExecutions([parallel, nested])
    expect(groups).toHaveLength(1)
    expect(groups[0].type).toBe('parallel')
    expect(groups[0].nestedTools).toHaveLength(1)
  })

  it('does not duplicate consumed nested tools at top level', () => {
    const subagent = makeTool('run_specialized_task', 'tc-1', now)
    subagent.status = 'running'
    const nested = makeTool('take_screenshot', 'sub-1', now + 10)

    const groups = groupExecutions([subagent, nested])
    // nested is consumed by subagent, should not appear separately
    expect(groups).toHaveLength(1)
    expect(groups[0].nestedTools).toContain(nested)
  })

  it('handles empty executions', () => {
    expect(groupExecutions([])).toEqual([])
  })
})

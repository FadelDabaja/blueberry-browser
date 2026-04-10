import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processFullStream } from './streamProcessor'
import type { CoreMessage } from 'ai'

/** Create an async iterable from an array of chunks */
function asyncChunks(chunks: any[]): AsyncIterable<any> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0
      return {
        async next() {
          if (i < chunks.length) return { value: chunks[i++], done: false }
          return { value: undefined, done: true }
        },
      }
    },
  }
}

describe('processFullStream', () => {
  let broadcast: ReturnType<typeof vi.fn>
  let messages: CoreMessage[]
  let sendMessagesToRenderer: ReturnType<typeof vi.fn>

  beforeEach(() => {
    broadcast = vi.fn()
    messages = [{ role: 'assistant', content: '' }]
    sendMessagesToRenderer = vi.fn()
    vi.useFakeTimers()
  })

  const run = async (chunks: any[]) => {
    const promise = processFullStream(
      asyncChunks(chunks),
      'msg-1',
      broadcast,
      messages,
      0,
      sendMessagesToRenderer,
    )
    // Advance timers to flush any throttled text
    vi.advanceTimersByTime(200)
    await promise
  }

  it('text-delta chunks accumulate into messages array', async () => {
    await run([
      { type: 'text-delta', text: 'Hello ' },
      { type: 'text-delta', text: 'world' },
    ])

    expect(messages[0].content).toBe('Hello world')
  })

  it('tool-call chunk broadcasts tool-call-started', async () => {
    await run([
      { type: 'tool-call', toolName: 'check_seo', toolCallId: 'tc-1', input: { url: 'https://example.com' } },
    ])

    const startedCall = broadcast.mock.calls.find(c => c[0] === 'tool-call-started')
    expect(startedCall).toBeDefined()
    expect(startedCall![1].toolName).toBe('check_seo')
    expect(startedCall![1].toolCallId).toBe('tc-1')
  })

  it('tool-result chunk broadcasts tool-call-completed', async () => {
    await run([
      { type: 'tool-call', toolName: 'check_seo', toolCallId: 'tc-1', input: {} },
      { type: 'tool-result', toolName: 'check_seo', toolCallId: 'tc-1', output: { title: { isGood: true } } },
    ])

    const completedCall = broadcast.mock.calls.find(c => c[0] === 'tool-call-completed')
    expect(completedCall).toBeDefined()
    expect(completedCall![1].toolName).toBe('check_seo')
  })

  it('error chunk appends error to accumulated text', async () => {
    await run([
      { type: 'text-delta', text: 'Some text' },
      { type: 'error', error: { message: 'Something went wrong' } },
    ])

    expect(messages[0].content).toContain('Error: Something went wrong')
  })

  it('final broadcast has isComplete: true', async () => {
    await run([{ type: 'text-delta', text: 'Done' }])

    const finalCall = broadcast.mock.calls.filter(c => c[0] === 'chat-response')
    const last = finalCall[finalCall.length - 1]
    expect(last[1].isComplete).toBe(true)
  })

  it('sends audit report when tool results present', async () => {
    await run([
      { type: 'tool-call', toolName: 'run_accessibility_audit', toolCallId: 'tc-1', input: {} },
      {
        type: 'tool-result',
        toolName: 'run_accessibility_audit',
        toolCallId: 'tc-1',
        output: {
          violations: [{ impact: 'serious', description: 'Missing alt', help: 'img-alt', nodes: [{ target: ['img'], html: '<img>' }] }],
          totalViolations: 1,
          passes: 10,
        },
      },
    ])

    const reportCall = broadcast.mock.calls.find(c => c[0] === 'audit-report-data')
    expect(reportCall).toBeDefined()
  })

  it('no audit report when no audit tools used', async () => {
    await run([{ type: 'text-delta', text: 'Just text' }])

    const reportCall = broadcast.mock.calls.find(c => c[0] === 'audit-report-data')
    expect(reportCall).toBeUndefined()
  })
})

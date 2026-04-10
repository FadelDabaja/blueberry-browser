import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { TokenUsageBar } from './TokenUsageBar'

afterEach(cleanup)

describe('TokenUsageBar', () => {
  it('returns null when no tokenUsage and totalTokensUsed is 0', () => {
    const { container } = render(
      <TokenUsageBar tokenUsage={null} totalTokensUsed={0} contextLimit={null} modelName={null} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows progress bar with correct aria-valuenow percentage', () => {
    const { container } = render(
      <TokenUsageBar
        tokenUsage={{ inputTokens: 500, outputTokens: 300, totalTokens: 800 }}
        totalTokensUsed={5000}
        contextLimit={10000}
        modelName="gpt-4o"
      />,
    )
    const progressbar = within(container).getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '50')
  })

  it('shows model name when provided', () => {
    const { container } = render(
      <TokenUsageBar
        tokenUsage={{ inputTokens: 100, outputTokens: 50, totalTokens: 150 }}
        totalTokensUsed={1000}
        contextLimit={10000}
        modelName="claude-sonnet-4"
      />,
    )
    expect(within(container).getByText('claude-sonnet-4')).toBeInTheDocument()
  })

  it('shows in/out token counts from tokenUsage', () => {
    const { container } = render(
      <TokenUsageBar
        tokenUsage={{ inputTokens: 2500, outputTokens: 1200, totalTokens: 3700 }}
        totalTokensUsed={3700}
        contextLimit={200000}
        modelName={null}
      />,
    )
    expect(within(container).getByText(/2\.5k in/)).toBeInTheDocument()
    expect(within(container).getByText(/1\.2k out/)).toBeInTheDocument()
  })

  it('shows total when totalTokensUsed > 0', () => {
    const { container } = render(
      <TokenUsageBar
        tokenUsage={null}
        totalTokensUsed={7500}
        contextLimit={10000}
        modelName={null}
      />,
    )
    expect(within(container).getByText(/7\.5k total/)).toBeInTheDocument()
  })

  it('shows remaining tokens', () => {
    const { container } = render(
      <TokenUsageBar
        tokenUsage={{ inputTokens: 100, outputTokens: 50, totalTokens: 150 }}
        totalTokensUsed={2000}
        contextLimit={10000}
        modelName={null}
      />,
    )
    expect(within(container).getByText(/8\.0k left/)).toBeInTheDocument()
  })

  it('high usage (>75%) applies amber styling', () => {
    const { container } = render(
      <TokenUsageBar
        tokenUsage={{ inputTokens: 100, outputTokens: 50, totalTokens: 150 }}
        totalTokensUsed={8000}
        contextLimit={10000}
        modelName={null}
      />,
    )
    const progressbar = within(container).getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '80')
    const innerBar = progressbar.firstChild as HTMLElement
    expect(innerBar.className).toContain('amber')
  })
})

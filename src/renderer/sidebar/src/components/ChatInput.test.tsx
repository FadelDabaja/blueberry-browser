import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from './ChatInput'

afterEach(cleanup)

describe('ChatInput', () => {
  const defaults = {
    onSend: vi.fn(),
    onCancel: vi.fn(),
    disabled: false,
    isLoading: false,
    verbosity: 'normal' as const,
    onVerbosityChange: vi.fn(),
  }

  it('renders textarea and send button', () => {
    const { container } = render(<ChatInput {...defaults} />)
    expect(within(container).getByLabelText('Type your message')).toBeInTheDocument()
    expect(within(container).getByLabelText('Send message')).toBeInTheDocument()
  })

  it('typing updates textarea value', async () => {
    const { container } = render(<ChatInput {...defaults} />)
    const textarea = within(container).getByLabelText('Type your message')
    await userEvent.type(textarea, 'Hello')
    expect(textarea).toHaveValue('Hello')
  })

  it('Enter key calls onSend with text and clears input', () => {
    const onSend = vi.fn()
    const { container } = render(<ChatInput {...defaults} onSend={onSend} />)
    const textarea = within(container).getByLabelText('Type your message')
    fireEvent.change(textarea, { target: { value: 'test message' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledWith('test message')
    expect(textarea).toHaveValue('')
  })

  it('Shift+Enter does NOT send', () => {
    const onSend = vi.fn()
    const { container } = render(<ChatInput {...defaults} onSend={onSend} />)
    const textarea = within(container).getByLabelText('Type your message')
    fireEvent.change(textarea, { target: { value: 'test' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('send button disabled when input is empty', () => {
    const { container } = render(<ChatInput {...defaults} />)
    expect(within(container).getByLabelText('Send message')).toBeDisabled()
  })

  it('send button disabled when disabled prop is true', () => {
    const { container } = render(<ChatInput {...defaults} disabled={true} />)
    const textarea = within(container).getByLabelText('Type your message')
    fireEvent.change(textarea, { target: { value: 'text' } })
    expect(within(container).getByLabelText('Send message')).toBeDisabled()
  })

  it('Escape key calls onCancel when isLoading', () => {
    const onCancel = vi.fn()
    const { container } = render(<ChatInput {...defaults} isLoading={true} onCancel={onCancel} />)
    const textarea = within(container).getByLabelText('Type your message')
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })

  it('shows stop button when isLoading', () => {
    const { container } = render(<ChatInput {...defaults} isLoading={true} />)
    expect(within(container).getByLabelText('Stop generation')).toBeInTheDocument()
  })

  it('verbosity buttons render and click fires onVerbosityChange', () => {
    const onVerbosityChange = vi.fn()
    const { container } = render(<ChatInput {...defaults} onVerbosityChange={onVerbosityChange} />)
    const radios = within(container).getAllByRole('radio')
    expect(radios).toHaveLength(3)

    fireEvent.click(within(container).getByText('Detailed'))
    expect(onVerbosityChange).toHaveBeenCalledWith('detailed')
  })
})

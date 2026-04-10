import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, within, fireEvent } from '@testing-library/react'
import { SidebarTabBar } from './SidebarTabBar'

afterEach(cleanup)

describe('SidebarTabBar', () => {
  it('renders 4 tabs (Chat, Tasks, Reports, Settings)', () => {
    const { container } = render(<SidebarTabBar active="chat" onChange={vi.fn()} />)
    const tabs = within(container).getAllByRole('tab')
    expect(tabs).toHaveLength(4)
    expect(within(container).getByText('Chat')).toBeInTheDocument()
    expect(within(container).getByText('Tasks')).toBeInTheDocument()
    expect(within(container).getByText('Reports')).toBeInTheDocument()
    expect(within(container).getByText('Settings')).toBeInTheDocument()
  })

  it('active tab has aria-selected="true"', () => {
    const { container } = render(<SidebarTabBar active="tasks" onChange={vi.fn()} />)
    const tabs = within(container).getAllByRole('tab')
    const tasksTab = tabs.find(t => t.textContent?.includes('Tasks'))!
    expect(tasksTab).toHaveAttribute('aria-selected', 'true')
  })

  it('click fires onChange with correct panel id', () => {
    const onChange = vi.fn()
    const { container } = render(<SidebarTabBar active="chat" onChange={onChange} />)
    const settingsTab = within(container).getByText('Settings').closest('button')!
    fireEvent.click(settingsTab)
    expect(onChange).toHaveBeenCalledWith('settings')
  })

  it('ArrowRight moves to next tab (circular)', () => {
    const onChange = vi.fn()
    const { container } = render(<SidebarTabBar active="settings" onChange={onChange} />)
    const tabs = within(container).getAllByRole('tab')
    const settingsTab = tabs.find(t => t.textContent?.includes('Settings'))!
    fireEvent.keyDown(settingsTab, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('chat')
  })

  it('ArrowLeft moves to previous tab (circular)', () => {
    const onChange = vi.fn()
    const { container } = render(<SidebarTabBar active="chat" onChange={onChange} />)
    const tabs = within(container).getAllByRole('tab')
    const chatTab = tabs.find(t => t.textContent?.includes('Chat'))!
    fireEvent.keyDown(chatTab, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith('settings')
  })

  it('Home key selects first tab, End key selects last tab', () => {
    const onChange = vi.fn()
    const { container } = render(<SidebarTabBar active="tasks" onChange={onChange} />)
    const tabs = within(container).getAllByRole('tab')
    const tasksTab = tabs.find(t => t.textContent?.includes('Tasks'))!

    fireEvent.keyDown(tasksTab, { key: 'Home' })
    expect(onChange).toHaveBeenCalledWith('chat')

    fireEvent.keyDown(tasksTab, { key: 'End' })
    expect(onChange).toHaveBeenCalledWith('settings')
  })
})

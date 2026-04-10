# Blueberry Browser

An AI-powered browser with built-in agents for web auditing, automation, and intelligent browsing.

https://github.com/user-attachments/assets/bbf939e2-d87c-4c77-ab7d-828259f6d28d

---

## Overview

Blueberry Browser is an Electron-based browser with a deeply integrated AI sidebar. It can browse the web, analyze pages, run accessibility/SEO/performance audits, automate interactions, and orchestrate multi-step tasks — all through natural language.

## Features

- **AI Chat Sidebar** — conversational interface powered by OpenAI or Anthropic models with streaming, tool calls, and reasoning output
- **Multi-Agent Architecture** — main agent delegates to specialized subagents (audit, task manager, researcher) with parallel orchestration
- **Web Auditing Suite** — 14 tools covering accessibility (axe-core WCAG 2.1), contrast, SEO, DOM quality, forms, performance metrics, and page structure
- **Interactive Overlays** — highlight audit issues directly on the page with click-to-inspect, filtering by category/severity, and scroll-to-element
- **Page Automation** — click elements, fill inputs, scroll, wait for dynamic content, take screenshots
- **Multi-Tab Browsing** — tabbed interface with new-window interception, per-tab navigation history, and a dedicated `blueberry://chat` full-page chat mode
- **Task & Report Management** — persistent storage for audit reports and task tracking with group support
- **Diagnostics** — console log capture, network error monitoring, and performance timing
- **Token Usage Tracking** — real-time context window visualization with automatic compaction at 70% capacity
- **Verbosity Control** — concise/normal/detailed response modes
- **Dark Mode** — system-aware theme that syncs across sidebar, topbar, and chat page
- **Resizable Sidebar** — drag-to-resize with smooth animation

## Architecture

```
src/
  main/                    # Electron main process
    core/                  #   Window, Tab, EventManager, DiagnosticsService
    llm/                   #   LLMClient, StreamProcessor, SystemPromptBuilder
    agents/                #   SubagentFactory, ParallelOrchestrator, FindingsStore
    tools/                 #   Navigation, Interaction, Audit, Export, Diagnostic, Planner tools
    config/                #   Constants, model registry, agent configs
    ui/                    #   SideBar, TopBar
    storage/               #   HistoryManager, SettingsManager
    integrations/          #   External service providers
  preload/                 # Context-isolated IPC bridges (sidebar, topbar, chat)
  renderer/
    sidebar/               # React sidebar app (chat, history, settings, reports, tasks)
    topbar/                # React topbar (tabs, address bar, window controls)
    chat/                  # Full-page chat mode
    common/                # Shared components, hooks, styles
```

## Setup

### Prerequisites

- Node.js 18+
- pnpm

### Install

```bash
pnpm install
```

### Configure

Create a `.env` file in the project root:

```env
# Required: at least one API key
OPENAI_API_KEY=sk-...
# Or
ANTHROPIC_API_KEY=sk-ant-...

# Optional
LLM_PROVIDER=openai        # or "anthropic"
LLM_MODEL=gpt-4.1-mini     # any supported model
```

### Development

```bash
pnpm dev
```

### Build

```bash
# Windows
pnpm build:win

# macOS
pnpm build:mac

# Linux
pnpm build:linux
```

## Supported Models

| Provider | Models |
|----------|--------|
| OpenAI | gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, gpt-4o, gpt-4o-mini, gpt-5.4, gpt-5.4-mini, gpt-5.4-nano, o1, o3, o4-mini |
| Anthropic | claude-opus-4-6, claude-sonnet-4-5, claude-sonnet-4, claude-haiku-4-5 |

Model can be changed at runtime via the Settings panel.

## License

MIT

import React, { useState, useEffect, useRef } from 'react'
import { Check, Eye, EyeOff, Sun, Moon, Monitor, AlertCircle, Link2 } from 'lucide-react'
import { cn } from '@common/lib/utils'
import { useDarkMode } from '@common/hooks/useDarkMode'
import { HistorySection } from './HistorySection'

interface AppSettings {
    provider: string
    model: string
    apiKey: string
    theme: 'light' | 'dark' | 'system'
    integrationProvider: 'local' | 'notion' | 'linear' | 'jira'
    integrationApiKey: string
}

const INTEGRATION_PROVIDERS = [
    { id: 'local' as const, label: 'Local', description: 'Tasks stored on this device' },
    { id: 'notion' as const, label: 'Notion', description: 'Coming soon' },
    { id: 'linear' as const, label: 'Linear', description: 'Coming soon' },
    { id: 'jira' as const, label: 'Jira', description: 'Coming soon' },
]

const INPUT_CLASS = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-muted/30 border border-border text-foreground",
    "outline-none focus:border-blueberry/40 focus:ring-2 focus:ring-blueberry/20",
    "placeholder:text-muted-foreground transition-colors"
)

export const SettingsPanel: React.FC = () => {
    const [settings, setSettings] = useState<AppSettings>({
        provider: 'openai',
        model: '',
        apiKey: '',
        theme: 'system',
        integrationProvider: 'local',
        integrationApiKey: '',
    })
    const [showKey, setShowKey] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { isDarkMode, toggleDarkMode } = useDarkMode()
    const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        loadSettings()
        return () => {
            if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current)
        }
    }, [])

    const loadSettings = async () => {
        try {
            const data = await window.sidebarAPI.getSettings()
            setSettings(data)
        } catch (error) {
            console.error('Failed to load settings:', error)
        }
    }

    const handleSave = async () => {
        try {
            setError(null)
            await window.sidebarAPI.updateSettings(settings)
            setSaved(true)
            if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current)
            savedTimeoutRef.current = setTimeout(() => setSaved(false), 2000)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to save settings'
            setError(message)
            console.error('Failed to save settings:', err)
        }
    }

    const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
        setSettings(prev => ({ ...prev, theme }))

        if (theme === 'system') {
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            if (systemDark !== isDarkMode) toggleDarkMode()
        } else if (theme === 'dark' && !isDarkMode) {
            toggleDarkMode()
        } else if (theme === 'light' && isDarkMode) {
            toggleDarkMode()
        }

        // Persist theme change immediately
        window.sidebarAPI.updateSettings({ theme }).catch(() => {})
    }

    const isExternalProvider = settings.integrationProvider !== 'local'

    return (
        <div className="flex flex-col h-full overflow-y-auto animate-panel-slide">
            <div className="p-4 space-y-4">
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-3 rounded" role="alert">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="size-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                            <div className="flex-1 text-sm text-red-800 dark:text-red-200">{error}</div>
                            <button onClick={() => setError(null)} className="text-red-600 dark:text-red-400 hover:text-red-800" aria-label="Dismiss error">×</button>
                        </div>
                    </div>
                )}
                {/* AI Model Section */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">AI Model</h3>

                    {/* Provider */}
                    <div>
                        <label htmlFor="provider-select" className="text-2xs text-muted-foreground block mb-1">Provider</label>
                        <select
                            id="provider-select"
                            value={settings.provider}
                            onChange={e => setSettings(prev => ({ ...prev, provider: e.target.value }))}
                            className={INPUT_CLASS}
                        >
                            <option value="openai">OpenAI</option>
                            <option value="anthropic">Anthropic</option>
                        </select>
                    </div>

                    {/* Model */}
                    <div>
                        <label htmlFor="model-input" className="text-2xs text-muted-foreground block mb-1">Model name</label>
                        <input
                            id="model-input"
                            type="text"
                            value={settings.model}
                            onChange={e => setSettings(prev => ({ ...prev, model: e.target.value }))}
                            placeholder={settings.provider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o-mini'}
                            className={INPUT_CLASS}
                        />
                    </div>

                    {/* API Key */}
                    <div>
                        <label htmlFor="api-key-input" className="text-2xs text-muted-foreground block mb-1">API Key</label>
                        <div className="relative">
                            <input
                                id="api-key-input"
                                type={showKey ? 'text' : 'password'}
                                value={settings.apiKey}
                                onChange={e => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                                placeholder="sk-..."
                                className={cn(INPUT_CLASS, "pr-10")}
                            />
                            <button
                                onClick={() => setShowKey(!showKey)}
                                aria-label={showKey ? "Hide API key" : "Show API key"}
                                title={showKey ? "Hide API key" : "Show API key"}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Save */}
                    <button
                        onClick={handleSave}
                        className={cn(
                            "w-full py-2 rounded-lg text-sm font-medium transition-all duration-200",
                            saved
                                ? "bg-success/10 text-success-foreground border border-success/20"
                                : "bg-blueberry text-white hover:opacity-90 active:scale-[0.98]"
                        )}
                    >
                        {saved ? (
                            <span className="inline-flex items-center gap-1.5">
                                <Check className="size-4" /> Saved
                            </span>
                        ) : (
                            'Save'
                        )}
                    </button>
                </div>

                {/* Appearance Section */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Appearance</h3>
                    <div className="flex rounded-lg border border-border overflow-hidden">
                        {([
                            { id: 'light' as const, label: 'Light', icon: Sun },
                            { id: 'dark' as const, label: 'Dark', icon: Moon },
                            { id: 'system' as const, label: 'System', icon: Monitor },
                        ]).map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => handleThemeChange(id)}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors",
                                    settings.theme === id
                                        ? "bg-blueberry/10 text-blueberry font-medium"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                                )}
                            >
                                <Icon className="size-3.5" />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Browsing History Section */}
                <HistorySection />

                {/* Integrations Section */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <Link2 className="size-4 text-blueberry" />
                        <h3 className="text-sm font-semibold text-foreground">Integrations</h3>
                    </div>

                    <div>
                        <label htmlFor="integration-provider" className="text-2xs text-muted-foreground block mb-1">Task Provider</label>
                        <select
                            id="integration-provider"
                            value={settings.integrationProvider}
                            onChange={e => setSettings(prev => ({
                                ...prev,
                                integrationProvider: e.target.value as AppSettings['integrationProvider'],
                            }))}
                            className={INPUT_CLASS}
                        >
                            {INTEGRATION_PROVIDERS.map(p => (
                                <option key={p.id} value={p.id} disabled={p.id !== 'local'}>
                                    {p.label}{p.id !== 'local' ? ' (Coming soon)' : ''}
                                </option>
                            ))}
                        </select>
                        <p className="text-2xs text-muted-foreground mt-1">
                            {INTEGRATION_PROVIDERS.find(p => p.id === settings.integrationProvider)?.description}
                        </p>
                    </div>

                    <div>
                        <label htmlFor="integration-key" className="text-2xs text-muted-foreground block mb-1">API Key</label>
                        <input
                            id="integration-key"
                            type="password"
                            value={settings.integrationApiKey}
                            onChange={e => setSettings(prev => ({ ...prev, integrationApiKey: e.target.value }))}
                            placeholder={isExternalProvider ? 'Enter API key...' : 'Not required for local storage'}
                            disabled={!isExternalProvider}
                            className={cn(
                                INPUT_CLASS,
                                !isExternalProvider && "opacity-50 cursor-not-allowed"
                            )}
                        />
                    </div>
                </div>

                {/* About Section */}
                <div className="rounded-xl border border-border bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-1">About</h3>
                    <p className="text-sm text-muted-foreground">Blueberry Browser</p>
                    <p className="text-2xs text-muted-foreground">v1.0.0</p>
                </div>
            </div>
        </div>
    )
}

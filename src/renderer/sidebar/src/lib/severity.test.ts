import { describe, it, expect } from 'vitest'
import { getSeverityConfig, SEVERITY_CONFIG, SEVERITY_ORDER } from './severity'

describe('getSeverityConfig', () => {
    it('returns correct config for known severity', () => {
        const config = getSeverityConfig('critical')
        expect(config.label).toBe('Critical')
        expect(config.highlight).toBe('#ef4444')
    })

    it('falls back to info config for unknown severity', () => {
        const config = getSeverityConfig('banana')
        expect(config).toBe(SEVERITY_CONFIG.info)
        expect(config.label).toBe('Info')
    })
})

describe('SEVERITY_CONFIG and SEVERITY_ORDER consistency', () => {
    it('every SEVERITY_CONFIG key has a matching SEVERITY_ORDER entry', () => {
        for (const key of Object.keys(SEVERITY_CONFIG)) {
            expect(SEVERITY_ORDER).toHaveProperty(key)
        }
    })

    it('every SEVERITY_ORDER key has a matching SEVERITY_CONFIG entry', () => {
        for (const key of Object.keys(SEVERITY_ORDER)) {
            expect(SEVERITY_CONFIG).toHaveProperty(key)
        }
    })

    it('each config has all required fields', () => {
        const requiredFields = ['color', 'bg', 'border', 'highlight', 'icon', 'label'] as const
        for (const [key, config] of Object.entries(SEVERITY_CONFIG)) {
            for (const field of requiredFields) {
                expect(config, `${key} missing ${field}`).toHaveProperty(field)
                expect(config[field], `${key}.${field} is falsy`).toBeTruthy()
            }
        }
    })
})

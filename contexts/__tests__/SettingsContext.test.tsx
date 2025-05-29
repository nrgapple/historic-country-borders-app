import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { SettingsProvider, useSettings, TextSize, TextCase } from '../SettingsContext'
import ReactGA4 from 'react-ga4'

// Mock ReactGA4
vi.mock('react-ga4', () => ({
  default: {
    event: vi.fn(),
  },
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SettingsProvider>{children}</SettingsProvider>
)

describe('SettingsContext', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Default Settings', () => {
    it('should provide default settings', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })

      expect(result.current.settings).toEqual({
        textSize: 'medium',
        textCase: 'regular',
        countryOpacity: 0.7,
      })
    })

    it('should track default settings usage', () => {
      renderHook(() => useSettings(), { wrapper })

      expect(ReactGA4.event).toHaveBeenCalledWith({
        category: 'Settings',
        action: 'settings_default',
        label: 'defaults_used',
        value: 1,
      })
    })
  })

  describe('Settings Updates', () => {
    it('should update text size setting', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })

      act(() => {
        result.current.updateSettings({ textSize: 'large' })
      })

      expect(result.current.settings.textSize).toBe('large')
      expect(ReactGA4.event).toHaveBeenCalledWith({
        category: 'Settings',
        action: 'setting_changed',
        label: 'textSize_to_large',
        value: 1,
      })
    })

    it('should update text case setting', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })

      act(() => {
        result.current.updateSettings({ textCase: 'upper' })
      })

      expect(result.current.settings.textCase).toBe('upper')
      expect(ReactGA4.event).toHaveBeenCalledWith({
        category: 'Settings',
        action: 'setting_changed',
        label: 'textCase_to_upper',
        value: 1,
      })
    })

    it('should update country opacity setting', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })

      act(() => {
        result.current.updateSettings({ countryOpacity: 0.5 })
      })

      expect(result.current.settings.countryOpacity).toBe(0.5)
      expect(ReactGA4.event).toHaveBeenCalledWith({
        category: 'Settings',
        action: 'setting_changed',
        label: 'countryOpacity_to_0.5',
        value: 1,
      })
    })

    it('should update multiple settings at once', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })

      act(() => {
        result.current.updateSettings({
          textSize: 'small',
          textCase: 'upper',
          countryOpacity: 0.9,
        })
      })

      expect(result.current.settings).toEqual({
        textSize: 'small',
        textCase: 'upper',
        countryOpacity: 0.9,
      })

      // Should track each setting change
      expect(ReactGA4.event).toHaveBeenCalledWith({
        category: 'Settings',
        action: 'setting_changed',
        label: 'textSize_to_small',
        value: 1,
      })
      expect(ReactGA4.event).toHaveBeenCalledWith({
        category: 'Settings',
        action: 'setting_changed',
        label: 'textCase_to_upper',
        value: 1,
      })
      expect(ReactGA4.event).toHaveBeenCalledWith({
        category: 'Settings',
        action: 'setting_changed',
        label: 'countryOpacity_to_0.9',
        value: 1,
      })
    })
  })

  describe('Reset to Defaults', () => {
    it('should reset all settings to defaults', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })

      // First change some settings
      act(() => {
        result.current.updateSettings({
          textSize: 'large',
          textCase: 'upper',
          countryOpacity: 0.3,
        })
      })

      // Then reset
      act(() => {
        result.current.resetToDefaults()
      })

      expect(result.current.settings).toEqual({
        textSize: 'medium',
        textCase: 'regular',
        countryOpacity: 0.7,
      })

      expect(ReactGA4.event).toHaveBeenCalledWith({
        category: 'Settings',
        action: 'settings_reset',
        label: 'to_defaults',
        value: 1,
      })
    })
  })

  describe('LocalStorage Integration', () => {
    it('should save settings to localStorage', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })

      act(() => {
        result.current.updateSettings({ textSize: 'large' })
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'historic-borders-settings',
        JSON.stringify({
          textSize: 'large',
          textCase: 'regular',
          countryOpacity: 0.7,
        })
      )

      expect(ReactGA4.event).toHaveBeenCalledWith({
        category: 'Settings',
        action: 'settings_saved',
        label: 'to_localStorage',
        value: 1,
      })
    })

    it('should load settings from localStorage', () => {
      const savedSettings = {
        textSize: 'small' as TextSize,
        textCase: 'upper' as TextCase,
        countryOpacity: 0.4,
      }

      localStorageMock.setItem(
        'historic-borders-settings',
        JSON.stringify(savedSettings)
      )

      const { result } = renderHook(() => useSettings(), { wrapper })

      expect(result.current.settings).toEqual(savedSettings)
      expect(ReactGA4.event).toHaveBeenCalledWith({
        category: 'Settings',
        action: 'settings_restored',
        label: 'from_localStorage',
        value: 1,
      })
    })

    it('should handle corrupted localStorage data', () => {
      localStorageMock.setItem('historic-borders-settings', 'invalid-json')

      const { result } = renderHook(() => useSettings(), { wrapper })

      // Should fall back to defaults
      expect(result.current.settings).toEqual({
        textSize: 'medium',
        textCase: 'regular',
        countryOpacity: 0.7,
      })

      expect(ReactGA4.event).toHaveBeenCalledWith({
        category: 'Settings',
        action: 'localstorage_read_error',
        label: 'settings',
        value: 1,
      })
    })

    it('should validate and sanitize localStorage data', () => {
      const invalidSettings = {
        textSize: 'invalid-size',
        textCase: 'invalid-case',
        countryOpacity: 5, // out of range
      }

      localStorageMock.setItem(
        'historic-borders-settings',
        JSON.stringify(invalidSettings)
      )

      const { result } = renderHook(() => useSettings(), { wrapper })

      // Should sanitize to valid values
      expect(result.current.settings).toEqual({
        textSize: 'medium',
        textCase: 'regular',
        countryOpacity: 0.7,
      })
    })
  })
}) 
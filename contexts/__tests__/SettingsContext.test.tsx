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
        infoProvider: 'wikipedia',
        aiCompareEnabled: false,
        showLabels: true,
      })
    })

    it('should track default settings usage', () => {
      renderHook(() => useSettings(), { wrapper })

      expect(ReactGA4.event).toHaveBeenCalledWith('settings_restored', {
        source: 'localStorage',
        settings_count: expect.any(Number),
        has_custom_settings: expect.any(Boolean)
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
      expect(ReactGA4.event).toHaveBeenCalledWith('setting_changed', {
        setting_name: 'textSize',
        previous_value: 'medium',
        new_value: 'large',
        setting_type: 'string',
        change_method: 'settings_update'
      })
    })

    it('should update text case setting', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })

      act(() => {
        result.current.updateSettings({ textCase: 'upper' })
      })

      expect(result.current.settings.textCase).toBe('upper')
      expect(ReactGA4.event).toHaveBeenCalledWith('setting_changed', {
        setting_name: 'textCase',
        previous_value: 'regular',
        new_value: 'upper',
        setting_type: 'string',
        change_method: 'settings_update'
      })
    })

    it('should update country opacity setting', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })

      act(() => {
        result.current.updateSettings({ countryOpacity: 0.5 })
      })

      expect(result.current.settings.countryOpacity).toBe(0.5)
      expect(ReactGA4.event).toHaveBeenCalledWith('setting_changed', {
        setting_name: 'countryOpacity',
        previous_value: '0.7',
        new_value: '0.5',
        setting_type: 'number',
        change_method: 'settings_update'
      })
    })

    it('should update show labels setting', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })

      act(() => {
        result.current.updateSettings({ showLabels: false })
      })

      expect(result.current.settings.showLabels).toBe(false)
      expect(ReactGA4.event).toHaveBeenCalledWith('setting_changed', {
        setting_name: 'showLabels',
        previous_value: 'true',
        new_value: 'false',
        setting_type: 'boolean',
        change_method: 'settings_update'
      })
    })

    it('should update multiple settings at once', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })

      act(() => {
        result.current.updateSettings({
          textSize: 'small',
          textCase: 'upper',
          countryOpacity: 0.9,
          infoProvider: 'wikipedia',
        })
      })

      expect(result.current.settings).toEqual({
        textSize: 'small',
        textCase: 'upper',
        countryOpacity: 0.9,
        infoProvider: 'wikipedia',
        aiCompareEnabled: false,
        showLabels: true,
      })

      // Should track each setting change
      expect(ReactGA4.event).toHaveBeenCalledWith('setting_changed', {
        setting_name: 'textSize',
        previous_value: 'medium',
        new_value: 'small',
        setting_type: 'string',
        change_method: 'settings_update'
      })
      expect(ReactGA4.event).toHaveBeenCalledWith('setting_changed', {
        setting_name: 'textCase',
        previous_value: 'regular',
        new_value: 'upper',
        setting_type: 'string',
        change_method: 'settings_update'
      })
      expect(ReactGA4.event).toHaveBeenCalledWith('setting_changed', {
        setting_name: 'countryOpacity',
        previous_value: '0.7',
        new_value: '0.9',
        setting_type: 'number',
        change_method: 'settings_update'
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
        infoProvider: 'wikipedia',
        aiCompareEnabled: false,
        showLabels: true,
      })

      expect(ReactGA4.event).toHaveBeenCalledWith('settings_reset', {
        reset_target: 'defaults',
        previous_customizations: expect.any(Number),
        reset_method: 'manual_reset',
        had_customizations: expect.any(Boolean)
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
          infoProvider: 'wikipedia',
          aiCompareEnabled: false,
          showLabels: true,
        })
      )

      // Should also save to legacy key for backward compatibility
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'historic-borders-info-provider',
        'wikipedia'
      )

      expect(ReactGA4.event).toHaveBeenCalledWith('settings_saved', {
        storage_type: 'localStorage',
        settings_count: expect.any(Number),
        save_duration_ms: expect.any(Number),
        operation: 'settings_save'
      })
    })

    it('should load settings from localStorage', () => {
      const savedSettings = {
        textSize: 'small' as TextSize,
        textCase: 'upper' as TextCase,
        countryOpacity: 0.4,
        infoProvider: 'ai' as const,
        aiCompareEnabled: false,
        showLabels: true,
      }

      localStorageMock.setItem(
        'historic-borders-settings',
        JSON.stringify(savedSettings)
      )

      const { result } = renderHook(() => useSettings(), { wrapper })

      expect(result.current.settings).toEqual(savedSettings)
      expect(ReactGA4.event).toHaveBeenCalledWith('settings_restored', {
        source: 'localStorage',
        settings_count: expect.any(Number),
        has_custom_settings: expect.any(Boolean)
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
        infoProvider: 'wikipedia',
        aiCompareEnabled: false,
        showLabels: true,
      })

      expect(ReactGA4.event).toHaveBeenCalledWith('settings_storage_error', {
        error_type: 'read_error',
        storage_type: 'localStorage',
        operation: 'settings_load',
        error_name: expect.any(String)
      })
    })

    it('should validate and sanitize localStorage data', () => {
      const invalidSettings = {
        textSize: 'invalid-size',
        textCase: 'invalid-case',
        countryOpacity: 5, // out of range
        infoProvider: 'invalid-provider',
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
        infoProvider: 'wikipedia',
        aiCompareEnabled: false,
        showLabels: true,
      })
    })
  })
}) 
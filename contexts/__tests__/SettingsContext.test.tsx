import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  sanitizeSettings,
  SettingsProvider,
  STORAGE_KEY,
  useSettings,
} from '../SettingsContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SettingsProvider>{children}</SettingsProvider>
);

describe('SettingsContext', () => {
  beforeEach(() => localStorage.clear());

  it('provides defaults', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('updates, persists, and resets settings', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.updateSettings({ textSize: 'large' }));
    expect(result.current.settings.textSize).toBe('large');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(
      expect.objectContaining({ textSize: 'large' }),
    );

    act(() => result.current.resetToDefaults());
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('restores sanitized stored values and ignores unknown fields', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        textSize: 'invalid',
        textCase: 'upper',
        countryOpacity: 8,
        borderThickness: 0,
        showLabels: false,
        obsoletePreference: true,
      }),
    );
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings).toEqual({
      textSize: 'medium',
      textCase: 'upper',
      countryOpacity: 0.7,
      borderThickness: 0,
      showLabels: false,
    });
  });

  it('falls back safely when storage is malformed', () => {
    localStorage.setItem(STORAGE_KEY, '{broken');
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('requires a provider', () => {
    expect(() => renderHook(() => useSettings())).toThrow(/SettingsProvider/);
  });
});

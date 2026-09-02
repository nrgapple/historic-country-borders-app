import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider, useSettings } from '../SettingsContext';
import ReactGA4 from 'react-ga4';

vi.mock('react-ga4', () => ({ default: { event: vi.fn() } }));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SettingsProvider>{children}</SettingsProvider>
);

describe('SettingsContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('provides defaults without removed source or comparison preferences', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings).toEqual({
      textSize: 'medium',
      textCase: 'regular',
      countryOpacity: 0.7,
      borderThickness: 2,
      showLabels: true,
    });
  });

  it('updates, persists, and resets settings', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.updateSettings({ textSize: 'large' }));
    expect(result.current.settings.textSize).toBe('large');
    expect(
      JSON.parse(localStorage.getItem('historic-borders-settings')!),
    ).toEqual(expect.objectContaining({ textSize: 'large' }));
    expect(ReactGA4.event).toHaveBeenCalledWith('setting_changed', {
      setting_name: 'textSize',
      previous_value: 'medium',
      new_value: 'large',
      setting_type: 'string',
      change_method: 'settings_update',
    });

    act(() => result.current.resetToDefaults());
    expect(result.current.settings.textSize).toBe('medium');
  });

  it('sanitizes stored values and ignores unknown fields', () => {
    localStorage.setItem(
      'historic-borders-settings',
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
    localStorage.setItem('historic-borders-settings', '{broken');
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings.textSize).toBe('medium');
    expect(ReactGA4.event).toHaveBeenCalledWith(
      'settings_storage_error',
      expect.objectContaining({ error_type: 'read_error' }),
    );
  });
});

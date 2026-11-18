import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { trackEvent } from '../lib/analytics';

export type TextSize = 'small' | 'medium' | 'large';
export type TextCase = 'regular' | 'upper';

export interface Settings {
  textSize: TextSize;
  textCase: TextCase;
  /** Fill opacity for countries and districts, 0.1–1. */
  countryOpacity: number;
  /** Border width preference, 0–4. */
  borderThickness: number;
  showLabels: boolean;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (changes: Partial<Settings>) => void;
  resetToDefaults: () => void;
}

export const STORAGE_KEY = 'historic-borders-settings';

export const DEFAULT_SETTINGS: Settings = {
  textSize: 'medium',
  textCase: 'regular',
  countryOpacity: 0.7,
  borderThickness: 2,
  showLabels: true,
};

const inRange = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && value >= min && value <= max;

/** Accepts only known, in-range values; anything else falls back to defaults. */
export const sanitizeSettings = (value: unknown): Settings => {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<
    string,
    unknown
  >;
  return {
    textSize: ['small', 'medium', 'large'].includes(raw.textSize as string)
      ? (raw.textSize as TextSize)
      : DEFAULT_SETTINGS.textSize,
    textCase: ['regular', 'upper'].includes(raw.textCase as string)
      ? (raw.textCase as TextCase)
      : DEFAULT_SETTINGS.textCase,
    countryOpacity: inRange(raw.countryOpacity, 0.1, 1)
      ? (raw.countryOpacity as number)
      : DEFAULT_SETTINGS.countryOpacity,
    borderThickness: inRange(raw.borderThickness, 0, 4)
      ? (raw.borderThickness as number)
      : DEFAULT_SETTINGS.borderThickness,
    showLabels:
      typeof raw.showLabels === 'boolean'
        ? raw.showLabels
        : DEFAULT_SETTINGS.showLabels,
  };
};

const readStoredSettings = (): Settings => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? sanitizeSettings(JSON.parse(stored)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const storeSettings = (settings: Settings) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing or full storage: settings still apply for this visit.
  }
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  // Start from defaults so server and first client render match, then restore.
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(readStoredSettings());
  }, []);

  const updateSettings = useCallback((changes: Partial<Settings>) => {
    setSettings((current) => {
      const next = sanitizeSettings({ ...current, ...changes });
      storeSettings(next);
      return next;
    });
    Object.entries(changes).forEach(([name, value]) =>
      trackEvent('setting_changed', { name, value: String(value) }),
    );
  }, []);

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    storeSettings(DEFAULT_SETTINGS);
    trackEvent('settings_reset');
  }, []);

  const value = useMemo(
    () => ({ settings, updateSettings, resetToDefaults }),
    [settings, updateSettings, resetToDefaults],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

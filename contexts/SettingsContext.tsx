import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import ReactGA4 from 'react-ga4';

export type TextSize = 'small' | 'medium' | 'large';
export type TextCase = 'regular' | 'upper';

interface Settings {
  textSize: TextSize;
  textCase: TextCase;
  countryOpacity: number;
  borderThickness: number;
  showLabels: boolean;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  resetToDefaults: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

const STORAGE_KEY = 'historic-borders-settings';

const DEFAULT_SETTINGS: Settings = {
  textSize: 'medium',
  textCase: 'regular',
  countryOpacity: 0.7,
  borderThickness: 2,
  showLabels: true,
};

const getInitialSettings = (): Settings => {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(stored);
    return {
      textSize: ['small', 'medium', 'large'].includes(parsed.textSize)
        ? parsed.textSize
        : DEFAULT_SETTINGS.textSize,
      textCase: ['regular', 'upper'].includes(parsed.textCase)
        ? parsed.textCase
        : DEFAULT_SETTINGS.textCase,
      countryOpacity:
        typeof parsed.countryOpacity === 'number' &&
        parsed.countryOpacity >= 0.1 &&
        parsed.countryOpacity <= 1
          ? parsed.countryOpacity
          : DEFAULT_SETTINGS.countryOpacity,
      borderThickness:
        typeof parsed.borderThickness === 'number' &&
        parsed.borderThickness >= 0 &&
        parsed.borderThickness <= 4
          ? parsed.borderThickness
          : DEFAULT_SETTINGS.borderThickness,
      showLabels:
        typeof parsed.showLabels === 'boolean'
          ? parsed.showLabels
          : DEFAULT_SETTINGS.showLabels,
    };
  } catch (error) {
    console.warn('Failed to read settings from localStorage:', error);
    ReactGA4.event('settings_storage_error', {
      error_type: 'read_error',
      storage_type: 'localStorage',
      operation: 'settings_load',
      error_name: error instanceof Error ? error.name : 'unknown_error',
    });
    return DEFAULT_SETTINGS;
  }
};

const saveSettings = (settings: Settings) => {
  if (typeof window === 'undefined') return;

  try {
    const startTime = performance.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    ReactGA4.event('settings_saved', {
      storage_type: 'localStorage',
      settings_count: Object.keys(settings).length,
      save_duration_ms: Math.round(performance.now() - startTime),
      operation: 'settings_save',
    });
  } catch (error) {
    console.warn('Failed to save settings to localStorage:', error);
    ReactGA4.event('settings_storage_error', {
      error_type: 'save_error',
      storage_type: 'localStorage',
      operation: 'settings_save',
      error_name: error instanceof Error ? error.name : 'unknown_error',
    });
  }
};

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const restored = getInitialSettings();
    setSettings(restored);
    setIsInitialized(true);
    ReactGA4.event('settings_restored', {
      source: 'localStorage',
      settings_count: Object.keys(restored).length,
      has_custom_settings:
        JSON.stringify(restored) !== JSON.stringify(DEFAULT_SETTINGS),
    });
  }, []);

  const updateSettings = (changes: Partial<Settings>) => {
    const updated = { ...settings, ...changes };
    setSettings(updated);
    saveSettings(updated);

    Object.entries(changes).forEach(([key, newValue]) => {
      const oldValue = settings[key as keyof Settings];
      ReactGA4.event('setting_changed', {
        setting_name: key,
        previous_value: String(oldValue),
        new_value: String(newValue),
        setting_type: typeof newValue,
        change_method: 'settings_update',
      });
    });
  };

  const resetToDefaults = () => {
    const changedCount = Object.keys(DEFAULT_SETTINGS).filter(
      (key) =>
        settings[key as keyof Settings] !==
        DEFAULT_SETTINGS[key as keyof Settings],
    ).length;
    setSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
    ReactGA4.event('settings_reset', {
      reset_target: 'defaults',
      previous_customizations: changedCount,
      reset_method: 'manual_reset',
      had_customizations: changedCount > 0,
    });
  };

  const value = isInitialized
    ? { settings, updateSettings, resetToDefaults }
    : {
        settings: DEFAULT_SETTINGS,
        updateSettings: () => {},
        resetToDefaults: () => {},
      };

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

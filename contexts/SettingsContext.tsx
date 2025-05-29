import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import ReactGA4 from 'react-ga4';
import { InfoProvider } from '../hooks/useCountryInfo';

export type TextSize = 'small' | 'medium' | 'large';
export type TextCase = 'regular' | 'upper';

interface Settings {
  textSize: TextSize;
  textCase: TextCase;
  countryOpacity: number; // 0.1 to 1.0 in steps of 0.1
  infoProvider: InfoProvider;
  aiCompareEnabled: boolean; // New setting for AI Compare feature
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  resetToDefaults: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const STORAGE_KEY = 'historic-borders-settings';
const INFO_PROVIDER_STORAGE_KEY = 'historic-borders-info-provider';

const DEFAULT_SETTINGS: Settings = {
  textSize: 'medium',
  textCase: 'regular',
  countryOpacity: 0.7,
  infoProvider: 'wikipedia',
  aiCompareEnabled: false, // Disabled by default
};

// Helper function to get initial settings from localStorage
const getInitialSettings = (): Settings => {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS; // SSR fallback
  }
  
  let settings = { ...DEFAULT_SETTINGS };
  
  try {
    // Load main settings
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsedSettings = JSON.parse(stored);
      
      // Validate settings structure and types
      settings = {
        textSize: ['small', 'medium', 'large'].includes(parsedSettings.textSize) 
          ? parsedSettings.textSize 
          : DEFAULT_SETTINGS.textSize,
        textCase: ['regular', 'upper'].includes(parsedSettings.textCase) 
          ? parsedSettings.textCase 
          : DEFAULT_SETTINGS.textCase,
        countryOpacity: typeof parsedSettings.countryOpacity === 'number' 
          && parsedSettings.countryOpacity >= 0.1 
          && parsedSettings.countryOpacity <= 1.0
          ? parsedSettings.countryOpacity 
          : DEFAULT_SETTINGS.countryOpacity,
        infoProvider: ['wikipedia', 'ai'].includes(parsedSettings.infoProvider)
          ? parsedSettings.infoProvider
          : DEFAULT_SETTINGS.infoProvider,
        aiCompareEnabled: typeof parsedSettings.aiCompareEnabled === 'boolean' 
          ? parsedSettings.aiCompareEnabled 
          : DEFAULT_SETTINGS.aiCompareEnabled,
      };
    }
    
    // Check for legacy info provider setting and migrate it
    const legacyProvider = localStorage.getItem(INFO_PROVIDER_STORAGE_KEY);
    if (legacyProvider && (legacyProvider === 'ai' || legacyProvider === 'wikipedia')) {
      settings.infoProvider = legacyProvider as InfoProvider;
      // Remove legacy setting after migration
      localStorage.removeItem(INFO_PROVIDER_STORAGE_KEY);
      
      // Track migration
      ReactGA4.event({
        category: 'Settings',
        action: 'provider_migrated',
        label: `${legacyProvider}_to_settings`,
        value: 1,
      });
    }
      
    // Track settings restoration from localStorage
    ReactGA4.event({
      category: 'Settings',
      action: 'settings_restored',
      label: 'from_localStorage',
      value: 1,
    });
    
    return settings;
  } catch (error) {
    console.warn('Failed to read settings from localStorage:', error);
    
    // Track localStorage error
    ReactGA4.event({
      category: 'Settings',
      action: 'localstorage_read_error',
      label: 'settings',
      value: 1,
    });
  }
  
  // Track default settings usage
  ReactGA4.event({
    category: 'Settings',
    action: 'settings_default',
    label: 'defaults_used',
    value: 1,
  });
  
  return DEFAULT_SETTINGS;
};

// Helper function to save settings to localStorage
const saveSettings = (settings: Settings) => {
  if (typeof window === 'undefined') {
    return; // SSR safety
  }
  
  try {
    const startTime = performance.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    
    // Also save info provider to legacy key for backward compatibility
    localStorage.setItem(INFO_PROVIDER_STORAGE_KEY, settings.infoProvider);
    
    const duration = performance.now() - startTime;
    
    // Track successful localStorage save
    ReactGA4.event({
      category: 'Settings',
      action: 'settings_saved',
      label: 'to_localStorage',
      value: 1,
    });

    // Track performance metrics
    ReactGA4.event({
      category: 'Settings',
      action: 'save_performance',
      label: `localStorage_save_time`,
      value: Math.round(duration),
    });
  } catch (error) {
    console.warn('Failed to save settings to localStorage:', error);
    
    // Track localStorage save error with error type
    ReactGA4.event({
      category: 'Settings',
      action: 'localstorage_save_error',
      label: error instanceof Error ? error.name : 'unknown_error',
      value: 1,
    });
  }
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from localStorage on client side
  useEffect(() => {
    const initialSettings = getInitialSettings();
    setSettingsState(initialSettings);
    setIsInitialized(true);
  }, []);

  const updateSettings = (newSettings: Partial<Settings>) => {
    const previousSettings = settings;
    const updatedSettings = { ...settings, ...newSettings };
    setSettingsState(updatedSettings);
    saveSettings(updatedSettings);
    
    // Track individual setting changes
    Object.keys(newSettings).forEach(key => {
      const settingKey = key as keyof Settings;
      const oldValue = previousSettings[settingKey];
      const newValue = updatedSettings[settingKey];
      
      // Special handling for infoProvider changes with AI Feature analytics
      if (settingKey === 'infoProvider' && oldValue !== newValue) {
        // Track AI feature toggle
        ReactGA4.event({
          category: 'AI Feature',
          action: 'toggle_provider',
          label: `${oldValue}_to_${newValue}`,
          value: 1,
        });

        // Track specific provider activation
        ReactGA4.event({
          category: 'AI Feature',
          action: newValue === 'ai' ? 'enable_ai' : 'disable_ai',
          label: String(newValue),
          value: 1,
        });
      }
      
      ReactGA4.event({
        category: 'Settings',
        action: 'setting_changed',
        label: `${key}_to_${String(newValue)}`,
        value: 1,
      });

      // Track setting transitions for UX insights
      ReactGA4.event({
        category: 'Settings',
        action: 'setting_transition',
        label: `${key}_${String(oldValue)}_to_${String(newValue)}`,
        value: 1,
      });
    });

    // Track setting combinations for popular configurations
    const settingCombination = `textSize:${updatedSettings.textSize}_textCase:${updatedSettings.textCase}_opacity:${updatedSettings.countryOpacity}_provider:${updatedSettings.infoProvider}`;
    ReactGA4.event({
      category: 'Settings',
      action: 'settings_combination_used',
      label: settingCombination,
      value: 1,
    });

    // Track bulk vs single setting changes
    const changeCount = Object.keys(newSettings).length;
    ReactGA4.event({
      category: 'Settings',
      action: changeCount > 1 ? 'bulk_settings_change' : 'single_setting_change',
      label: `${changeCount}_settings_changed`,
      value: changeCount,
    });
  };

  const resetToDefaults = () => {
    const previousSettings = settings;
    setSettingsState(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
    
    // Track settings reset
    ReactGA4.event({
      category: 'Settings',
      action: 'settings_reset',
      label: 'to_defaults',
      value: 1,
    });

    // Track what settings were changed from defaults before reset
    const changedSettings = Object.keys(DEFAULT_SETTINGS).filter(key => {
      const settingKey = key as keyof Settings;
      return previousSettings[settingKey] !== DEFAULT_SETTINGS[settingKey];
    });

    if (changedSettings.length > 0) {
      ReactGA4.event({
        category: 'Settings',
        action: 'reset_from_customized',
        label: `${changedSettings.join(',')}_were_customized`,
        value: changedSettings.length,
      });
    }
  };

  // Don't render until initialized to prevent hydration mismatch
  if (!isInitialized) {
    return (
      <SettingsContext.Provider value={{ 
        settings: DEFAULT_SETTINGS, 
        updateSettings: () => {}, 
        resetToDefaults: () => {} 
      }}>
        {children}
      </SettingsContext.Provider>
    );
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetToDefaults }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}; 
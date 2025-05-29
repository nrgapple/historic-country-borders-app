import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import ReactGA4 from 'react-ga4';

export type TextSize = 'small' | 'medium' | 'large';
export type TextCase = 'regular' | 'upper';

interface Settings {
  textSize: TextSize;
  textCase: TextCase;
  countryOpacity: number; // 0.1 to 1.0 in steps of 0.1
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  resetToDefaults: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const STORAGE_KEY = 'historic-borders-settings';

const DEFAULT_SETTINGS: Settings = {
  textSize: 'medium',
  textCase: 'regular',
  countryOpacity: 0.7,
};

// Helper function to get initial settings from localStorage
const getInitialSettings = (): Settings => {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS; // SSR fallback
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsedSettings = JSON.parse(stored);
      
      // Validate settings structure and types
      const validatedSettings: Settings = {
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
      };
      
      // Track settings restoration from localStorage
      ReactGA4.event({
        category: 'Settings',
        action: 'settings_restored',
        label: 'from_localStorage',
        value: 1,
      });
      
      return validatedSettings;
    }
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    
    // Track successful localStorage save
    ReactGA4.event({
      category: 'Settings',
      action: 'settings_saved',
      label: 'to_localStorage',
      value: 1,
    });
  } catch (error) {
    console.warn('Failed to save settings to localStorage:', error);
    
    // Track localStorage save error
    ReactGA4.event({
      category: 'Settings',
      action: 'localstorage_save_error',
      label: 'settings',
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
    const updatedSettings = { ...settings, ...newSettings };
    setSettingsState(updatedSettings);
    saveSettings(updatedSettings);
    
    // Track settings changes
    Object.keys(newSettings).forEach(key => {
      ReactGA4.event({
        category: 'Settings',
        action: 'setting_changed',
        label: `${key}_to_${updatedSettings[key as keyof Settings]}`,
        value: 1,
      });
    });
  };

  const resetToDefaults = () => {
    setSettingsState(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
    
    // Track settings reset
    ReactGA4.event({
      category: 'Settings',
      action: 'settings_reset',
      label: 'to_defaults',
      value: 1,
    });
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
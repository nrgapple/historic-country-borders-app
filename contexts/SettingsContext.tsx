'use client';

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
  showLabels: boolean; // New setting to show/hide map labels
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
  showLabels: true, // Default to showing labels
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
        showLabels: typeof parsedSettings.showLabels === 'boolean' 
          ? parsedSettings.showLabels 
          : DEFAULT_SETTINGS.showLabels,
      };
    }
    
    // Check for legacy info provider setting and migrate it
    const legacyProvider = localStorage.getItem(INFO_PROVIDER_STORAGE_KEY);
    if (legacyProvider && (legacyProvider === 'ai' || legacyProvider === 'wikipedia')) {
      settings.infoProvider = legacyProvider as InfoProvider;
      // Remove legacy setting after migration
      localStorage.removeItem(INFO_PROVIDER_STORAGE_KEY);
      
      // Track migration
      ReactGA4.event('settings_provider_migrated', {
        previous_provider: legacyProvider,
        new_provider: legacyProvider,
        migration_type: 'legacy_to_settings',
        migration_source: 'localStorage'
      });
    }
      
    // Track settings restoration from localStorage
    ReactGA4.event('settings_restored', {
      source: 'localStorage',
      settings_count: Object.keys(settings).length,
      has_custom_settings: JSON.stringify(settings) !== JSON.stringify(DEFAULT_SETTINGS)
    });
    
    return settings;
  } catch (error) {
    console.warn('Failed to read settings from localStorage:', error);
    
    // Track localStorage error
    ReactGA4.event('settings_storage_error', {
      error_type: 'read_error',
      storage_type: 'localStorage',
      operation: 'settings_load',
      error_name: error instanceof Error ? error.name : 'unknown_error'
    });
  }
  
  // Track default settings usage
  ReactGA4.event('settings_default_used', {
    reason: 'no_stored_settings',
    settings_source: 'defaults',
    is_first_visit: true
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
    ReactGA4.event('settings_saved', {
      storage_type: 'localStorage',
      settings_count: Object.keys(settings).length,
      save_duration_ms: Math.round(duration),
      operation: 'settings_save'
    });

    // Track performance metrics for save operations
    if (duration > 10) {
      ReactGA4.event('settings_save_performance', {
        duration_ms: Math.round(duration),
        performance_category: duration > 50 ? 'slow' : duration > 20 ? 'moderate' : 'fast',
        operation: 'localStorage_save'
      });
    }
  } catch (error) {
    console.warn('Failed to save settings to localStorage:', error);
    
    // Track localStorage save error with error type
    ReactGA4.event('settings_storage_error', {
      error_type: 'save_error',
      storage_type: 'localStorage',
      operation: 'settings_save',
      error_name: error instanceof Error ? error.name : 'unknown_error'
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
        ReactGA4.event('ai_provider_toggle', {
          previous_provider: String(oldValue),
          new_provider: String(newValue),
          toggle_direction: newValue === 'ai' ? 'enable_ai' : 'disable_ai',
          setting_context: 'info_provider'
        });

        // Track specific provider activation
        ReactGA4.event(newValue === 'ai' ? 'ai_feature_enabled' : 'ai_feature_disabled', {
          provider: String(newValue),
          previous_provider: String(oldValue),
          activation_method: 'settings_toggle'
        });
      }
      
      ReactGA4.event('setting_changed', {
        setting_name: key,
        previous_value: String(oldValue),
        new_value: String(newValue),
        setting_type: typeof newValue,
        change_method: 'settings_update'
      });

      // Track setting transitions for UX insights
      ReactGA4.event('setting_transition', {
        setting_name: key,
        transition: `${String(oldValue)}_to_${String(newValue)}`,
        setting_category: key === 'infoProvider' ? 'provider' : 
                         key.includes('text') ? 'text_formatting' : 
                         key.includes('opacity') ? 'visual' : 'general'
      });
    });

    // Track setting combinations for popular configurations
    const settingCombination = `textSize:${updatedSettings.textSize}_textCase:${updatedSettings.textCase}_opacity:${updatedSettings.countryOpacity}_provider:${updatedSettings.infoProvider}`;
    ReactGA4.event('settings_combination_applied', {
      text_size: updatedSettings.textSize,
      text_case: updatedSettings.textCase,
      country_opacity: Math.round(updatedSettings.countryOpacity * 100),
      info_provider: updatedSettings.infoProvider,
      ai_compare_enabled: updatedSettings.aiCompareEnabled,
      combination_hash: settingCombination.slice(0, 50) // Truncate for analytics
    });

    // Track bulk vs single setting changes
    const changeCount = Object.keys(newSettings).length;
    ReactGA4.event(changeCount > 1 ? 'settings_bulk_change' : 'settings_single_change', {
      change_count: changeCount,
      changed_settings: Object.keys(newSettings).join(','),
      change_type: changeCount > 1 ? 'bulk' : 'single',
      settings_modified: Object.keys(newSettings)
    });
  };

  const resetToDefaults = () => {
    const previousSettings = settings;
    setSettingsState(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
    
    // Track settings reset
    ReactGA4.event('settings_reset', {
      reset_target: 'defaults',
      previous_customizations: Object.keys(previousSettings).filter(key => previousSettings[key as keyof Settings] !== DEFAULT_SETTINGS[key as keyof Settings]).length,
      reset_method: 'manual_reset',
      had_customizations: Object.keys(previousSettings).filter(key => previousSettings[key as keyof Settings] !== DEFAULT_SETTINGS[key as keyof Settings]).length > 0
    });

    // Track what settings were changed from defaults before reset
    const changedSettings = Object.keys(DEFAULT_SETTINGS).filter(key => {
      const settingKey = key as keyof Settings;
      return previousSettings[settingKey] !== DEFAULT_SETTINGS[settingKey];
    });

    if (changedSettings.length > 0) {
      ReactGA4.event('settings_reset_from_customized', {
        customized_settings: changedSettings.join(','),
        customization_count: changedSettings.length,
        reset_scope: 'all_settings',
        customization_level: changedSettings.length > 3 ? 'heavy' : changedSettings.length > 1 ? 'moderate' : 'light'
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
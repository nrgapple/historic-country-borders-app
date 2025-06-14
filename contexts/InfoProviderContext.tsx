'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import ReactGA4 from 'react-ga4';
import { InfoProvider } from '../hooks/useCountryInfo';

interface InfoProviderContextType {
  provider: InfoProvider;
  setProvider: (provider: InfoProvider) => void;
  toggleProvider: () => void;
}

const InfoProviderContext = createContext<InfoProviderContextType | undefined>(undefined);

const STORAGE_KEY = 'historic-borders-info-provider';

// Helper function to get initial provider from localStorage
const getInitialProvider = (defaultProvider: InfoProvider): InfoProvider => {
  if (typeof window === 'undefined') {
    return defaultProvider; // SSR fallback
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'ai' || stored === 'wikipedia') {
      // Track provider restoration from localStorage
      ReactGA4.event({
        category: 'AI Feature',
        action: 'provider_restored',
        label: stored,
        value: 1,
      });
      
      return stored as InfoProvider;
    }
  } catch (error) {
    console.warn('Failed to read info provider preference from localStorage:', error);
    
    // Track localStorage error
    ReactGA4.event({
      category: 'AI Feature',
      action: 'localstorage_read_error',
      label: 'provider_preference',
      value: 1,
    });
  }
  
  // Track default provider usage
  ReactGA4.event({
    category: 'AI Feature',
    action: 'provider_default',
    label: defaultProvider,
    value: 1,
  });
  
  return defaultProvider;
};

// Helper function to save provider to localStorage
const saveProvider = (provider: InfoProvider) => {
  if (typeof window === 'undefined') {
    return; // SSR safety
  }
  
  try {
    localStorage.setItem(STORAGE_KEY, provider);
    
    // Track successful localStorage save
    ReactGA4.event({
      category: 'AI Feature',
      action: 'provider_saved',
      label: provider,
      value: 1,
    });
  } catch (error) {
    console.warn('Failed to save info provider preference to localStorage:', error);
    
    // Track localStorage save error
    ReactGA4.event({
      category: 'AI Feature',
      action: 'localstorage_save_error',
      label: provider,
      value: 1,
    });
  }
};

interface InfoProviderProviderProps {
  children: ReactNode;
  defaultProvider?: InfoProvider;
}

export const InfoProviderProvider: React.FC<InfoProviderProviderProps> = ({ 
  children, 
  defaultProvider = 'wikipedia' 
}) => {
  const [provider, setProviderState] = useState<InfoProvider>(defaultProvider);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from localStorage on client side
  useEffect(() => {
    const initialProvider = getInitialProvider(defaultProvider);
    setProviderState(initialProvider);
    setIsInitialized(true);
  }, [defaultProvider]);

  const setProvider = (newProvider: InfoProvider) => {
    const previousProvider = provider;
    setProviderState(newProvider);
    saveProvider(newProvider);
    
    // Track provider change
    ReactGA4.event({
      category: 'AI Feature',
      action: 'provider_changed',
      label: `${previousProvider}_to_${newProvider}`,
      value: 1,
    });
  };

  const toggleProvider = () => {
    const newProvider = provider === 'wikipedia' ? 'ai' : 'wikipedia';
    setProvider(newProvider);
  };

  // Track session provider usage
  useEffect(() => {
    if (isInitialized) {
      ReactGA4.event({
        category: 'AI Feature',
        action: 'session_provider_active',
        label: provider,
        value: 1,
      });
    }
  }, [provider, isInitialized]);

  // Don't render until initialized to prevent hydration mismatch
  if (!isInitialized) {
    return (
      <InfoProviderContext.Provider value={{ 
        provider: defaultProvider, 
        setProvider: () => {}, 
        toggleProvider: () => {} 
      }}>
        {children}
      </InfoProviderContext.Provider>
    );
  }

  return (
    <InfoProviderContext.Provider value={{ provider, setProvider, toggleProvider }}>
      {children}
    </InfoProviderContext.Provider>
  );
};

export const useInfoProvider = () => {
  const context = useContext(InfoProviderContext);
  if (context === undefined) {
    throw new Error('useInfoProvider must be used within an InfoProviderProvider');
  }
  return context;
}; 
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
      return stored as InfoProvider;
    }
  } catch (error) {
    console.warn('Failed to read info provider preference from localStorage:', error);
  }
  
  return defaultProvider;
};

// Helper function to save provider to localStorage
const saveProvider = (provider: InfoProvider) => {
  if (typeof window === 'undefined') {
    return; // SSR safety
  }
  
  try {
    localStorage.setItem(STORAGE_KEY, provider);
  } catch (error) {
    console.warn('Failed to save info provider preference to localStorage:', error);
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
    setProviderState(newProvider);
    saveProvider(newProvider);
  };

  const toggleProvider = () => {
    const newProvider = provider === 'wikipedia' ? 'ai' : 'wikipedia';
    setProvider(newProvider);
  };

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
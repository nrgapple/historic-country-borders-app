import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import ReactGA4 from 'react-ga4';
import { redisCache } from '../lib/redis';

export interface ComparisonItem {
  id: string;
  country1: { name: string; year: string };
  country2: { name: string; year: string };
  content: string;
  createdAt: Date;
}

export interface CompareState {
  isCompareMode: boolean;
  country1: { name: string; year: string } | null;
  country2: { name: string; year: string } | null;
  isLoading: boolean;
  currentComparison: string | null;
}

interface CompareContextType {
  compareState: CompareState;
  history: ComparisonItem[];
  startCompare: (countryName: string, year: string) => void;
  selectSecondCountry: (countryName: string, year: string) => void;
  executeComparison: () => Promise<void>;
  cancelCompare: () => void;
  clearComparison: () => void;
  loadHistory: () => Promise<void>;
  showComparison: (comparison: ComparisonItem) => void;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

const HISTORY_STORAGE_KEY = 'ai-compare-history';

interface CompareProviderProps {
  children: ReactNode;
}

export const CompareProvider: React.FC<CompareProviderProps> = ({ children }) => {
  const [compareState, setCompareState] = useState<CompareState>({
    isCompareMode: false,
    country1: null,
    country2: null,
    isLoading: false,
    currentComparison: null,
  });
  
  const [history, setHistory] = useState<ComparisonItem[]>([]);

  const startCompare = (countryName: string, year: string) => {
    setCompareState({
      isCompareMode: true,
      country1: { name: countryName, year },
      country2: null,
      isLoading: false,
      currentComparison: null,
    });

    // Track compare mode activation
    ReactGA4.event({
      category: 'AI Compare',
      action: 'compare_mode_started',
      label: `${countryName}_${year}`,
      value: 1,
    });
  };

  const selectSecondCountry = (countryName: string, year: string) => {
    if (!compareState.country1) return;

    setCompareState(prev => ({
      ...prev,
      country2: { name: countryName, year },
    }));

    // Track second country selection
    ReactGA4.event({
      category: 'AI Compare',
      action: 'second_country_selected',
      label: `${compareState.country1.name}_${compareState.country1.year}_vs_${countryName}_${year}`,
      value: 1,
    });
  };

  const executeComparison = async () => {
    if (!compareState.country1 || !compareState.country2) return;

    setCompareState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch('/api/ai-compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          country1: compareState.country1,
          country2: compareState.country2,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const comparisonId = `${compareState.country1.name}_${compareState.country1.year}_vs_${compareState.country2.name}_${compareState.country2.year}_${Date.now()}`;
      
      const newComparison: ComparisonItem = {
        id: comparisonId,
        country1: compareState.country1,
        country2: compareState.country2,
        content: data.content,
        createdAt: new Date(),
      };

      // Add to history
      const updatedHistory = [newComparison, ...history].slice(0, 50); // Keep only last 50
      setHistory(updatedHistory);
      
      // Save to localStorage
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
      } catch (error) {
        console.warn('Failed to save comparison history to localStorage:', error);
      }

      setCompareState(prev => ({
        ...prev,
        isLoading: false,
        currentComparison: data.content,
      }));

      // Track successful comparison
      ReactGA4.event({
        category: 'AI Compare',
        action: 'comparison_completed',
        label: `${compareState.country1.name}_${compareState.country1.year}_vs_${compareState.country2.name}_${compareState.country2.year}`,
        value: 1,
      });

    } catch (error) {
      console.error('Comparison error:', error);
      setCompareState(prev => ({ ...prev, isLoading: false }));

      // Track comparison error
      ReactGA4.event({
        category: 'AI Compare',
        action: 'comparison_failed',
        label: error instanceof Error ? error.message : 'unknown_error',
        value: 1,
      });
    }
  };

  const cancelCompare = () => {
    // Track compare cancellation
    ReactGA4.event({
      category: 'AI Compare',
      action: 'compare_cancelled',
      label: compareState.country1 ? `${compareState.country1.name}_${compareState.country1.year}` : 'no_selection',
      value: 1,
    });

    setCompareState({
      isCompareMode: false,
      country1: null,
      country2: null,
      isLoading: false,
      currentComparison: null,
    });
  };

  const clearComparison = () => {
    setCompareState(prev => ({
      ...prev,
      currentComparison: null,
    }));
  };

  const loadHistory = async () => {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        const parsedHistory = JSON.parse(stored).map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
        }));
        setHistory(parsedHistory);
      }
    } catch (error) {
      console.warn('Failed to load comparison history from localStorage:', error);
    }
  };

  const showComparison = (comparison: ComparisonItem) => {
    setCompareState({
      isCompareMode: true,
      country1: comparison.country1,
      country2: comparison.country2,
      isLoading: false,
      currentComparison: comparison.content,
    });

    // Track history item selection
    ReactGA4.event({
      category: 'AI Compare',
      action: 'history_item_selected',
      label: `${comparison.country1.name}_${comparison.country1.year}_vs_${comparison.country2.name}_${comparison.country2.year}`,
      value: 1,
    });
  };

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <CompareContext.Provider value={{
      compareState,
      history,
      startCompare,
      selectSecondCountry,
      executeComparison,
      cancelCompare,
      clearComparison,
      loadHistory,
      showComparison,
    }}>
      {children}
    </CompareContext.Provider>
  );
};

export const useCompare = () => {
  const context = useContext(CompareContext);
  if (context === undefined) {
    throw new Error('useCompare must be used within a CompareProvider');
  }
  return context;
}; 
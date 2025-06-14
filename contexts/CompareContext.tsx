'use client';

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
    ReactGA4.event('ai_compare_start', {
      country1_name: countryName,
      country1_year: year,
      feature: 'ai_comparison'
    });
  };

  const selectSecondCountry = (countryName: string, year: string) => {
    if (!compareState.country1) return;

    // Prevent comparing the same country-year combination
    if (compareState.country1.name === countryName && compareState.country1.year === year) {
      // Track attempted same country selection
      ReactGA4.event('ai_compare_duplicate_selection', {
        country_name: countryName,
        year: year,
        error_type: 'same_country_year'
      });
      
      console.warn(`Cannot compare ${countryName} (${year}) with itself`);
      return;
    }

    setCompareState(prev => ({
      ...prev,
      country2: { name: countryName, year },
    }));

    // Track second country selection
    ReactGA4.event('ai_compare_country_pair_selected', {
      country1_name: compareState.country1.name,
      country1_year: compareState.country1.year,
      country2_name: countryName,
      country2_year: year,
      year_span: Math.abs(parseInt(year) - parseInt(compareState.country1.year)),
      same_year: year === compareState.country1.year
    });
  };

  const executeComparison = async () => {
    if (!compareState.country1 || !compareState.country2) return;

    const startTime = Date.now();
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
      const responseTime = Date.now() - startTime;
      const wordCount = data.content ? data.content.split(/\s+/).length : 0;
      
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

      // Track successful comparison with detailed metrics
      ReactGA4.event('ai_comparison_complete', {
        country1_name: compareState.country1.name,
        country1_year: compareState.country1.year,
        country2_name: compareState.country2.name,
        country2_year: compareState.country2.year,
        response_time_ms: responseTime,
        content_length: data.content?.length || 0,
        word_count: wordCount,
        year_span: Math.abs(parseInt(compareState.country2.year) - parseInt(compareState.country1.year)),
        comparison_quality: wordCount < 100 ? 'brief' : wordCount < 300 ? 'detailed' : 'comprehensive'
      });

    } catch (error) {
      console.error('Comparison error:', error);
      const responseTime = Date.now() - startTime;
      setCompareState(prev => ({ ...prev, isLoading: false }));

      // Track comparison error with context
      ReactGA4.event('ai_comparison_failed', {
        country1_name: compareState.country1.name,
        country1_year: compareState.country1.year,
        country2_name: compareState.country2.name,
        country2_year: compareState.country2.year,
        error_message: error instanceof Error ? error.message : 'unknown_error',
        response_time_ms: responseTime,
        error_type: error instanceof Error && error.message.includes('429') ? 'rate_limit' : 
                   error instanceof Error && error.message.includes('fetch') ? 'network_error' : 'api_error'
      });
    }
  };

  const cancelCompare = () => {
    // Track compare cancellation with context
    ReactGA4.event('ai_compare_cancel', {
      country1_name: compareState.country1?.name || 'none',
      country1_year: compareState.country1?.year || 'none',
      country2_name: compareState.country2?.name || 'none',
      country2_year: compareState.country2?.year || 'none',
      cancellation_stage: !compareState.country1 ? 'initial' : 
                         !compareState.country2 ? 'first_selected' : 
                         compareState.isLoading ? 'loading' : 'ready_to_compare'
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
    ReactGA4.event('ai_comparison_history_view', {
      country1_name: comparison.country1.name,
      country1_year: comparison.country1.year,
      country2_name: comparison.country2.name,
      country2_year: comparison.country2.year,
      comparison_age_hours: Math.round((Date.now() - comparison.createdAt.getTime()) / (1000 * 60 * 60))
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
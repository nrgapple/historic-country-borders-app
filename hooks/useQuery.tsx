'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useEffect } from 'react';
import { AppQueryParams } from '../types/query';
import { parseQueryParams } from '../utils/queryParams';

export interface QueryContext {
  query: AppQueryParams;
  setQuery: (updates: Partial<AppQueryParams> | null | undefined) => void;
  updateQuery: (updates: Partial<AppQueryParams> | null | undefined) => void;
  isReady: boolean;
}

const context = createContext({} as QueryContext);

export const useQuery = () => {
  const contextValue = useContext(context);
  if (!contextValue) {
    throw new Error('useQuery must be used within a QueryProvider');
  }
  return contextValue;
};

export const QueryProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const debounceTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);
  
  // Parse the current query parameters into our typed structure
  const query = useMemo(() => {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return parseQueryParams(params);
  }, [searchParams]);
  
  // Update query parameters immediately
  const updateQuery = useCallback((updates: Partial<AppQueryParams> | null | undefined) => {
    // Early return if updates is null or undefined
    if (!updates) return;
    
    const newParams = new URLSearchParams(searchParams);
    
    // Apply updates, only including defined values
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    
    const newUrl = `${pathname}?${newParams.toString()}`;
    router.replace(newUrl, { scroll: false });
  }, [router, searchParams, pathname]);
  
  // Debounced version for frequent updates (like map movement)
  const debouncedUpdateQuery = useCallback((updates: Partial<AppQueryParams> | null | undefined) => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Set new timeout
    debounceTimeoutRef.current = setTimeout(() => {
      updateQuery(updates);
    }, 200);
  }, [updateQuery]);
  
  // Immediate update for user actions (like year selection)
  const setQuery = useCallback((updates: Partial<AppQueryParams> | null | undefined) => {
    updateQuery(updates);
  }, [updateQuery]);

  const contextValue = useMemo(() => ({
    query,
    setQuery,
    updateQuery: debouncedUpdateQuery,
    isReady: true, // App Router is always ready
  }), [query, setQuery, debouncedUpdateQuery]);

  return (
    <context.Provider value={contextValue}>
      {children}
    </context.Provider>
  );
};

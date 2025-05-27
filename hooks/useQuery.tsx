import { useRouter } from 'next/router';
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
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);
  
  // Parse the current query parameters into our typed structure
  // Only parse when router is ready to avoid hydration issues
  const query = useMemo(() => {
    if (!router.isReady || !router.query) {
      return {};
    }
    return parseQueryParams(router.query);
  }, [router.isReady, router.query]);
  
  // Update query parameters immediately
  const updateQuery = useCallback((updates: Partial<AppQueryParams> | null | undefined) => {
    // Early return if updates is null or undefined, or router not ready
    if (!updates || !router.isReady) return;
    
    const newQuery: Record<string, string> = {};
    
    // Start with existing query parameters (with null check)
    const currentQuery = router.query || {};
    Object.entries(currentQuery).forEach(([key, value]) => {
      if (typeof value === 'string') {
        newQuery[key] = value;
      } else if (Array.isArray(value) && value.length > 0) {
        newQuery[key] = value[0];
      }
    });
    
    // Apply updates, only including defined values
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        newQuery[key] = value;
      }
    });
    
    router.replace({
      pathname: router.pathname,
      query: newQuery,
    }, undefined, { shallow: true });
  }, [router]);
  
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
    isReady: router.isReady,
  }), [query, setQuery, debouncedUpdateQuery, router.isReady]);

  return (
    <context.Provider value={contextValue}>
      {children}
    </context.Provider>
  );
};

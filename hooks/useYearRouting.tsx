'use client';

import { useRouter, useParams } from 'next/navigation';
import { useCallback } from 'react';

export interface YearRoutingContext {
  currentYear: string;
  setYear: (year: string) => void;
  isReady: boolean;
}

export const useYearRouting = (initialYear?: string): YearRoutingContext => {
  const router = useRouter();
  const params = useParams();
  
  // Get current year from params or initial year
  const currentYear = (params?.year as string) || initialYear || '';
  
  // Navigate to new year using path routing
  const setYear = useCallback((year: string) => {
    if (!year || year === currentYear) return;
    
    // Use router.push to navigate to the new year
    router.push(`/year/${year}`);
  }, [router, currentYear]);

  return {
    currentYear,
    setYear,
    isReady: true, // App Router is always ready
  };
}; 
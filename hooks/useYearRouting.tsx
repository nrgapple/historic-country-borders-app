import { useRouter } from 'next/router';
import { useCallback } from 'react';

export interface YearRoutingContext {
  currentYear: string;
  setYear: (year: string) => void;
  isReady: boolean;
}

export const useYearRouting = (initialYear?: string): YearRoutingContext => {
  const router = useRouter();
  
  // Get current year from router or prop
  const currentYear = router.query.year as string || initialYear || '';
  
  // Navigate to new year using path routing
  const setYear = useCallback((year: string) => {
    if (!year || year === currentYear) return;
    
    // Use router.push with shallow routing to prevent full page refresh
    router.push(`/year/${year}`, undefined, { shallow: true });
  }, [router, currentYear]);

  return {
    currentYear,
    setYear,
    isReady: router.isReady,
  };
}; 
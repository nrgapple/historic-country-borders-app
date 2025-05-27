import { useMemo, useCallback } from 'react';
import { useQuery } from './useQuery';
import { getMapViewFromQuery, formatMapCoordinates } from '../utils/queryParams';
import { MapViewState } from '../types/query';

/**
 * Custom hook for managing map-related query parameters
 * Provides type-safe access to map view state and update functions
 */
export function useMapQuery() {
  const { query, updateQuery, isReady } = useQuery();

  // Get current map view state from query parameters
  // Only calculate when router is ready to avoid hydration issues
  const viewState = useMemo(() => {
    if (!isReady) {
      // Return defaults during hydration
      return { longitude: 0, latitude: 0, zoom: 2 };
    }
    return getMapViewFromQuery(query);
  }, [isReady, query.lng, query.lat, query.zoom]);

  // Update map coordinates in URL (debounced)
  const updateMapView = useCallback((longitude: number, latitude: number, zoom: number) => {
    if (!isReady) return; // Don't update until router is ready
    
    const coordinates = formatMapCoordinates(longitude, latitude, zoom);
    updateQuery(coordinates);
  }, [updateQuery, isReady]);

  return {
    viewState,
    updateMapView,
    isReady,
  };
} 
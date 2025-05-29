import { ParsedUrlQuery } from 'querystring';
import { AppQueryParams, MapViewState, DEFAULT_MAP_VIEW } from '../types/query';

/**
 * Safely extracts a string value from ParsedUrlQuery
 */
function getStringParam(query: ParsedUrlQuery, key: string): string | undefined {
  const value = query[key];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Safely extracts a number from query parameters with validation
 */
function getNumberParam(query: ParsedUrlQuery, key: string, defaultValue: number): number {
  const value = getStringParam(query, key);
  if (!value) return defaultValue;
  
  const parsed = Number(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parses query parameters into a typed AppQueryParams object
 * Note: Year is now handled via path routing, not query parameters
 */
export function parseQueryParams(query: ParsedUrlQuery | null | undefined): AppQueryParams {
  if (!query) {
    return {};
  }
  
  return {
    lng: getStringParam(query, 'lng'),
    lat: getStringParam(query, 'lat'),
    zoom: getStringParam(query, 'zoom'),
  };
}

/**
 * Extracts map view state from query parameters with defaults
 */
export function getMapViewFromQuery(query: AppQueryParams): MapViewState {
  const lng = query.lng ? Number(query.lng) : DEFAULT_MAP_VIEW.longitude;
  const lat = query.lat ? Number(query.lat) : DEFAULT_MAP_VIEW.latitude;
  const zoom = query.zoom ? Number(query.zoom) : DEFAULT_MAP_VIEW.zoom;
  
  return {
    longitude: isNaN(lng) ? DEFAULT_MAP_VIEW.longitude : lng,
    latitude: isNaN(lat) ? DEFAULT_MAP_VIEW.latitude : lat,
    zoom: isNaN(zoom) ? DEFAULT_MAP_VIEW.zoom : zoom,
  };
}

/**
 * Formats map coordinates for URL (7 decimal places for precision)
 */
export function formatMapCoordinates(lng: number, lat: number, zoom: number): AppQueryParams {
  return {
    lng: lng.toFixed(7),
    lat: lat.toFixed(7),
    zoom: zoom.toFixed(7),
  };
}

/**
 * Validates if a year string is valid
 */
export function isValidYear(year: string | undefined, availableYears: number[]): boolean {
  if (!year) return false;
  const yearNum = parseInt(year, 10);
  return !isNaN(yearNum) && availableYears.includes(yearNum);
}

/**
 * Gets the default year from available years (first year)
 */
export function getDefaultYear(availableYears: number[]): string {
  return availableYears[0]?.toString() ?? '';
} 
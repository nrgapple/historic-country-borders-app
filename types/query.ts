export interface AppQueryParams {
  year?: string;
  lng?: string;
  lat?: string;
  zoom?: string;
}

export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

export const DEFAULT_MAP_VIEW: MapViewState = {
  longitude: 0,
  latitude: 0,
  zoom: 2,
};

export const QUERY_PARAM_KEYS = {
  YEAR: 'year',
  LONGITUDE: 'lng',
  LATITUDE: 'lat',
  ZOOM: 'zoom',
} as const; 
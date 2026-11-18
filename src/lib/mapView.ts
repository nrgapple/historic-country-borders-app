/**
 * Map position lives in the URL (`?lng=&lat=&zoom=`) so any view can be shared.
 * The selected place, when there is one, is shared as `?place=<NAME>`.
 *
 * The position is read once when the map mounts and written with
 * `history.replaceState` after the camera settles. Writing through the Next
 * router would re-render the whole page on every pan, so we update the
 * browser URL directly and keep Next's history state object intact.
 */

export interface MapView {
  longitude: number;
  latitude: number;
  zoom: number;
}

export const WORLD_VIEW: MapView = { longitude: 10, latitude: 30, zoom: 1.6 };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const finite = (raw: string | null) => {
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
};

export const parseMapView = (
  search: string,
  fallback: MapView = WORLD_VIEW,
): MapView => {
  const params = new URLSearchParams(search);
  const longitude = finite(params.get('lng'));
  const latitude = finite(params.get('lat'));
  const zoom = finite(params.get('zoom'));
  return {
    longitude:
      longitude === undefined
        ? fallback.longitude
        : clamp(longitude, -180, 180),
    latitude:
      latitude === undefined ? fallback.latitude : clamp(latitude, -85, 85),
    zoom: zoom === undefined ? fallback.zoom : clamp(zoom, 0, 22),
  };
};

export const hasMapView = (search: string) => {
  const params = new URLSearchParams(search);
  return params.has('lng') && params.has('lat');
};

/** Four decimals (≈11 m) is ample for a shareable map position. */
export const formatMapView = ({ longitude, latitude, zoom }: MapView) => ({
  lng: longitude.toFixed(4),
  lat: latitude.toFixed(4),
  zoom: zoom.toFixed(2),
});

export const mapViewSearch = (search: string, view: MapView): string => {
  const params = new URLSearchParams(search);
  const formatted = formatMapView(view);
  params.set('lng', formatted.lng);
  params.set('lat', formatted.lat);
  params.set('zoom', formatted.zoom);
  return `?${params.toString()}`;
};

/** Replaces the query string without a navigation, keeping Next's history state. */
export const replaceSearch = (nextSearch: string) => {
  const { pathname, hash } = window.location;
  const next = `${pathname}${nextSearch}${hash}`;
  const state = window.history.state;
  window.history.replaceState(
    state && typeof state === 'object' ? { ...state, as: next } : state,
    '',
    next,
  );
};

export const writeMapView = (view: MapView) => {
  if (typeof window === 'undefined') return;
  replaceSearch(mapViewSearch(window.location.search, view));
};

export const PLACE_PARAM = 'place';
/** Longer than any published territory or district name. */
const MAX_PLACE_LENGTH = 200;

/** The shared place name, or `undefined` when absent, blank, or oversized. */
export const parsePlace = (search: string): string | undefined => {
  const raw = new URLSearchParams(search).get(PLACE_PARAM)?.trim();
  if (!raw || raw.length > MAX_PLACE_LENGTH) return undefined;
  return raw;
};

/** Sets or removes `place`, preserving every other parameter. */
export const placeSearch = (search: string, place: string | undefined) => {
  const params = new URLSearchParams(search);
  if (place) params.set(PLACE_PARAM, place);
  else params.delete(PLACE_PARAM);
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const writePlace = (place: string | undefined) => {
  if (typeof window === 'undefined') return;
  const { search } = window.location;
  const next = placeSearch(search, place);
  if (next !== search) replaceSearch(next);
};

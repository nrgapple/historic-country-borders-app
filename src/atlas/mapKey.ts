/**
 * How the map key reads the map (plan §2.1, §9.2 P3). The key never listens
 * to per-frame events: the scale bar and the locator globe follow the camera
 * on `moveend`, and the legend reads what is drawn on `idle`.
 */
import type { LegendEntry } from '../adapters/mapStyle';

/** The part of MapLibre's Map the key uses (a fake one in unit tests). */
export interface KeyMap {
  on(type: string, listener: () => void): unknown;
  off(type: string, listener: () => void): unknown;
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  getBounds(): {
    getWest(): number;
    getSouth(): number;
    getEast(): number;
    getNorth(): number;
  };
}

export interface KeyView {
  center: [number, number];
  zoom: number;
  bounds: [number, number, number, number];
}

export const readView = (map: KeyMap): KeyView => {
  const c = map.getCenter();
  const b = map.getBounds();
  return {
    center: [c.lng, c.lat],
    zoom: map.getZoom(),
    bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
  };
};

/**
 * Calls `onView` now and after every `moveend`, and `onIdle` after every
 * `idle`. Returns the unsubscribe function.
 */
export function watchMapKey(
  map: KeyMap,
  onView: (view: KeyView) => void,
  onIdle: () => void,
): () => void {
  const view = () => onView(readView(map));
  map.on('moveend', view);
  map.on('idle', onIdle);
  view();
  return () => {
    map.off('moveend', view);
    map.off('idle', onIdle);
  };
}

/** A stable key for a legend, so React state changes only when it does. */
export const legendKey = (entries: readonly LegendEntry[]) =>
  entries.map((e) => e.id).join(',');

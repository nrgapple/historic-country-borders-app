/**
 * Natural Earth 1:110m land (T2's `GLOBE_LAND_URL`, about 75 kB), fetched
 * once per page and shared: the map key's locator globe draws it, and the
 * viewport-label search uses it as its water mask.
 */
import { GLOBE_LAND_URL } from '../adapters/basemap';

export interface LandCollection {
  features: { geometry: { type: string; coordinates: unknown } | null }[];
}

let land: Promise<LandCollection | null> | null = null;

/** Resolves to the land collection, or null if it could not be loaded (retried next call). */
export const loadLand = (): Promise<LandCollection | null> =>
  (land ??= fetch(GLOBE_LAND_URL)
    .then((r) => (r.ok ? (r.json() as Promise<LandCollection>) : null))
    .then((json) => {
      if (!json) land = null;
      return json;
    })
    .catch(() => {
      land = null;
      return null;
    }));

/** Tests only. */
export const __resetLand = () => {
  land = null;
};

/**
 * T2 ADAPTER: the first-party Natural Earth basemap (plan §5, option A),
 * integrated with `t3/build-static-vector-basemap` (build ne-5.1.2-r1).
 * Contract: docs/BASEMAP.md "Layer contract". Every URL comes from
 * data/basemap-manifest.json (only the named fields below are bundled), so a
 * new basemap build needs no code change here.
 *
 * - One vector source, z0–5, overzoomed to the app's max zoom.
 * - `ocean` is the world minus land: painted over the territory fills.
 * - `coast` has water on the right: a positive `line-offset` goes seaward;
 *   `landmass_km2` drives the waterline rule.
 * - Relief is one Web Mercator WebP, added after the first paint.
 */
import {
  attribution,
  globe,
  relief,
  tiles,
} from '@repo/data/basemap-manifest.json';

export const BASEMAP_TILES = tiles.url;
export const BASEMAP_MAXZOOM = tiles.maxzoom;

export const BASEMAP_LAYER = {
  /** The world minus land (and the Caspian), in z3-tile cells. Painted over borders. */
  ocean: 'ocean',
  /** Coastline rings as lines; attribute `landmass_km2`. */
  coast: 'coast',
  /** Lake polygons: `rank`, optional `name`. */
  lakes: 'lakes',
  /** River centrelines: `rank`, optional `name`. */
  rivers: 'rivers',
  /** Sea and ocean label points: `name`, `kind` ('ocean' | 'sea' | …), `rank` 0–4. */
  marine: 'marine_labels',
} as const;

/** Coast attribute for the waterline rule (≥ 5,000 km² only). */
export const COAST_LANDMASS_KM2 = 'landmass_km2';

/** Relief image (Web Mercator, 180°W–180°E between these latitudes). */
export const RELIEF = {
  url: relief.url,
  coordinates: relief.coordinates as [number, number][],
} as const;

/** Natural Earth 110m land for T7's locator globe (loaded with the map key). */
export const GLOBE_LAND_URL = globe.url;

export const BASEMAP_ATTRIBUTION = `Coasts, rivers, relief: ${attribution}`;

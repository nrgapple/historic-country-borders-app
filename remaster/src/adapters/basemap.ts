/**
 * T2 ADAPTER: the first-party Natural Earth basemap (plan §5, option A).
 *
 * Contract (same names as T6's `contract.ts`): static z/x/y vector tiles with
 * the source-layers below, the ocean mask painted over the territory fills,
 * coastline rings wound so a positive `line-offset` moves seaward, and an
 * optional `landmass_km2` on coast features for the waterline rule.
 *
 * STAND-IN: `scripts/build-standins.mjs` tiles the design spike's prepared
 * Natural Earth data into /basemap-standin/ and copies its relief WebP.
 * SWITCH when T2 lands: set BASEMAP_TILES to T2's tile URL (for example
 * '/basemap/{z}/{x}/{y}.pbf'), RELIEF to T2's image and bounds, and drop the
 * basemap/relief part of build-standins.mjs.
 */
export const BASEMAP_TILES = '/basemap-standin/{z}/{x}/{y}.pbf';
export const BASEMAP_MAXZOOM = 5;

export const BASEMAP_LAYER = {
  /** The world minus land, in 30° cells (plus lakes): painted over borders. */
  ocean: 'ocean',
  /** Coastline rings as lines. */
  coast: 'coast',
  /** Lake polygons: `name`, `rank`. */
  lakes: 'lakes',
  /** River centrelines: `name`, `rank`. */
  rivers: 'rivers',
  /** Sea and ocean label points: `name`, `kind` ('ocean' | …), `rank`. */
  marine: 'marine',
} as const;

/** Coast attribute for the waterline rule; absent in the stand-in. */
export const COAST_LANDMASS_KM2 = 'landmass_km2';

/** Relief image (Web Mercator, 180°W–180°E between these latitudes). */
export const RELIEF = {
  url: '/relief-standin/relief.webp',
  north: 76,
  south: -58,
} as const;

export const BASEMAP_ATTRIBUTION =
  'Coasts, rivers, relief: <a href="https://www.naturalearthdata.com/">Natural Earth</a>';

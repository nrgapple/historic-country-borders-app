/**
 * The data contract between the Classic-atlas style (T6) and the tracks that
 * produce its inputs. Every source id, source-layer, attribute name, URL and
 * fontstack the style reads is named here and nowhere else.
 *
 * - T1 year data: docs/HISTORICAL_DATA.md ("Split year files") and
 *   docs/HISTORICAL_CONTEXT.md ("Capital points").
 * - T2 basemap: docs/BASEMAP.md ("Layer contract"), data/basemap-manifest.json.
 * - T3 glyphs: docs/FONTS.md ("Map fontstacks"), data/map-fonts.json.
 *
 * `style.test.ts` checks these values against the manifests and runs T3's
 * `checkStyleFontstacks`, so a rebuilt basemap or glyph set that moves a URL
 * fails the tests instead of silently 404ing.
 */
import {
  attribution as basemapAttribution,
  relief,
  tiles,
} from '../../../../data/basemap-manifest.json';

/* ---- Sources ------------------------------------------------------------ */

export const SOURCE = {
  /** T2: Natural Earth physical basemap, static z/x/y vector tiles. */
  basemap: 'basemap',
  /** T1: the year's territory polygons (GeoJSON, parsed in MapLibre's worker). */
  borders: 'borders',
  /** T1: the year's territory label points and dated places. */
  labels: 'labels',
  /** T1: the year's capitals (`CAPITAL_ATTR`). */
  capitals: 'capitals',
  /** Generated client-side by `graticule()`; no network request. */
  graticule: 'graticule',
  /** T2: tinted local-relief image, added after first paint by `addRelief()`. */
  relief: 'relief',
} as const;

/** T2 basemap tiles, read from data/basemap-manifest.json (about 1 kB of it is bundled). */
export const BASEMAP_TILES: string = tiles.url;
export const BASEMAP_MINZOOM: number = tiles.minzoom;
export const BASEMAP_MAXZOOM: number = tiles.maxzoom;
export const BASEMAP_ATTRIBUTION: string = basemapAttribution;

/** T2 source-layers inside the basemap tiles. */
export const BASEMAP_LAYER = {
  /** Ocean mask: the world minus land, cut on the z3 tile grid. Painted over territory fills. */
  ocean: 'ocean',
  /** Coastline rings as LineStrings (see `COAST_ATTR`). */
  coast: 'coast',
  /** Lakes, as polygons. Attributes: `name`, `rank`. */
  lakes: 'lakes',
  /** River centrelines. Attributes: `name`, `rank`. */
  rivers: 'rivers',
  /** Sea and ocean label points (polylabel). Attributes: `name`, `kind`, `rank`. */
  marine: 'marine_labels',
} as const;

/**
 * Coastline feature attributes. Water is always on the right of the line
 * (RFC 7946 rings), so a **positive** `line-offset` moves a stroke seaward.
 */
export const COAST_ATTR = {
  /**
   * Geodesic area in km² of the land polygon the ring bounds (holes
   * subtracted, ≥ 1, always present). Waterlines need ≥ `WATERLINE_MIN_KM2`.
   */
  landmassKm2: 'landmass_km2',
} as const;

/** Shared by lakes, rivers and marine points. */
export const FEATURE_ATTR = {
  name: 'name',
  rank: 'rank',
  kind: 'kind',
} as const;

/** Natural Earth `featurecla` value that marks an ocean (vs. sea, bay, gulf…). */
export const MARINE_KIND_OCEAN = 'ocean';

/** T2 relief: one Web Mercator WebP with its image-source corner coordinates. */
export const RELIEF = {
  url: relief.url,
  coordinates: relief.coordinates as [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ],
};

/* ---- Year data (T1) ----------------------------------------------------- */

/**
 * Territory polygons: GeoJSON features with a numeric feature `id` (the index
 * into the year's territory list) and these properties. Polygons are wound
 * per RFC 7946, so a **negative** `line-offset` moves a stroke inward.
 */
export const BORDER_ATTR = {
  /** Wash index 0–11 (Direction A's 12 washes). Anything else draws the fallback wash. */
  wash: 'c',
  /** 1 when the territory is a dependency (colony, protectorate, vassal); absent otherwise. */
  dependency: 'dep',
  /** The direct overlord's territory id (same id space as the feature ids), with `dep`. */
  overlord: 'ov',
  /** The overlord's wash index (0–11), with `dep`, so the tint needs no lookup. */
  overlordWash: 'oc',
} as const;

/** Label and place points share one source; a feature has `n` or `p`. */
export const LABEL_ATTR = {
  /** Territory name. */
  name: 'n',
  /** Territory area of the largest part, in km² (rounded). */
  area: 'a',
  /** Place name. */
  place: 'p',
  /** Place class: `city`, or `PLACE_KIND_SITE` for an archaeological site. */
  placeKind: 'k',
} as const;

/** T1 publishes `a` in km² already. */
export const AREA_TO_KM2 = 1;
export const PLACE_KIND_SITE = 'site';

/** Feature-state keys set on `SOURCE.borders` features by `setSelection()`. */
export const FEATURE_STATE = {
  /** The selected territory. */
  selected: 'selected',
  /** A dependency of the selected territory (its `ov` is the selected id). */
  overlordSelected: 'overlordSelected',
} as const;

/**
 * T1 per-year capitals, `public/data/context/<year>.capitals.<hash>.json`
 * (URLs in data/historical-capitals.json): points within 50 km of their territory.
 */
export const CAPITAL_ATTR = {
  /** English label of the capital. */
  name: 'name',
  /** Territory id in the same year's id space as `SOURCE.borders`. */
  territory: 't',
  /** Wikidata item of the capital. Not drawn; carried for the panel. */
  qid: 'qid',
} as const;

/* ---- Glyphs and fontstacks (T3) ------------------------------------------ */

/**
 * `glyphs.url` from data/map-fonts.json. It is pinned here rather than
 * imported because the manifest's `glyphs` key is 31 kB of per-face data the
 * map does not need; `style.test.ts` fails if the two ever differ.
 */
export const GLYPHS_URL = '/glyphs/4085cf4e0756/{fontstack}/{range}.pbf';

/** Map-page CSS that names faces after each fontstack (combining-mark clusters). */
export const MAP_ALIASES_CSS = '/fonts/map-aliases.css';
/** Load only while Projector text is on. */
export const PROJECTOR_CSS = '/fonts/projector.css';

/**
 * T3's published fontstacks (docs/FONTS.md), each used as a single-element
 * `text-font` array. Fallback scripts are merged into every stack.
 */
export const FONTSTACK = {
  /** State names. */
  stateMedium: 'Alegreya SC Medium',
  /** State names above 250,000 km², and the selected territory. */
  stateBold: 'Alegreya SC Bold',
  /** Sea and ocean names. */
  seaItalic: 'Alegreya Medium Italic',
  /** River names, and archaeological-site names (owner: ruins take an italic label). */
  riverItalic: 'Alegreya Italic',
  /** City and capital names. */
  city: 'Alegreya Regular',
  /** Projector text: water, cities and small labels (Atkinson has no italic stack). */
  projectorMedium: 'Atkinson Hyperlegible Next Medium',
  /** Projector text: state names, uppercase plus tracking. */
  projectorBold: 'Atkinson Hyperlegible Next Bold',
} as const;

/* ---- Images registered at runtime --------------------------------------- */

export const MARKER = {
  city: 'hb-city',
  /** Atlas star-in-circle. */
  capital: 'hb-capital',
  /** ∴, the conventional mark for ruins. */
  site: 'hb-site',
  /** Dependency hatch tile, one per wash: `${hatchPrefix}${0..11}`, plus `${hatchPrefix}x` for an unknown wash. */
  hatchPrefix: 'hb-hatch-',
} as const;

/* ---- Layer ids ----------------------------------------------------------- */

/** Layer ids, in draw order (plan §2.1). Relief is inserted before `edgeBand`. */
export const LAYER = {
  land: 'land',
  territoryFill: 'territory-fill',
  dependencyHatch: 'dependency-hatch',
  edgeBand: 'territory-band',
  selectedBand: 'selected-band',
  border: 'territory-border',
  selectedLine: 'selected-line',
  ocean: 'ocean',
  graticule: 'graticule',
  waterline: (i: number) => `waterline-${i}`,
  coast: 'coast',
  lakes: 'lakes',
  lakeShore: 'lake-shore',
  rivers: 'rivers',
  riverLabels: 'river-labels',
  seaLabels: 'sea-labels',
  places: 'places',
  capitals: 'capitals',
  selectedCapital: 'selected-capital',
  stateLabels: 'state-labels',
  /** Icon-only mark for the selected capital, drawn above everything and never blocking labels. */
  selectedCapitalMark: 'selected-capital-mark',
  relief: 'relief',
} as const;

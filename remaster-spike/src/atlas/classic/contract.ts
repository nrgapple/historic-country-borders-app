/**
 * The data contract between the Classic-atlas style (T6) and the tracks that
 * produce its inputs: T1 (year files), T2 (basemap tiles and relief) and T3
 * (glyph fontstacks). Every source id, source-layer, attribute name, URL and
 * fontstack the style reads is named here and nowhere else, so integrating a
 * track's real output is a one-line change in this file.
 *
 * Values marked STAND-IN point at assets built by `scripts/build-standins.mjs`
 * from the design spike's prepared data (`design/living-atlas/data/`). They
 * follow the same contract, so swapping them changes no other code.
 */

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

/** T2 basemap tiles. STAND-IN: swap to `/basemap/{z}/{x}/{y}.pbf` when T2 lands. */
export const BASEMAP_TILES = '/basemap-standin/{z}/{x}/{y}.pbf';
export const BASEMAP_MAXZOOM = 5;

/** T2 source-layers inside the basemap tiles. */
export const BASEMAP_LAYER = {
  /** Ocean mask: the world minus land, in 30° cells. Painted over territory fills. */
  ocean: 'ocean',
  /** Coastline rings as LineStrings (see `COAST_ATTR`). */
  coast: 'coast',
  /** Lakes, as polygons. Attributes: `name`, `rank`. */
  lakes: 'lakes',
  /** River centrelines. Attributes: `name`, `rank`. */
  rivers: 'rivers',
  /** Sea and ocean label points (polylabel). Attributes: `name`, `kind`, `rank`. */
  marine: 'marine',
} as const;

/**
 * Coastline feature attributes. Ring winding follows RFC 7946 (land on the
 * left in lon/lat), so a **positive** `line-offset` moves a stroke seaward.
 */
export const COAST_ATTR = {
  /**
   * Area in km² enclosed by the ring: the landmass for an outer ring, the
   * enclosed water body for a hole. Waterlines need ≥ `WATERLINE_MIN_KM2`.
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

/** T2 relief image. STAND-IN: swap the URL when T2 publishes its WebP. */
export const RELIEF = {
  url: '/relief-standin/relief.webp',
  /** Web Mercator image; its corners span 180°W–180°E at these latitudes. */
  north: 76,
  south: -58,
} as const;

/* ---- Year data (T1) ----------------------------------------------------- */

/**
 * Territory polygons: GeoJSON features with a numeric feature `id` (the index
 * into the year's territory list) and these properties. Polygons are wound
 * per RFC 7946, so a **negative** `line-offset` moves a stroke inward.
 */
export const BORDER_ATTR = {
  /** Wash index. 0–29 (legacy colour slots, folded onto 12 washes) or 30 = unknown. */
  wash: 'c',
  /** 1 when the territory is a dependency (colony, protectorate, vassal); absent or 0 otherwise. */
  dependency: 'dep',
  /** The overlord's territory id (same id space as the feature ids) for a dependency. */
  overlord: 'ov',
  /** The overlord's wash index (same scale as `wash`), so the tint needs no lookup. */
  overlordWash: 'ovc',
} as const;

/** Label and place points share one source; a feature has `n` or `p`. */
export const LABEL_ATTR = {
  /** Territory name. */
  name: 'n',
  /** Territory area, in the unit given by `AREA_TO_KM2`. */
  area: 'a',
  /** Place (city) name. */
  place: 'p',
  /** Optional place class; `PLACE_KIND_SITE` marks an archaeological site (T1). */
  placeKind: 'k',
} as const;

/** The spike's year files carry the source `AREA` in m². Set to 1 if T1 emits km². */
export const AREA_TO_KM2 = 1e-6;
export const PLACE_KIND_SITE = 'site';

/** Feature-state keys set on `SOURCE.borders` features by `setSelection()`. */
export const FEATURE_STATE = {
  /** The selected territory. */
  selected: 'selected',
  /** A dependency of the selected territory (its `ov` is the selected id). */
  overlordSelected: 'overlordSelected',
} as const;

/**
 * T1 per-year capitals: GeoJSON points, one per territory that has a known
 * capital in that year. STAND-IN: the spike's year manifest gains a
 * `capitals` URL built from a hand-made table (`scripts/standin-metadata.mjs`).
 */
export const CAPITAL_ATTR = {
  name: 'name',
  /** Territory id in the same year's id space as `SOURCE.borders`. */
  territory: 'tid',
  /** Wikidata QID of the place, or null. Not drawn; carried for the panel. */
  qid: 'qid',
} as const;

/* ---- Glyphs and fontstacks (T3) ------------------------------------------ */

/** STAND-IN: swap to `/glyphs/{fontstack}/{range}.pbf` when T3 lands. */
export const GLYPHS_URL = '/glyphs-standin/{fontstack}/{range}.pbf';

/** Every map fontstack, named as in plan §5. T3 must publish each directory. */
export const FONTSTACK = {
  stateMedium: 'Alegreya SC Medium',
  stateBold: 'Alegreya SC Bold',
  seaItalic: 'Alegreya Medium Italic',
  riverItalic: 'Alegreya Italic',
  city: 'Alegreya Regular',
  projectorMedium: 'Atkinson Hyperlegible Next Medium',
  projectorBold: 'Atkinson Hyperlegible Next Bold',
} as const;

/* ---- Images registered at runtime --------------------------------------- */

export const MARKER = {
  city: 'hb-city',
  /** Atlas star-in-circle. */
  capital: 'hb-capital',
  /** ∴, the conventional mark for ruins. */
  site: 'hb-site',
  /** Dependency hatch tile, one per wash: `${hatchPrefix}${0..11}`, plus `${hatchPrefix}x` for unknown. */
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

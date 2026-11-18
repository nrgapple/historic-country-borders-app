/**
 * The Pennsylvania school-district map (P5), in either map style: Direction
 * A's paper and ink, or Direction B's textbook pastels (the page default;
 * see src/atlas/theme.ts). Both styles have the same layers in the same
 * order, so a switch only sets paint and layout (`applyPaOptions`).
 *
 * Sources:
 * - `pa-basemap`: T8's street basemap (docs/PA_BASEMAP.md), z0–12 with z14
 *   streets folded into z12, through the `pa-tiles://` protocol so MapLibre
 *   only fetches tiles that exist (paMap.ts).
 * - `districts`: the 500 PASDA districts as vector tiles (`c` = wash index,
 *   feature id = index into the district list), also through the protocol.
 * - `district-labels`: one point per district, set from the property index.
 * - `piaa-labels`: one point per PIAA district (I–XII), shown while the
 *   districts are coloured by PIAA district.
 *
 * "Colour districts by" (src/pa/colourBy.ts) swaps the district fill, its
 * edge band and the names' second line; the default keeps the washes.
 *
 * Draw order: paper → district washes → water → streets → county and state
 * lines → district edge bands, borders and selection → street, water and
 * place names → district names. District names are last, so they claim
 * space first; the selected district's name is never dropped.
 */
import type {
  ExpressionSpecification,
  LayerSpecification,
  Map as MapLibreMap,
  StyleSpecification,
} from 'maplibre-gl';
import pa from '../data/pa.json';
import {
  COLOR,
  TEXTBOOK_COLOR,
  TEXTBOOK_LINE_STRONG,
  TEXTBOOK_MAP_ACCENT,
  TEXTBOOK_WASHES,
  WASHES,
  type ThemeId,
} from '../styles/tokens';
import { FONTSTACK, GLYPHS_URL } from '../adapters/glyphs';
import type { Settings } from '../atlas/settings';
import { applyLayerProperties } from '../lib/styleDiff';
import { TEXTBOOK_MARKER } from '../adapters/textbookStyle';
import { districtEdge, districtFill } from './palette';
import {
  edgeColour,
  fillColour,
  hatchImageId,
  NO_FOOTBALL_FILTER,
  SECOND_LINE,
} from './colourBy';

type Expr = ExpressionSpecification;

export const PA_PROTOCOL = 'pa-tiles';

export const PA_SOURCE = {
  basemap: 'pa-basemap',
  districts: 'districts',
  labels: 'district-labels',
  piaaLabels: 'piaa-labels',
} as const;

export const DISTRICT_SOURCE_LAYER = pa.districtTiles.sourceLayer;

export const PA_LAYER = {
  paper: 'paper',
  districtFill: 'district-fill',
  districtHatch: 'district-hatch',
  water: 'water',
  waterLines: 'water-lines',
  roadMinor: 'road-minor',
  roadMajorCasing: 'road-major-casing',
  roadMajor: 'road-major',
  roadHighwayCasing: 'road-highway-casing',
  roadHighway: 'road-highway',
  county: 'county-line',
  state: 'state-line',
  /** Modern textbook: the selection hatch over the district's own tint. */
  selectedHatch: 'district-selected-hatch',
  districtBand: 'district-band',
  /** Modern textbook: a white casing under each district border. */
  districtCasing: 'district-casing',
  districtBorder: 'district-border',
  selectedBand: 'district-selected-band',
  selectedLine: 'district-selected-line',
  roadLabels: 'road-labels',
  streetLabels: 'street-labels',
  streams: 'streams',
  highwayRefs: 'highway-refs',
  waterLabels: 'water-labels',
  waterPoints: 'water-points',
  neighbourhoods: 'neighbourhood-labels',
  villages: 'village-labels',
  towns: 'town-labels',
  cities: 'city-labels',
  regions: 'region-labels',
  districtLabels: 'district-labels',
  piaaLabels: 'piaa-labels',
} as const;

/** Layers a click can select. */
export const PA_INTERACTIVE_LAYERS = [PA_LAYER.districtFill];

/** Pennsylvania with a margin: [[west, south], [east, north]]. */
export const PA_BOUNDS: [[number, number], [number, number]] = [
  [-80.6, 39.7],
  [-74.7, 42.3],
];
/**
 * MapLibre raises the zoom until the whole viewport fits inside maxBounds, so
 * on a tall 390 × 844 phone the bounds must span about 35° N–46.5° N for
 * PA_BOUNDS to fit (zoom ≈ 5.3); the margin also covers 320 px phones. These
 * are also T8's outer basemap bounds (z0–8).
 */
export const PA_MAX_BOUNDS: [[number, number], [number, number]] = [
  [pa.basemap.bounds[0], pa.basemap.bounds[1]],
  [pa.basemap.bounds[2], pa.basemap.bounds[3]],
];
export const PA_MIN_ZOOM = 4.5;
/** z12 street tiles overzoom cleanly to z15 (one tile unit per pixel). */
export const PA_MAX_ZOOM = 15;

export const BASEMAP_ATTRIBUTION = pa.basemap.attribution;
export const DISTRICT_ATTRIBUTION =
  'Districts: <a href="https://www.pasda.psu.edu/" target="_blank" rel="noreferrer">PASDA / PennDOT</a>';

/* ---- Palette (each theme's tokens; nothing new in CSS) -------------------- */

/** Per-channel sRGB mix of two #RRGGBB colours; `t` is the share of `b`. */
export const mix = (a: string, b: string, t: number) => {
  const pa2 = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa2
    .map((v, i) =>
      Math.round(v + (pb[i] - v) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
};

export interface PaColors {
  paper: string;
  water: string;
  waterLine: string;
  waterInk: string;
  minorRoad: string;
  majorCasing: string;
  majorFill: string;
  highwayCasing: string;
  highwayFill: string;
  /** Highway route numbers ("I 76"). */
  highwayInk: string;
  county: string;
  state: string;
  border: string;
  accent: string;
  selectedFill: string;
  selectedInk: string;
  ink: string;
  ink2: string;
  halo: string;
}

const CLASSIC_COLORS: PaColors = {
  paper: COLOR.land,
  water: COLOR.water,
  waterLine: '#7FA3A3',
  waterInk: COLOR.waterInk,
  /** Residential streets: a sepia hairline. */
  minorRoad: mix(COLOR.ink2, COLOR.land, 0.45),
  majorCasing: COLOR.ink2,
  majorFill: COLOR.sheet,
  /** Highways in gamboge, the old road-atlas yellow; madder stays the selection. */
  highwayCasing: WASHES[2].edge,
  highwayFill: WASHES[2].fill,
  highwayInk: WASHES[2].edge,
  county: COLOR.ink2,
  state: COLOR.ink,
  border: COLOR.ink,
  accent: '#8B2A2A',
  selectedFill: COLOR.selectedFill,
  selectedInk: COLOR.selectedInk,
  ink: COLOR.ink,
  ink2: COLOR.ink2,
  halo: 'rgba(247, 240, 222, 0.92)',
};

/**
 * Modern textbook: a crisp present-day street map. White streets with cool
 * grey casings, sunflower highways, light-blue water, and the district
 * pastels thin enough that every street name stays readable.
 */
const TEXTBOOK_COLORS: PaColors = {
  paper: '#F7F6F2',
  water: TEXTBOOK_COLOR.water,
  waterLine: '#6FAFD0',
  waterInk: TEXTBOOK_COLOR.waterInk,
  minorRoad: '#B4BEC8',
  majorCasing: TEXTBOOK_LINE_STRONG,
  majorFill: '#FFFFFF',
  highwayCasing: TEXTBOOK_WASHES[2].edge,
  highwayFill: TEXTBOOK_WASHES[2].fill,
  // The sunflower edge is 3.9:1 on white; route numbers use a darker cut.
  highwayInk: '#7A5E0E',
  county: TEXTBOOK_COLOR.ink2,
  state: TEXTBOOK_COLOR.ink,
  border: TEXTBOOK_COLOR.ink,
  accent: TEXTBOOK_MAP_ACCENT,
  selectedFill: TEXTBOOK_COLOR.selectedFill,
  selectedInk: TEXTBOOK_MAP_ACCENT,
  ink: TEXTBOOK_COLOR.ink,
  ink2: TEXTBOOK_COLOR.ink2,
  halo: 'rgba(255, 255, 255, 0.95)',
};

export const paColors = (theme: ThemeId): PaColors =>
  theme === 'textbook' ? TEXTBOOK_COLORS : CLASSIC_COLORS;

/** The Classic palette (kept for callers that predate the second theme). */
export const PA_COLOR = CLASSIC_COLORS;

/* ---- Options ------------------------------------------------------------- */

export interface PaStyleOptions {
  settings: Settings;
  /** Selected district id (feature id and label `id`), or null. */
  selectedId: number | null;
  /** Map style; Classic when omitted. */
  theme?: ThemeId;
}

const themeOf = (o: PaStyleOptions): ThemeId => o.theme ?? 'classic';
const textbook = (o: PaStyleOptions) => themeOf(o) === 'textbook';

const isSelected: Expr = ['boolean', ['feature-state', 'selected'], false];
const zoom: Expr = ['zoom'];
const round = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const ramp = (...stops: number[]): Expr =>
  ['interpolate', ['linear'], zoom, ...stops] as unknown as Expr;
const font = (stack: string): Expr => ['literal', [stack]];

const TEXT_SCALE = { small: 0.9, medium: 1, large: 1.3 } as const;
/** No label below 13 px at any setting (T6's projector legibility floor). */
const MIN_LABEL_PX = 13;

const scaleOf = (s: Settings) =>
  (TEXT_SCALE[s.textSize] ?? 1) * (s.projectorText ? 1.1 : 1);
const size = (s: Settings, px: number) =>
  round(Math.max(MIN_LABEL_PX, px * scaleOf(s)));

const fonts = (s: Settings, theme: ThemeId = 'classic') =>
  s.projectorText || theme === 'textbook'
    ? {
        districts: FONTSTACK.projectorMedium,
        selected: FONTSTACK.projectorBold,
        city: FONTSTACK.projectorBold,
        town: FONTSTACK.projectorMedium,
        place: FONTSTACK.projectorMedium,
        // Modern textbook sets water in Literata Italic, unless Projector text.
        italic:
          theme === 'textbook' && !s.projectorText
            ? FONTSTACK.textbookItalic
            : FONTSTACK.projectorMedium,
        street: FONTSTACK.projectorMedium,
      }
    : {
        districts: FONTSTACK.stateMedium,
        selected: FONTSTACK.stateBold,
        // Settlements in roman type, so they never read as district names.
        city: FONTSTACK.city,
        town: FONTSTACK.city,
        place: FONTSTACK.city,
        italic: FONTSTACK.riverItalic,
        street: FONTSTACK.city,
      };

/**
 * The mock's 62 % wash at the default 0.7, then halved so streets read
 * through. B's pastels are brighter, so they are thinned a little more.
 */
export const districtFillOpacity = (s: Settings, theme: ThemeId = 'classic') =>
  round(
    clamp(s.countryOpacity, 0.1, 1) *
      (0.62 / 0.7) *
      (theme === 'textbook' ? 0.5 : 0.55),
  );

/**
 * A data colouring must read at a glance, so it is drawn stronger: 0.8 at the
 * default setting. Streets, water and names are drawn above it.
 */
export const thematicFillOpacity = (s: Settings) =>
  round(clamp(clamp(s.countryOpacity, 0.1, 1) * (0.8 / 0.7), 0.1, 0.92));

const borderWidth = (s: Settings): Expr => {
  const k = clamp(s.borderThickness, 0, 4) / 2;
  return ramp(5, round(0.5 * k), 9, round(1 * k), 13, round(1.8 * k));
};
/** B's white casing under each border. */
const casingWidth = (s: Settings): Expr => {
  const k = clamp(s.borderThickness, 0, 4) / 2;
  return ramp(5, round(1.4 * k), 9, round(2.4 * k), 13, round(3.6 * k));
};
const selectedWidth = (s: Settings): Expr => {
  const k = Math.max(1, clamp(s.borderThickness, 0, 4) / 2);
  const at = (w: number) => ['case', isSelected, round(w * k), 0];
  return ramp(
    5,
    at(1.6) as unknown as number,
    12,
    at(3.2) as unknown as number,
  );
};

const selectedLabel = (o: PaStyleOptions): Expr =>
  ['==', ['get', 'id'], o.selectedId ?? -1] as unknown as Expr;

/**
 * Every paint and layout property that depends on the settings or the
 * selection. `createPaStyle` bakes them in and `applyPaOptions` sets them on
 * a live map, so the two cannot drift.
 */
export const dynamicProperties = (o: PaStyleOptions) => {
  const s = o.settings;
  const theme = themeOf(o);
  const b = textbook(o);
  const c = paColors(theme);
  const f = fonts(s, theme);
  // Modern textbook sets district names in capitals, like its state names.
  const upper = s.textCase === 'upper' || s.projectorText || textbook(o);
  // Zoom must be the outermost input, so the selection is decided per stop.
  const sel = selectedLabel(o);
  const byArea = (small: number, mid: number, large: number) => [
    'step',
    ['get', 'a'],
    size(s, small),
    150,
    size(s, mid),
    400,
    size(s, large),
  ];
  const districtSize = ramp(
    6,
    ['case', sel, size(s, 16), size(s, 13)] as unknown as number,
    9,
    ['case', sel, size(s, 18), byArea(13, 14.5, 16)] as unknown as number,
    11,
    ['case', sel, size(s, 21), byArea(15, 17, 19)] as unknown as number,
  );
  const mode = s.paColourBy;
  const thematic = fillColour(mode, theme);
  const washFill = districtFill(theme);
  const washEdge = districtEdge(theme);
  const second = mode === 'default' ? null : SECOND_LINE[mode];
  // From z8 a coloured map adds the value under each name: "6A", "District III".
  const nameField = second
    ? [
        'step',
        zoom,
        ['format', ['get', 'n'], {}],
        8,
        [
          'format',
          ['get', 'n'],
          {},
          ['case', ['has', second], '\n', ''],
          {},
          ['coalesce', ['get', second], ''],
          { 'font-scale': 0.82 },
        ],
      ]
    : ['get', 'n'];
  return {
    [PA_LAYER.districtFill]: {
      paint: {
        // A data colouring keeps its colour when selected; the outline marks
        // it. A marks a plain selection with its madder wash; B keeps the
        // district's own tint under the selection hatch.
        'fill-color':
          thematic ??
          (b ? washFill : ['case', isSelected, c.selectedFill, washFill]),
        'fill-opacity': thematic
          ? thematicFillOpacity(s)
          : [
              'case',
              isSelected,
              round(
                Math.min(1, districtFillOpacity(s, theme) + (b ? 0.1 : 0.35)),
              ),
              districtFillOpacity(s, theme),
            ],
      },
    },
    [PA_LAYER.districtHatch]: {
      layout: { visibility: mode === 'football' ? 'visible' : 'none' },
    },
    [PA_LAYER.districtBand]: {
      paint: { 'line-color': edgeColour(mode, theme) ?? washEdge },
    },
    [PA_LAYER.piaaLabels]: {
      layout: {
        visibility: mode === 'piaa' ? 'visible' : 'none',
        'text-font': font(f.selected),
        'text-size': ramp(5, size(s, 15), 8, size(s, 22)),
      },
    },
    [PA_LAYER.districtBorder]: {
      paint: {
        'line-width': borderWidth(s),
        // A: an ink line; B: each district's own darker hue (of its data
        // colour while "Colour districts by" is on), over a white casing.
        'line-color': b ? (edgeColour(mode, theme) ?? washEdge) : c.border,
      },
    },
    [PA_LAYER.districtCasing]: {
      paint: { 'line-width': casingWidth(s) },
    },
    [PA_LAYER.selectedLine]: {
      paint: { 'line-width': selectedWidth(s) },
    },
    [PA_LAYER.districtLabels]: {
      layout: {
        visibility: s.showLabels || o.selectedId !== null ? 'visible' : 'none',
        'text-field': nameField,
        'text-font': [
          'case',
          selectedLabel(o),
          font(f.selected),
          font(f.districts),
        ],
        'text-size': districtSize,
        'text-transform': upper ? 'uppercase' : 'none',
        'text-letter-spacing': textbook(o) ? 0.04 : upper ? 0.08 : 0.04,
        'symbol-sort-key': [
          'case',
          selectedLabel(o),
          -1e9,
          ['-', ['get', 'a']],
        ],
      },
      paint: {
        // The madder ink is too dark on a data colouring's darkest steps.
        'text-color': thematic
          ? c.ink
          : ['case', selectedLabel(o), c.selectedInk, c.ink],
        'text-halo-color': c.halo,
        'text-halo-width': textbook(o) ? 2 : 1.8,
      },
      // Without "show labels" only the selected district keeps its name.
      filter: s.showLabels ? null : selectedLabel(o),
    },
    [PA_LAYER.roadLabels]: {
      layout: {
        'text-font': font(f.street),
        'text-size': ramp(12, size(s, 13), 15, size(s, 15)),
      },
    },
    [PA_LAYER.streetLabels]: {
      layout: {
        'text-font': font(f.street),
        'text-size': ramp(13, size(s, 13), 15, size(s, 14)),
      },
    },
    [PA_LAYER.highwayRefs]: {
      layout: { 'text-font': font(f.town), 'text-size': size(s, 13) },
    },
    [PA_LAYER.waterLabels]: {
      layout: { 'text-font': font(f.italic), 'text-size': size(s, 13) },
    },
    [PA_LAYER.waterPoints]: {
      layout: { 'text-font': font(f.italic), 'text-size': size(s, 14) },
    },
    [PA_LAYER.neighbourhoods]: {
      layout: { 'text-font': font(f.italic), 'text-size': size(s, 13) },
    },
    [PA_LAYER.villages]: {
      layout: {
        'text-font': font(f.place),
        'text-size': ramp(10, size(s, 13), 14, size(s, 15)),
      },
    },
    [PA_LAYER.towns]: {
      layout: {
        'text-font': font(f.town),
        'text-size': ramp(9, size(s, 13), 13, size(s, 16)),
      },
    },
    [PA_LAYER.cities]: {
      layout: {
        'text-font': font(f.city),
        'text-size': ramp(6, size(s, 13), 12, size(s, 18)),
      },
    },
    [PA_LAYER.regions]: {
      layout: { 'text-font': font(f.city), 'text-size': size(s, 14) },
    },
  } as Record<
    string,
    {
      paint?: Record<string, unknown>;
      layout?: Record<string, unknown>;
      filter?: unknown;
    }
  >;
};

const bm = (sourceLayer: string) => ({
  source: PA_SOURCE.basemap,
  'source-layer': sourceLayer,
});
const dist = {
  source: PA_SOURCE.districts,
  'source-layer': DISTRICT_SOURCE_LAYER,
};
const kind = (...kinds: string[]): Expr =>
  ['in', ['get', 'kind'], ['literal', kinds]] as unknown as Expr;
const detail = (...details: string[]): Expr =>
  ['in', ['get', 'kind_detail'], ['literal', details]] as unknown as Expr;
/** Protomaps' suggested zoom for a place (512 px tiles), one level early. */
const placeVisible: Expr = [
  '<=',
  ['get', 'min_zoom'],
  ['+', zoom, 1],
] as unknown as Expr;
export function paLayers(o: PaStyleOptions): LayerSpecification[] {
  const theme = themeOf(o);
  const PA_COLOR = paColors(theme);
  const b = textbook(o);
  const vis = (on: boolean) => (on ? 'visible' : 'none');
  const halo = {
    'text-halo-color': PA_COLOR.halo,
    'text-halo-width': b ? 1.8 : 1.6,
    'text-halo-blur': b ? 0 : 0.4,
  };
  const washFill = districtFill(theme);
  const washEdge = districtEdge(theme);
  const layers: Array<Record<string, unknown>> = [
    {
      id: PA_LAYER.paper,
      type: 'background',
      paint: { 'background-color': PA_COLOR.paper },
    },
    {
      id: PA_LAYER.districtFill,
      type: 'fill',
      ...dist,
    },
    {
      // "No PIAA football" while coloured by football class.
      id: PA_LAYER.districtHatch,
      type: 'fill',
      ...dist,
      filter: NO_FOOTBALL_FILTER,
      paint: { 'fill-pattern': hatchImageId(theme) },
    },
    {
      id: PA_LAYER.selectedHatch,
      type: 'fill',
      ...dist,
      layout: { visibility: vis(b) },
      paint: {
        'fill-pattern': TEXTBOOK_MARKER.selectedHatch,
        // Feature-state, not a filter: a selection never re-tiles the
        // districts. Lighter than on the world map: a selected district
        // fills the screen at street zoom and its streets must stay legible.
        'fill-opacity': ['case', isSelected, 0.4, 0],
      },
    },
    {
      id: PA_LAYER.water,
      type: 'fill',
      ...bm('water'),
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': PA_COLOR.water },
    },
    {
      id: PA_LAYER.streams,
      type: 'line',
      ...bm('water'),
      minzoom: 11,
      filter: [
        'all',
        ['==', ['geometry-type'], 'LineString'],
        ['!', kind('river', 'canal')],
      ],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': PA_COLOR.waterLine,
        'line-width': ramp(11, 0.3, 15, 1.2),
      },
    },
    {
      id: PA_LAYER.waterLines,
      type: 'line',
      ...bm('water'),
      filter: [
        'all',
        ['==', ['geometry-type'], 'LineString'],
        kind('river', 'canal'),
      ],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': PA_COLOR.waterLine,
        'line-width': ramp(8, 0.6, 14, 2.2),
      },
    },
    {
      id: PA_LAYER.roadMinor,
      type: 'line',
      ...bm('roads'),
      minzoom: 11,
      filter: kind('minor_road'),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': PA_COLOR.minorRoad,
        'line-width': ramp(11, 0.35, 13, 0.8, 15, 2.4),
        'line-opacity': ramp(11, 0.5, 12.5, 1),
      },
    },
    {
      id: PA_LAYER.roadMajorCasing,
      type: 'line',
      ...bm('roads'),
      minzoom: 10,
      filter: kind('major_road'),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': PA_COLOR.majorCasing,
        'line-width': ramp(10, 1.2, 13, 2.6, 15, 6),
        'line-opacity': 0.85,
      },
    },
    {
      id: PA_LAYER.roadMajor,
      type: 'line',
      ...bm('roads'),
      filter: kind('major_road'),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': [
          'step',
          zoom,
          PA_COLOR.majorCasing,
          10,
          PA_COLOR.majorFill,
        ],
        'line-width': ramp(6, 0.4, 10, 0.7, 13, 1.6, 15, 4.2),
        'line-opacity': ramp(6, 0.45, 9, 0.75, 10, 1),
      },
    },
    {
      id: PA_LAYER.roadHighwayCasing,
      type: 'line',
      ...bm('roads'),
      filter: kind('highway'),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': PA_COLOR.highwayCasing,
        'line-width': ramp(5, 1, 9, 2.2, 13, 4, 15, 8),
      },
    },
    {
      id: PA_LAYER.roadHighway,
      type: 'line',
      ...bm('roads'),
      filter: ['all', kind('highway'), ['!', detail('motorway_link')]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': PA_COLOR.highwayFill,
        'line-width': ramp(5, 0.4, 9, 1.2, 13, 2.6, 15, 5.6),
      },
    },
    {
      id: PA_LAYER.county,
      type: 'line',
      ...bm('boundaries'),
      minzoom: 6,
      filter: kind('county'),
      paint: {
        'line-color': PA_COLOR.county,
        'line-width': ramp(6, 0.5, 12, 1.2),
        'line-dasharray': [4, 2],
        'line-opacity': 0.55,
      },
    },
    {
      id: PA_LAYER.state,
      type: 'line',
      ...bm('boundaries'),
      filter: kind('region'),
      paint: {
        'line-color': PA_COLOR.state,
        'line-width': ramp(4, 1, 10, 2.2),
        'line-dasharray': [5, 2, 1, 2],
        'line-opacity': 0.75,
      },
    },
    {
      // Grenzkolorit: a soft band of each district's darker pigment inside its border.
      id: PA_LAYER.districtBand,
      type: 'line',
      ...dist,
      minzoom: 7,
      layout: { 'line-join': 'round', visibility: vis(!b) },
      paint: {
        'line-width': ramp(7, 2, 12, 6),
        // Tile rings (geojson-vt via vt-pbf) put the inside on the right: positive is inward.
        'line-offset': ramp(7, 1, 12, 3),
        'line-opacity': 0.45,
        'line-blur': 1.5,
      },
    },
    {
      id: PA_LAYER.selectedBand,
      type: 'line',
      ...dist,
      layout: { 'line-join': 'round', visibility: vis(!b) },
      paint: {
        'line-color': PA_COLOR.accent,
        'line-width': ramp(5, 4, 12, 12),
        'line-offset': ramp(5, 2, 12, 6),
        'line-opacity': ['case', isSelected, 0.38, 0],
      },
    },
    {
      id: PA_LAYER.districtCasing,
      type: 'line',
      ...dist,
      layout: { 'line-join': 'round', visibility: vis(b) },
      paint: { 'line-color': '#FFFFFF' },
    },
    {
      // A: an ink line; B: the district's own darker hue over the white casing.
      id: PA_LAYER.districtBorder,
      type: 'line',
      ...dist,
      layout: { 'line-join': 'round' },
      paint: { 'line-opacity': b ? 0.9 : 0.75 },
    },
    {
      id: PA_LAYER.selectedLine,
      type: 'line',
      ...dist,
      layout: { 'line-join': 'round' },
      paint: { 'line-color': PA_COLOR.accent },
    },
    {
      id: PA_LAYER.streetLabels,
      type: 'symbol',
      ...bm('roads'),
      minzoom: 13.5,
      filter: ['all', ['has', 'name'], kind('minor_road')],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['get', 'name'],
        'text-max-angle': 30,
        'text-padding': 2,
        'symbol-spacing': 280,
      },
      paint: { 'text-color': PA_COLOR.ink2, ...halo },
    },
    {
      id: PA_LAYER.roadLabels,
      type: 'symbol',
      ...bm('roads'),
      minzoom: 11,
      filter: ['all', ['has', 'name'], kind('highway', 'major_road')],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['get', 'name'],
        'text-max-angle': 30,
        'text-padding': 2,
        'symbol-spacing': 320,
      },
      paint: { 'text-color': PA_COLOR.ink2, ...halo },
    },
    {
      id: PA_LAYER.highwayRefs,
      type: 'symbol',
      ...bm('roads'),
      minzoom: 8,
      maxzoom: 13.5,
      filter: ['all', kind('highway'), ['has', 'ref']],
      layout: {
        'symbol-placement': 'line',
        // OSM joins concurrent routes with ";" ("I 99;US 220"): print the first.
        'text-field': [
          'let',
          'cut',
          ['index-of', ';', ['get', 'ref']],
          [
            'case',
            ['>', ['var', 'cut'], 0],
            ['slice', ['get', 'ref'], 0, ['var', 'cut']],
            ['get', 'ref'],
          ],
        ],
        'text-rotation-alignment': 'viewport',
        'symbol-spacing': 420,
        'text-padding': 6,
      },
      paint: { 'text-color': PA_COLOR.highwayInk, ...halo },
    },
    {
      id: PA_LAYER.waterLabels,
      type: 'symbol',
      ...bm('water'),
      minzoom: 9,
      filter: ['all', ['has', 'name'], ['==', ['geometry-type'], 'LineString']],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['get', 'name'],
        'text-letter-spacing': 0.06,
        'symbol-spacing': 360,
      },
      paint: { 'text-color': PA_COLOR.waterInk, ...halo },
    },
    {
      id: PA_LAYER.waterPoints,
      type: 'symbol',
      ...bm('water'),
      minzoom: 8,
      filter: ['all', ['has', 'name'], ['==', ['geometry-type'], 'Point']],
      layout: {
        'text-field': ['get', 'name'],
        'text-letter-spacing': 0.06,
        'text-max-width': 8,
      },
      paint: { 'text-color': PA_COLOR.waterInk, ...halo },
    },
    {
      id: PA_LAYER.neighbourhoods,
      type: 'symbol',
      ...bm('places'),
      minzoom: 12.5,
      filter: kind('neighbourhood'),
      layout: { 'text-field': ['get', 'name'], 'text-max-width': 8 },
      paint: { 'text-color': PA_COLOR.ink2, ...halo },
    },
    {
      id: PA_LAYER.villages,
      type: 'symbol',
      ...bm('places'),
      minzoom: 10,
      filter: [
        'all',
        kind('locality'),
        detail('village', 'hamlet', 'suburb', 'quarter'),
        placeVisible,
      ],
      layout: { 'text-field': ['get', 'name'], 'text-max-width': 8 },
      paint: { 'text-color': PA_COLOR.ink2, ...halo },
    },
    {
      id: PA_LAYER.towns,
      type: 'symbol',
      ...bm('places'),
      // District names lead the state view; towns join from z9.
      minzoom: 9,
      filter: ['all', kind('locality'), detail('town'), placeVisible],
      layout: {
        'text-field': ['get', 'name'],
        'text-max-width': 8,
      },
      paint: { 'text-color': PA_COLOR.ink2, ...halo },
    },
    {
      id: PA_LAYER.cities,
      type: 'symbol',
      ...bm('places'),
      filter: ['all', kind('locality'), detail('city'), placeVisible],
      layout: {
        'text-field': ['get', 'name'],
        'text-max-width': 8,
        // A: roman capitals, spaced (the atlas convention); B: bold sans.
        'text-transform': b ? 'none' : 'uppercase',
        'text-letter-spacing': b ? 0.02 : 0.12,
      },
      paint: { 'text-color': b ? PA_COLOR.ink : PA_COLOR.ink2, ...halo },
    },
    {
      id: PA_LAYER.regions,
      type: 'symbol',
      ...bm('places'),
      maxzoom: 7.5,
      filter: kind('region'),
      layout: {
        'text-field': ['get', 'name'],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.24,
      },
      paint: { 'text-color': PA_COLOR.ink2, 'text-opacity': 0.75, ...halo },
    },
    {
      id: PA_LAYER.districtLabels,
      type: 'symbol',
      source: PA_SOURCE.labels,
      minzoom: 6.5,
      layout: {
        'text-max-width': 7,
        'text-padding': 4,
      },
    },
    {
      // Last, so the region numbers claim their space before district names.
      id: PA_LAYER.piaaLabels,
      type: 'symbol',
      source: PA_SOURCE.piaaLabels,
      maxzoom: 9,
      layout: {
        // The state view on a phone fits only the numerals: "III".
        'text-field': ['step', zoom, ['get', 'r'], 6.5, ['get', 'n']],
        'text-letter-spacing': 0.08,
        'text-padding': 2,
      },
      paint: {
        'text-color': PA_COLOR.ink,
        'text-halo-color': PA_COLOR.halo,
        'text-halo-width': 2.2,
      },
    },
  ];
  const dynamic = dynamicProperties(o);
  return layers.map((layer) => {
    const extra = dynamic[layer.id as string];
    if (!extra) return layer as unknown as LayerSpecification;
    const out: Record<string, unknown> = {
      ...layer,
      paint: { ...(layer.paint as object), ...extra.paint },
      layout: { ...(layer.layout as object), ...extra.layout },
    };
    if (extra.filter) out.filter = extra.filter;
    return out as unknown as LayerSpecification;
  });
}

export const basemapTileUrl = `${PA_PROTOCOL}://basemap/{z}/{x}/{y}`;
export const districtTileUrl = `${PA_PROTOCOL}://districts/{z}/{x}/{y}`;

/** The whole PA style; the label source starts empty until the index loads. */
export function createPaStyle(
  origin: string,
  o: PaStyleOptions,
): StyleSpecification {
  return {
    version: 8,
    name: `Historic Borders: Pennsylvania school districts (${textbook(o) ? 'Modern textbook' : 'Classic atlas'})`,
    glyphs: `${origin}${GLYPHS_URL}`,
    sources: {
      [PA_SOURCE.basemap]: {
        type: 'vector',
        tiles: [basemapTileUrl],
        minzoom: pa.basemap.minzoom,
        maxzoom: pa.basemap.maxzoom,
        bounds: pa.basemap.bounds as [number, number, number, number],
        attribution: BASEMAP_ATTRIBUTION,
      },
      [PA_SOURCE.districts]: {
        type: 'vector',
        tiles: [districtTileUrl],
        minzoom: pa.districtTiles.minzoom,
        maxzoom: pa.districtTiles.maxzoom,
        bounds: [
          PA_BOUNDS[0][0],
          PA_BOUNDS[0][1],
          PA_BOUNDS[1][0],
          PA_BOUNDS[1][1],
        ],
        attribution: DISTRICT_ATTRIBUTION,
      },
      [PA_SOURCE.labels]: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      },
      [PA_SOURCE.piaaLabels]: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      },
    },
    layers: paLayers(o),
  };
}

/**
 * Applies the theme, settings and the selected label to a live map without
 * re-tiling: every layer's paint, layout and filter for `o`, resetting what
 * only the other theme sets (src/lib/styleDiff.ts).
 */
export function applyPaOptions(map: MapLibreMap, o: PaStyleOptions) {
  const other: ThemeId = textbook(o) ? 'classic' : 'textbook';
  applyLayerProperties(map, paLayers(o), [paLayers({ ...o, theme: other })]);
  // A built layer has no filter key when none applies; clear it explicitly.
  for (const [id, props] of Object.entries(dynamicProperties(o)))
    if ('filter' in props && map.getLayer(id))
      map.setFilter(id, (props.filter ?? null) as never);
}

/** Every fontstack the style can request (for T3's checkStyleFontstacks). */
export const paFontstacks = (s: Settings, theme: ThemeId = 'classic') => [
  ...new Set(Object.values(fonts(s, theme))),
];

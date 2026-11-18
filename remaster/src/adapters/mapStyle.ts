/**
 * T6 ADAPTER: the Classic-atlas MapLibre style (plan §2.1, Direction A).
 *
 * The controller (src/atlas/mapController.ts) depends only on the exports of
 * this module: `createStyle`, `applyDynamic`, `addRelief`, `addMarkerImage`,
 * `SOURCE`, `LAYER`, `INTERACTIVE_LAYERS` and `LEGEND`.
 *
 * STAND-IN: a direct port of the design mock (design/living-atlas/
 * a-classic-atlas.html): the 12 washes with edge bands, the madder selection
 * band and line, the ocean mask painted over the fills, the toned-down
 * waterline rule, graticule, Alegreya SC state names sized by log10(area),
 * the selected name always drawn, and cities as icon+text symbols.
 *
 * SWITCH when T6 lands: re-export T6's module here, keeping these names
 * (`export { createStyle, applyDynamic, … } from '…/classic'`), or adapt its
 * API in this one file. T6 owns the cartography; the app owns the data flow.
 */
import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  Map as MapLibreMap,
  StyleSpecification,
} from 'maplibre-gl';
import type { Settings } from '../atlas/settings';
import { COLOR, ERA_TINTS, FALLBACK_WASH, WASHES } from '../styles/tokens';
import {
  BASEMAP_ATTRIBUTION,
  BASEMAP_LAYER,
  BASEMAP_MAXZOOM,
  BASEMAP_TILES,
  COAST_LANDMASS_KM2,
  RELIEF,
} from './basemap';
import { FONTSTACK, GLYPHS_URL } from './glyphs';

export const SOURCE = {
  basemap: 'basemap',
  borders: 'borders',
  labels: 'labels',
  capitals: 'capitals',
  graticule: 'graticule',
  relief: 'relief',
} as const;

export const LAYER = {
  land: 'land',
  territoryFill: 'territory-fill',
  relief: 'relief',
  edgeBand: 'territory-band',
  selectedBand: 'selected-band',
  border: 'territory-border',
  selectedLine: 'selected-line',
  ocean: 'ocean',
  waterline: (i: number) => `waterline-${i}`,
  graticule: 'graticule',
  coast: 'coast',
  lakes: 'lakes',
  lakeShore: 'lake-shore',
  rivers: 'rivers',
  riverLabels: 'river-labels',
  seaLabels: 'sea-labels',
  places: 'places',
  selectedCapital: 'selected-capital',
  stateLabels: 'state-labels',
} as const;

/** Layers a click can select. */
export const INTERACTIVE_LAYERS = [LAYER.territoryFill];

/** Year data attributes (T1 format; see src/adapters/yearData.ts). */
const ATTR = { wash: 'c', name: 'n', area: 'a', place: 'p', placeKind: 'k' } as const;
/** T1's label points carry the largest part's area in km². */
const AREA_TO_KM2 = 1;
const PLACE_KIND_SITE = 'site';
/** T1 capital points: `name`, and `t` = territory id. */
const CAPITAL_ATTR = { name: 'name', territory: 't' } as const;

/** Feature-state keys set on the borders source (T6 contract names). */
export const FEATURE_STATE = {
  selected: 'selected',
  /** A dependency (`ov`) of the selected territory. */
  overlordSelected: 'overlordSelected',
} as const;

/**
 * Legend metadata for T7's map key: only classes the map actually draws.
 * `site` is drawn only once T1 publishes the archaeological-site class.
 */
export const LEGEND = [
  { id: 'selected', label: 'Selected territory', layer: LAYER.selectedLine },
  { id: 'capital', label: 'Capital of the selected territory', layer: LAYER.selectedCapital },
  { id: 'city', label: 'City or town', layer: LAYER.places },
  { id: 'site', label: 'Archaeological site', layer: LAYER.places },
] as const;

export const MARKER = { city: 'hb-city', capital: 'hb-capital', site: 'hb-site' } as const;

/** What the style needs to know about the current selection. */
export interface SelectionStyle {
  /** The selected territory's id in this year's data, or null. */
  id: number | null;
  /** The selected territory's name, or null. */
  name: string | null;
  /**
   * The selected territory's capital names (Wikidata). The capital marker
   * replaces any city point of the same name, so no dot is drawn twice.
   */
  capitals: string[];
}

export interface StyleOptions {
  /** Absolute origin for tiles and glyphs (MapLibre's worker resolves URLs). */
  origin: string;
  settings: Settings;
  /** Drops the finer waterlines and relief on weak devices (provisional rule). */
  lowPower?: boolean;
}

/** The selection is always madder, whatever the era accent. */
const MADDER = ERA_TINTS.medieval.ink;
/** Layout objects are built dynamically; MapLibre validates them at runtime. */
type Layout = Record<string, unknown>;
const EMPTY = { type: 'FeatureCollection' as const, features: [] };
const NONE = '\u0000none';
const selected = ['boolean', ['feature-state', 'selected'], false] as ExpressionSpecification;
const overlordSelected = ['boolean', ['feature-state', 'overlordSelected'], false] as ExpressionSpecification;
const km2 = ['*', ['to-number', ['get', ATTR.area], 0], AREA_TO_KM2] as ExpressionSpecification;

const wash = (key: 'fill' | 'edge') =>
  [
    'case',
    ['>=', ['to-number', ['get', ATTR.wash], 30], 30],
    FALLBACK_WASH[key],
    ['to-color', ['at', ['%', ['to-number', ['get', ATTR.wash], 30], WASHES.length], ['literal', WASHES.map((w) => w[key])]]],
  ] as ExpressionSpecification;

const TEXT_SCALE = { small: 0.85, medium: 1, large: 1.2 } as const;
const textScale = (s: Settings) => TEXT_SCALE[s.textSize] * (s.projectorText ? 1.15 : 1);
const stack = (s: Settings, kind: 'stateMedium' | 'stateBold' | 'sea' | 'river' | 'city') => {
  if (s.projectorText)
    return [kind === 'stateBold' || kind === 'stateMedium' ? FONTSTACK.projectorBold : FONTSTACK.projectorMedium];
  return [
    {
      stateMedium: FONTSTACK.stateMedium,
      stateBold: FONTSTACK.stateBold,
      sea: FONTSTACK.seaItalic,
      river: FONTSTACK.riverItalic,
      city: FONTSTACK.city,
    }[kind],
  ];
};
const transform = (s: Settings) =>
  // MapLibre cannot synthesize small caps: Atkinson state names use uppercase.
  s.textCase === 'upper' ? 'uppercase' : 'none';

/** State label size by log10(area) and zoom; the selected name gets a fixed, larger size. */
const areaSize = (s: Settings, name: string) => {
  const k = textScale(s);
  const sizes = [12, 14, 17, 21];
  const special = [18, 28];
  const byArea = (scale: number, i: number) => [
    'match',
    ['get', ATTR.name],
    name,
    special[i] * k,
    [
      'interpolate',
      ['linear'],
      ['log10', ['max', km2, 1]],
      4,
      sizes[0] * scale * k,
      5,
      sizes[1] * scale * k,
      5.8,
      sizes[2] * scale * k,
      6.6,
      sizes[3] * scale * k,
    ],
  ];
  return ['interpolate', ['linear'], ['zoom'], 2, byArea(1, 0), 5, byArea(1.55, 1)] as unknown as ExpressionSpecification;
};

const stateLabelLayout = (s: Settings, sel: SelectionStyle): Layout => {
  const name = sel.name ?? NONE;
  return {
    visibility: s.showLabels ? 'visible' : 'none',
    'text-field': ['get', ATTR.name],
    'text-font': [
      'match',
      ['get', ATTR.name],
      name,
      ['literal', stack(s, 'stateBold')],
      ['step', km2, ['literal', stack(s, 'stateMedium')], 250000, ['literal', stack(s, 'stateBold')]],
    ],
    'text-size': areaSize(s, name),
    'text-letter-spacing': s.projectorText
      ? ['step', km2, 0.06, 200000, 0.1, 1000000, 0.14]
      : ['step', km2, 0.04, 200000, 0.1, 1000000, 0.18],
    'text-transform': s.projectorText ? 'uppercase' : transform(s),
    'text-max-width': 8,
    'text-line-height': 1.1,
    'text-padding': 4,
    'symbol-sort-key': ['match', ['get', ATTR.name], name, -1e12, ['-', 0, km2]],
  };
};

const stateLabelFilter = (sel: SelectionStyle) =>
  [
    'all',
    ['has', ATTR.name],
    ['any', ['>', km2, 18000], ['==', ['get', ATTR.name], sel.name ?? NONE]],
  ] as FilterSpecification;

const placeLayout = (s: Settings): Layout => {
  const isSite = ['==', ['get', ATTR.placeKind], PLACE_KIND_SITE];
  return {
    visibility: s.showLabels ? 'visible' : 'none',
    'icon-image': ['case', isSite, MARKER.site, MARKER.city],
    'text-field': ['case', isSite, ['concat', ['get', ATTR.place], ' (ruins)'], ['get', ATTR.place]],
    'text-font': ['case', isSite, ['literal', stack(s, 'river')], ['literal', stack(s, 'city')]],
    'text-size': 14 * textScale(s),
    'text-transform': transform(s),
    'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
    'text-radial-offset': 0.75,
    'text-justify': 'auto',
    'text-max-width': 9,
  };
};

const capitalLayout = (s: Settings): Layout => ({
  visibility: s.showLabels ? 'visible' : 'none',
  'icon-image': MARKER.capital,
  'text-field': ['get', CAPITAL_ATTR.name],
  'text-font': stack(s, 'city'),
  'text-size': 16 * textScale(s),
  'text-transform': transform(s),
  'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
  'text-radial-offset': 0.8,
  'icon-allow-overlap': true,
});

const capitalFilter = (sel: SelectionStyle) =>
  ['==', ['to-number', ['get', CAPITAL_ATTR.territory], -1], sel.id ?? -2] as FilterSpecification;

const placeFilter = (sel: SelectionStyle) =>
  (sel.id === null
    ? ['has', ATTR.place]
    : ['all', ['has', ATTR.place], ['!', ['in', ['get', ATTR.place], ['literal', sel.capitals]]]]) as FilterSpecification;

const borderWidth = (s: Settings) => {
  const k = s.borderThickness / 2;
  return ['interpolate', ['linear'], ['zoom'], 2, 0.5 * k, 6, 1.1 * k] as ExpressionSpecification;
};
const fillOpacity = (s: Settings) =>
  // The design's 62% at the default 70% setting; the selection stays strong.
  ['case', selected, Math.max(0.92, s.countryOpacity), s.countryOpacity * 0.886] as ExpressionSpecification;

/** A 10° graticule; generated here, so it costs no request. */
export const graticule = (step = 10) => {
  const features: GeoJSON.Feature[] = [];
  for (let lon = -180; lon <= 180; lon += step)
    features.push({
      type: 'Feature',
      properties: { kind: 'meridian' },
      geometry: { type: 'LineString', coordinates: [[lon, -80], [lon, 84]] },
    });
  for (let lat = -80; lat <= 80; lat += step) {
    const coordinates: number[][] = [];
    for (let lon = -180; lon <= 180; lon += 5) coordinates.push([lon, lat]);
    features.push({
      type: 'Feature',
      properties: { kind: lat === 0 ? 'equator' : 'parallel' },
      geometry: { type: 'LineString', coordinates },
    });
  }
  return { type: 'FeatureCollection' as const, features };
};

/**
 * The full style. Year sources start empty; the controller hands MapLibre
 * the year's URLs once the preloaded downloads finish.
 */
export function createStyle({ origin, settings: s, lowPower = false }: StyleOptions): StyleSpecification {
  const sel: SelectionStyle = { id: null, name: null, capitals: [] };
  const waterlines = (lowPower ? [2.5, 5.5] : [2.5, 5.5, 9.5, 14.5]).map(
    (offset, i): LayerSpecification => ({
      id: LAYER.waterline(i),
      type: 'line',
      source: SOURCE.basemap,
      'source-layer': BASEMAP_LAYER.coast,
      // Toned down (§2.1): four below z3.5, two to z5, none from z5.
      maxzoom: i < 2 ? 5 : 3.5,
      filter: ['>=', ['to-number', ['coalesce', ['get', COAST_LANDMASS_KM2], 1e9]], 5000],
      paint: {
        'line-color': '#5F8A8C',
        'line-width': 0.6,
        'line-offset': offset,
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0.62 - i * 0.13, i < 2 ? 5 : 3.5, (0.62 - i * 0.13) * 0.35],
      },
    }),
  );
  return {
    version: 8,
    name: 'Historic Borders · Classic atlas',
    glyphs: `${origin}${GLYPHS_URL}`,
    sources: {
      [SOURCE.basemap]: {
        type: 'vector',
        tiles: [`${origin}${BASEMAP_TILES}`],
        minzoom: 0,
        maxzoom: BASEMAP_MAXZOOM,
        attribution: BASEMAP_ATTRIBUTION,
      },
      [SOURCE.borders]: {
        type: 'geojson',
        data: EMPTY,
        tolerance: 0.45,
        attribution:
          'Borders: <a href="https://github.com/aourednik/historical-basemaps">historical-basemaps</a> (GPL-3.0)',
      },
      [SOURCE.labels]: { type: 'geojson', data: EMPTY },
      [SOURCE.capitals]: { type: 'geojson', data: EMPTY },
      [SOURCE.graticule]: { type: 'geojson', data: graticule(10) },
    },
    layers: [
      { id: LAYER.land, type: 'background', paint: { 'background-color': COLOR.land } },
      {
        id: LAYER.territoryFill,
        type: 'fill',
        source: SOURCE.borders,
        paint: { 'fill-color': ['case', selected, COLOR.selectedFill, wash('fill')], 'fill-opacity': fillOpacity(s) },
      },
      {
        id: LAYER.edgeBand,
        type: 'line',
        source: SOURCE.borders,
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': wash('edge'),
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 3, 6, 9],
          'line-offset': ['interpolate', ['linear'], ['zoom'], 2, -1.5, 6, -4.5],
          'line-opacity': 0.5,
          'line-blur': 1.5,
        },
      },
      {
        id: LAYER.selectedBand,
        type: 'line',
        source: SOURCE.borders,
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': MADDER,
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 5, 6, 12],
          'line-offset': ['interpolate', ['linear'], ['zoom'], 2, -2.5, 6, -6],
          // The selection, and more faintly its colonies and vassals.
          'line-opacity': ['case', selected, 0.38, overlordSelected, 0.2, 0],
        },
      },
      {
        id: LAYER.border,
        type: 'line',
        source: SOURCE.borders,
        layout: { 'line-join': 'round' },
        paint: { 'line-color': COLOR.ink, 'line-width': borderWidth(s), 'line-opacity': 0.72 },
      },
      {
        id: LAYER.selectedLine,
        type: 'line',
        source: SOURCE.borders,
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': MADDER,
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1.6, 6, 3],
          'line-opacity': ['case', selected, 1, 0],
        },
      },
      // Water is painted over the territories: the source polygons overrun coasts.
      {
        id: LAYER.ocean,
        type: 'fill',
        source: SOURCE.basemap,
        'source-layer': BASEMAP_LAYER.ocean,
        paint: { 'fill-color': COLOR.water, 'fill-antialias': true },
      },
      ...waterlines,
      {
        id: LAYER.graticule,
        type: 'line',
        source: SOURCE.graticule,
        paint: {
          'line-color': '#3F5F61',
          'line-width': ['match', ['get', 'kind'], 'equator', 1, 0.5],
          'line-opacity': 0.4,
        },
      },
      {
        id: LAYER.coast,
        type: 'line',
        source: SOURCE.basemap,
        'source-layer': BASEMAP_LAYER.coast,
        paint: { 'line-color': '#3F5F61', 'line-width': 0.9 },
      },
      {
        id: LAYER.lakes,
        type: 'fill',
        source: SOURCE.basemap,
        'source-layer': BASEMAP_LAYER.lakes,
        paint: { 'fill-color': COLOR.water },
      },
      {
        id: LAYER.lakeShore,
        type: 'line',
        source: SOURCE.basemap,
        'source-layer': BASEMAP_LAYER.lakes,
        paint: { 'line-color': '#3F5F61', 'line-width': 0.6 },
      },
      {
        id: LAYER.rivers,
        type: 'line',
        source: SOURCE.basemap,
        'source-layer': BASEMAP_LAYER.rivers,
        filter: ['<=', ['to-number', ['get', 'rank'], 9], 6],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#4F8187',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2,
            ['match', ['get', 'rank'], [1, 2], 0.9, 0.5],
            6,
            ['match', ['get', 'rank'], [1, 2], 2, 1.2],
          ],
        },
      },
      {
        id: LAYER.riverLabels,
        type: 'symbol',
        source: SOURCE.basemap,
        'source-layer': BASEMAP_LAYER.rivers,
        minzoom: 3.2,
        filter: ['all', ['<=', ['to-number', ['get', 'rank'], 9], 2], ['has', 'name']],
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          'text-font': stack(s, 'river'),
          'text-size': 14 * textScale(s),
          'text-letter-spacing': 0.1,
          'symbol-spacing': 500,
          'text-max-angle': 30,
          'text-offset': [0, -0.6],
        },
        paint: { 'text-color': COLOR.waterInk, 'text-halo-color': 'rgba(241, 232, 208, 0.9)', 'text-halo-width': 1.6 },
      },
      {
        id: LAYER.seaLabels,
        type: 'symbol',
        source: SOURCE.basemap,
        'source-layer': BASEMAP_LAYER.marine,
        filter: ['<=', ['to-number', ['get', 'rank'], 9], 3],
        layout: {
          'text-field': ['case', ['==', ['get', 'kind'], 'ocean'], ['upcase', ['get', 'name']], ['get', 'name']],
          'text-font': stack(s, 'sea'),
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2,
            ['match', ['get', 'kind'], 'ocean', 15 * textScale(s), 13 * textScale(s)],
            5,
            ['match', ['get', 'kind'], 'ocean', 22 * textScale(s), 18 * textScale(s)],
          ],
          'text-letter-spacing': ['match', ['get', 'kind'], 'ocean', 0.35, 0.16],
          'text-max-width': 7,
          'text-line-height': 1.25,
        },
        paint: { 'text-color': COLOR.waterInk, 'text-halo-color': COLOR.water, 'text-halo-width': 1.2 },
      },
      // Symbol priority, lowest to highest: other cities, the selected
      // capital, state names. The selected territory's name is never dropped.
      {
        id: LAYER.places,
        type: 'symbol',
        source: SOURCE.labels,
        minzoom: 2.5,
        filter: placeFilter(sel),
        layout: placeLayout(s),
        paint: { 'text-color': COLOR.ink, 'text-halo-color': 'rgba(247, 240, 222, 0.95)', 'text-halo-width': 1.6 },
      } as unknown as LayerSpecification,
      {
        id: LAYER.selectedCapital,
        type: 'symbol',
        source: SOURCE.capitals,
        filter: capitalFilter(sel),
        layout: capitalLayout(s),
        paint: { 'text-color': COLOR.ink, 'text-halo-color': 'rgba(247, 240, 222, 0.95)', 'text-halo-width': 1.8 },
      } as unknown as LayerSpecification,
      {
        id: LAYER.stateLabels,
        type: 'symbol',
        source: SOURCE.labels,
        filter: stateLabelFilter(sel),
        layout: stateLabelLayout(s, sel),
        paint: {
          'text-color': COLOR.ink,
          'text-halo-color': 'rgba(247, 240, 222, 0.92)',
          'text-halo-width': 1.8,
          'text-halo-blur': 0.4,
        },
      } as unknown as LayerSpecification,
    ],
  };
}

const setLayout = (map: MapLibreMap, layer: string, layout: Layout) => {
  if (!map.getLayer(layer)) return;
  for (const [key, value] of Object.entries(layout))
    map.setLayoutProperty(layer, key as never, value as never, { validate: false });
};

/**
 * Applies settings and the selection to a live map: paint and layout
 * properties only, so the year's sources are never re-tiled. MapLibre skips
 * properties whose value did not change.
 */
export function applyDynamic(map: MapLibreMap, s: Settings, sel: SelectionStyle) {
  if (!map.getLayer(LAYER.stateLabels)) return;
  map.setPaintProperty(LAYER.territoryFill, 'fill-opacity', fillOpacity(s));
  map.setPaintProperty(LAYER.border, 'line-width', borderWidth(s));
  map.setLayoutProperty(LAYER.border, 'visibility', s.borderThickness > 0 ? 'visible' : 'none');
  setLayout(map, LAYER.stateLabels, stateLabelLayout(s, sel));
  map.setFilter(LAYER.stateLabels, stateLabelFilter(sel));
  map.setPaintProperty(LAYER.stateLabels, 'text-color', [
    'match',
    ['get', ATTR.name],
    sel.name ?? NONE,
    COLOR.selectedInk,
    COLOR.ink,
  ]);
  setLayout(map, LAYER.places, placeLayout(s));
  map.setFilter(LAYER.places, placeFilter(sel));
  setLayout(map, LAYER.selectedCapital, capitalLayout(s));
  map.setFilter(LAYER.selectedCapital, capitalFilter(sel));
  setLayout(map, LAYER.seaLabels, { 'text-font': stack(s, 'sea') });
  setLayout(map, LAYER.riverLabels, { 'text-font': stack(s, 'river'), 'text-size': 14 * textScale(s) });
}

/** Relief loads after the first paint so it never delays the borders. */
export function addRelief(map: MapLibreMap, origin: string) {
  if (map.getSource(SOURCE.relief)) return;
  map.addSource(SOURCE.relief, {
    type: 'image',
    url: `${origin}${RELIEF.url}`,
    coordinates: [
      [-180, RELIEF.north],
      [180, RELIEF.north],
      [180, RELIEF.south],
      [-180, RELIEF.south],
    ],
  });
  map.addLayer(
    {
      id: LAYER.relief,
      type: 'raster',
      source: SOURCE.relief,
      paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 0, 'raster-resampling': 'linear' },
    },
    LAYER.edgeBand,
  );
}

/** Draws a marker on demand (`styleimagemissing`), so a dot never ships without its name. */
export function addMarkerImage(map: MapLibreMap, id: string) {
  const draw: Record<string, (g: CanvasRenderingContext2D, c: number) => void> = {
    [MARKER.city]: (g, c) => circle(g, c, 5.5, COLOR.ink, COLOR.sheet, 2.6),
    [MARKER.capital]: (g, c) => {
      circle(g, c, 8, COLOR.sheet, COLOR.ink, 2.4);
      circle(g, c, 4, MADDER);
    },
    [MARKER.site]: (g, c) => {
      g.fillStyle = COLOR.ink;
      for (const [x, y] of [
        [c, c - 4.5],
        [c - 4.5, c + 3.5],
        [c + 4.5, c + 3.5],
      ]) {
        g.beginPath();
        g.arc(x, y, 2.6, 0, Math.PI * 2);
        g.fill();
      }
    },
  };
  if (!draw[id] || map.hasImage(id)) return;
  const size = 22;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) return;
  draw[id](g, size / 2);
  map.addImage(id, { width: size, height: size, data: new Uint8Array(g.getImageData(0, 0, size, size).data.buffer) }, { pixelRatio: 2 });
}

const circle = (g: CanvasRenderingContext2D, c: number, r: number, fill?: string, stroke?: string, width = 1) => {
  g.beginPath();
  g.arc(c, c, r, 0, Math.PI * 2);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.lineWidth = width;
    g.strokeStyle = stroke;
    g.stroke();
  }
};

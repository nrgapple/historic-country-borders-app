import type { ExpressionSpecification, LayerSpecification, SourceSpecification, StyleSpecification } from 'maplibre-gl';

/** Muted atlas palette, indexed by the pipeline's legacy color slot (see lib/mapStyle.ts). */
export const ATLAS_PALETTE = [
  '#DCBDAD','#B2D7C9','#CE9CD3','#C8D49B','#C6D4E2','#E4C3CA','#ADDCB1','#C0B2D7','#D3C19C','#9BD4D2',
  '#E2C6DB','#D2E4C3','#ADB5DC','#D7B6B2','#9CD3B3','#C49BD4','#E1E2C6','#C3DAE4','#DCADC0','#B6D7B2',
  '#A69CD3','#D4B59B','#C6E2DB','#E4C3E3','#CCDCAD','#B2C0D7','#D39CA1','#9BD4A7','#D4C6E2','#E4DDC3',
];
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'.split(',');
const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF'.split(',');
const INK = '#2B2824';
const HALO = 'rgba(255, 253, 248, 0.92)';
const SELECTED = '#8F2D1C';
const selected = ['boolean', ['feature-state', 'selected'], false] as ExpressionSpecification;
const fill = ['match', ['get', 'c'], ...ATLAS_PALETTE.flatMap((c, i) => [i, c]), '#D9D4C7'] as unknown as ExpressionSpecification;
const isPolygon = ['==', ['geometry-type'], 'Polygon'] as ExpressionSpecification;

/**
 * A first-party physical atlas style. Every URL it references is on our own
 * origin: Natural Earth basemap tiles, self-hosted glyphs and the year file.
 */
export function atlasStyle(origin: string): StyleSpecification {
  return {
    version: 8,
    name: 'Historic Borders physical atlas',
    glyphs: `${origin}/glyphs/{fontstack}/{range}.pbf`,
    // MapLibre >= 6.7 renders these WOFF2 files locally; only characters
    // outside their ranges fall back to the glyph PBFs above.
    'font-faces': {
      'Atlas Labels': [
        { url: `${origin}/fonts/source-serif-4-latin.woff2`, 'unicode-range': LATIN },
        { url: `${origin}/fonts/source-serif-4-latin-ext.woff2`, 'unicode-range': LATIN_EXT },
      ],
    },
    sources: {
      basemap: {
        type: 'vector',
        tiles: [`${origin}/basemap/{z}/{x}/{y}.pbf`],
        minzoom: 0,
        maxzoom: 5,
        attribution: 'Physical basemap: <a href="https://www.naturalearthdata.com/">Natural Earth</a>',
      },
    },
    layers: [
      { id: 'ocean', type: 'background', paint: { 'background-color': '#BFD5DA' } },
      { id: 'land', type: 'fill', source: 'basemap', 'source-layer': 'land', paint: { 'fill-color': '#EEE9DD' } },
      { id: 'lakes', type: 'fill', source: 'basemap', 'source-layer': 'lakes', paint: { 'fill-color': '#BFD5DA' } },
      {
        id: 'rivers', type: 'line', source: 'basemap', 'source-layer': 'rivers', minzoom: 3,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#A9C7CE', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 8, 2] },
      },
    ],
  };
}

/** The year's borders, labels and places: one GeoJSON source parsed in MapLibre's worker. */
export const bordersSource = (url: string): SourceSpecification => ({
  type: 'geojson',
  data: url,
  tolerance: 0.45,
  attribution: 'Borders: <a href="https://github.com/aourednik/historical-basemaps">historical-basemaps</a> (GPL-3.0)',
});

/** Territory labels and dated places; needs glyphs, so it is a separate source. */
export const labelsSource = (url: string): SourceSpecification => ({ type: 'geojson', data: url });

export const borderLayers: LayerSpecification[] = [
      {
        id: 'borders-fill', type: 'fill', source: 'borders', filter: isPolygon,
        paint: { 'fill-color': fill, 'fill-opacity': ['case', selected, 0.8, 0.6] },
      },
      {
        id: 'borders-line', type: 'line', source: 'borders', filter: isPolygon,
        layout: { 'line-join': 'round' },
        paint: { 'line-color': INK, 'line-opacity': 0.55, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.35, 6, 0.8, 10, 1.4] },
      },
      // Paint-only selection: toggling feature-state never re-tiles the source.
      {
        id: 'borders-selected', type: 'line', source: 'borders', filter: isPolygon,
        layout: { 'line-join': 'round' },
        paint: { 'line-color': SELECTED, 'line-opacity': ['case', selected, 1, 0], 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1.8, 8, 3.6] },
      },
      {
        id: 'places-dot', type: 'circle', source: 'labels', minzoom: 2.5, filter: ['has', 'p'],
        paint: { 'circle-color': INK, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 2.5, 1.6, 8, 3.5], 'circle-stroke-color': '#FFFDF8', 'circle-stroke-width': 1 },
      },
      {
        id: 'places-label', type: 'symbol', source: 'labels', minzoom: 3.5, filter: ['has', 'p'],
        layout: {
          'text-field': ['get', 'p'], 'text-font': ['Atlas Labels'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9, 7, 13],
          'text-anchor': 'top', 'text-offset': [0, 0.5], 'text-max-width': 7, 'text-optional': true,
        },
        paint: { 'text-color': '#4A453E', 'text-halo-color': HALO, 'text-halo-width': 1.4 },
      },
      {
        id: 'labels', type: 'symbol', source: 'labels', filter: ['has', 'n'],
        layout: {
          'text-field': ['get', 'n'], 'text-font': ['Atlas Labels'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10.5, 7, 19],
          'text-max-width': 8, 'text-padding': 4, 'text-letter-spacing': 0.04,
          // Larger territories claim label space first.
          'symbol-sort-key': ['-', ['get', 'a']],
        },
        paint: { 'text-color': INK, 'text-halo-color': HALO, 'text-halo-width': 1.6, 'text-halo-blur': 0.4 },
      },
];

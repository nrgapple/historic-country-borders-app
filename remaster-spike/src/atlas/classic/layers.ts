/**
 * The Classic-atlas layer stack, in the plan's draw order (§2.1):
 * land → territory fills → [relief] → edge bands → borders and selection →
 * ocean mask → graticule → waterlines and coast → lakes → rivers → labels.
 *
 * Symbol layers are placed top-down, so the stack ends
 * places → capitals → selected capital → state names → selected-capital mark:
 * the state names claim space first, the selected territory's name is never
 * dropped, and the selected capital's star (an icon that ignores placement)
 * is drawn on top of everything without displacing any label.
 */
import type { LayerSpecification } from 'maplibre-gl';
import {
  BASEMAP_LAYER,
  CAPITAL_ATTR,
  COAST_ATTR,
  FEATURE_ATTR,
  FONTSTACK,
  LABEL_ATTR,
  LAYER,
  MARINE_KIND_OCEAN,
  MARKER,
  SOURCE,
} from './contract';
import {
  borderWidth,
  CAPITAL_MINZOOM,
  CAPITAL_PX,
  capitalFilter,
  edgeColor,
  fillColor,
  fillOpacity,
  hatchImage,
  isDependency,
  isSelected,
  labelPx,
  PLACE_PX,
  placeFont,
  placeIcon,
  placeText,
  SELECTED_CAPITAL_PX,
  selectedLineOpacity,
  selectedLineWidth,
  stateFont,
  stateLabelFilter,
  stateLabelSize,
  stateLetterSpacing,
  stateSortKey,
  stateTextColor,
  textScale,
  textTransform,
  WATERLINE_MIN_KM2,
  WATERLINE_OFFSETS,
  waterlineMaxzoom,
  waterlineOpacity,
  type Expr,
} from './expressions';
import { COLOR } from './tokens';
import type { ClassicStyleOptions } from './options';
import { LOW_POWER_HIDDEN } from './lowPower';

const vis = (on: boolean) => (on ? ('visible' as const) : ('none' as const));
const bm = (layer: string) => ({
  source: SOURCE.basemap,
  'source-layer': layer,
});
const zoomRamp = (a: number, b: number, z0 = 2, z1 = 6): Expr =>
  ['interpolate', ['linear'], ['zoom'], z0, a, z1, b] as Expr;

export function buildLayers(o: ClassicStyleOptions): LayerSpecification[] {
  const labels = o.settings.showLabels;
  const sel = o.selected;
  const font = (stack: string) => [
    o.projectorText ? FONTSTACK.projectorMedium : stack,
  ];
  const layers: LayerSpecification[] = [
    {
      id: LAYER.land,
      type: 'background',
      paint: { 'background-color': COLOR.land },
    },
    {
      id: LAYER.territoryFill,
      type: 'fill',
      source: SOURCE.borders,
      paint: {
        'fill-color': fillColor,
        'fill-opacity': fillOpacity(o.settings),
      },
    },
    {
      // A fine hatch over dependencies, in the overlord's pigment.
      id: LAYER.dependencyHatch,
      type: 'fill',
      source: SOURCE.borders,
      filter: isDependency,
      paint: { 'fill-pattern': hatchImage, 'fill-opacity': 0.7 },
    },
    {
      // Grenzkolorit: a soft band of the darker pigment inside each border.
      id: LAYER.edgeBand,
      type: 'line',
      source: SOURCE.borders,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': edgeColor,
        'line-width': zoomRamp(3, 9),
        'line-offset': zoomRamp(-1.5, -4.5),
        'line-opacity': ['case', isDependency, 0.35, 0.5] as Expr,
        'line-blur': 1.5,
      },
    },
    {
      id: LAYER.selectedBand,
      type: 'line',
      source: SOURCE.borders,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': COLOR.accent,
        'line-width': zoomRamp(5, 12),
        'line-offset': zoomRamp(-2.5, -6),
        'line-opacity': ['case', isSelected, 0.38, 0] as Expr,
      },
    },
    {
      id: LAYER.border,
      type: 'line',
      source: SOURCE.borders,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': COLOR.ink,
        'line-width': borderWidth(o.settings),
        'line-opacity': 0.72,
      },
    },
    {
      id: LAYER.selectedLine,
      type: 'line',
      source: SOURCE.borders,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': COLOR.accent,
        'line-width': selectedLineWidth(o.settings),
        'line-opacity': selectedLineOpacity,
      },
    },
    // Water is painted over the territories: source polygons overrun coastlines.
    {
      id: LAYER.ocean,
      type: 'fill',
      ...bm(BASEMAP_LAYER.ocean),
      paint: { 'fill-color': COLOR.water },
    },
    {
      id: LAYER.graticule,
      type: 'line',
      source: SOURCE.graticule,
      paint: {
        'line-color': COLOR.coast,
        'line-width': ['match', ['get', 'kind'], 'equator', 1, 0.5] as Expr,
        'line-opacity': 0.4,
      },
    },
    ...WATERLINE_OFFSETS.map((offset, i): LayerSpecification => ({
      id: LAYER.waterline(i),
      type: 'line',
      ...bm(BASEMAP_LAYER.coast),
      maxzoom: waterlineMaxzoom(i),
      filter: [
        '>=',
        ['coalesce', ['get', COAST_ATTR.landmassKm2], 0],
        WATERLINE_MIN_KM2,
      ] as Expr,
      paint: {
        'line-color': COLOR.waterline,
        'line-width': 0.6,
        'line-offset': offset,
        'line-opacity': waterlineOpacity(i),
      },
    })),
    {
      id: LAYER.coast,
      type: 'line',
      ...bm(BASEMAP_LAYER.coast),
      paint: { 'line-color': COLOR.coast, 'line-width': 0.9 },
    },
    {
      id: LAYER.lakes,
      type: 'fill',
      ...bm(BASEMAP_LAYER.lakes),
      paint: { 'fill-color': COLOR.water },
    },
    {
      id: LAYER.lakeShore,
      type: 'line',
      ...bm(BASEMAP_LAYER.lakes),
      paint: { 'line-color': COLOR.coast, 'line-width': 0.6 },
    },
    {
      id: LAYER.rivers,
      type: 'line',
      ...bm(BASEMAP_LAYER.rivers),
      filter: ['<=', ['coalesce', ['get', FEATURE_ATTR.rank], 99], 6] as Expr,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': COLOR.river,
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          2,
          ['match', ['get', FEATURE_ATTR.rank], [1, 2], 0.9, 0.5],
          6,
          ['match', ['get', FEATURE_ATTR.rank], [1, 2], 2, 1.2],
        ] as Expr,
      },
    },
    {
      id: LAYER.riverLabels,
      type: 'symbol',
      ...bm(BASEMAP_LAYER.rivers),
      minzoom: 3.2,
      filter: [
        'all',
        ['<=', ['coalesce', ['get', FEATURE_ATTR.rank], 99], 2],
        ['has', FEATURE_ATTR.name],
      ] as Expr,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['get', FEATURE_ATTR.name] as Expr,
        'text-font': font(FONTSTACK.riverItalic),
        'text-size': labelPx(14, o),
        'text-letter-spacing': 0.1,
        'symbol-spacing': 500,
        'text-max-angle': 30,
        'text-offset': [0, -0.6],
      },
      paint: {
        'text-color': COLOR.waterInk,
        'text-halo-color': COLOR.riverHalo,
        'text-halo-width': 1.6,
      },
    },
    {
      id: LAYER.seaLabels,
      type: 'symbol',
      ...bm(BASEMAP_LAYER.marine),
      filter: ['<=', ['coalesce', ['get', FEATURE_ATTR.rank], 99], 3] as Expr,
      layout: {
        'text-field': [
          'case',
          ['==', ['get', FEATURE_ATTR.kind], MARINE_KIND_OCEAN],
          ['upcase', ['get', FEATURE_ATTR.name]],
          ['get', FEATURE_ATTR.name],
        ] as Expr,
        'text-font': font(FONTSTACK.seaItalic),
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          2,
          [
            'match',
            ['get', FEATURE_ATTR.kind],
            MARINE_KIND_OCEAN,
            labelPx(15, o),
            labelPx(13, o),
          ],
          5,
          [
            'match',
            ['get', FEATURE_ATTR.kind],
            MARINE_KIND_OCEAN,
            labelPx(22, o),
            labelPx(18, o),
          ],
        ] as Expr,
        'text-letter-spacing': [
          'match',
          ['get', FEATURE_ATTR.kind],
          MARINE_KIND_OCEAN,
          0.35,
          0.16,
        ] as Expr,
        'text-max-width': 7,
        'text-line-height': 1.25,
      },
      paint: {
        'text-color': COLOR.waterInk,
        'text-halo-color': COLOR.water,
        'text-halo-width': 1.2,
      },
    },
    {
      // City and ruin markers are the icon of their own symbol: no dot without a name.
      id: LAYER.places,
      type: 'symbol',
      source: SOURCE.labels,
      minzoom: 2.5,
      filter: ['has', LABEL_ATTR.place] as Expr,
      layout: {
        visibility: vis(labels),
        'icon-image': placeIcon,
        'text-field': placeText,
        'text-font': placeFont(o),
        'text-size': labelPx(PLACE_PX, o),
        'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
        'text-radial-offset': 0.75,
        'text-justify': 'auto',
      },
      paint: {
        'text-color': COLOR.ink,
        'text-halo-color': COLOR.placeHalo,
        'text-halo-width': 1.6,
      },
    },
    {
      id: LAYER.capitals,
      type: 'symbol',
      source: SOURCE.capitals,
      minzoom: CAPITAL_MINZOOM,
      filter: capitalFilter(sel, false),
      layout: {
        visibility: vis(labels),
        'icon-image': MARKER.capital,
        'text-field': ['get', CAPITAL_ATTR.name] as Expr,
        'text-font': font(FONTSTACK.city),
        'text-size': labelPx(CAPITAL_PX, o),
        'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
        'text-radial-offset': 0.85,
        'text-justify': 'auto',
      },
      paint: {
        'text-color': COLOR.ink,
        'text-halo-color': COLOR.placeHalo,
        'text-halo-width': 1.6,
      },
    },
    {
      // The selected territory's capital is always drawn; other symbols avoid it.
      id: LAYER.selectedCapital,
      type: 'symbol',
      source: SOURCE.capitals,
      filter: capitalFilter(sel, true),
      layout: {
        visibility: vis(labels),
        // The visible star is drawn by the mark layer on top; this icon only
        // reserves space so the name is placed beside it.
        'icon-image': MARKER.capital,
        'icon-allow-overlap': true,
        'text-optional': true,
        'text-field': ['get', CAPITAL_ATTR.name] as Expr,
        'text-font': font(FONTSTACK.city),
        'text-size': labelPx(SELECTED_CAPITAL_PX, o),
        'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
        'text-radial-offset': 0.9,
      },
      paint: {
        'icon-opacity': 0,
        'text-color': COLOR.ink,
        'text-halo-color': COLOR.placeHalo,
        'text-halo-width': 1.8,
      },
    },
    {
      id: LAYER.stateLabels,
      type: 'symbol',
      source: SOURCE.labels,
      filter: stateLabelFilter(sel),
      layout: {
        visibility: vis(labels),
        'text-field': ['get', LABEL_ATTR.name] as Expr,
        'text-font': stateFont(o),
        'text-size': stateLabelSize(o),
        'text-transform': textTransform(o),
        'text-letter-spacing': stateLetterSpacing(o),
        'text-max-width': 8,
        'text-line-height': 1.1,
        'text-padding': 4,
        'symbol-sort-key': stateSortKey(sel),
      },
      paint: {
        'text-color': stateTextColor(sel),
        'text-halo-color': COLOR.stateHalo,
        'text-halo-width': 1.8 * Math.min(1.2, textScale(o)),
        'text-halo-blur': 0.4,
      },
    },
    {
      // The selected territory's capital is always visible, even under its own name.
      id: LAYER.selectedCapitalMark,
      type: 'symbol',
      source: SOURCE.capitals,
      filter: capitalFilter(sel, true),
      layout: {
        visibility: vis(labels),
        'icon-image': MARKER.capital,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    },
  ];
  // Low-power mode hides decorations rather than removing them, so toggling
  // it is a visibility change and never re-adds sources or re-tiles.
  for (const layer of layers) {
    if (!LOW_POWER_HIDDEN.includes(layer.id)) continue;
    layer.layout = {
      ...(layer.layout ?? {}),
      visibility: vis(!o.lowPower),
    } as never;
  }
  return layers;
}

/** The relief raster, inserted before the edge band after first paint. */
export const reliefLayer = (o: ClassicStyleOptions): LayerSpecification => ({
  id: LAYER.relief,
  type: 'raster',
  source: SOURCE.relief,
  layout: {
    visibility: vis(!(o.lowPower && LOW_POWER_HIDDEN.includes(LAYER.relief))),
  },
  paint: {
    'raster-opacity': 0.9,
    'raster-fade-duration': 0,
    'raster-resampling': 'linear',
  },
});

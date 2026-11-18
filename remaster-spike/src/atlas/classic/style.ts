/**
 * Classic-atlas (Direction A) style for MapLibre GL JS 6.
 *
 *   const map = new Map({ style: classicAtlasStyle(origin, urls, options) });
 *   map.on('styleimagemissing', () => addMarkerImages(map));   // or call once before load
 *   map.once('idle', () => addRelief(map, origin, options));    // after first paint
 *   applyStyleOptions(map, options);                            // Settings, Projector text, lowPower
 *   setSelection(map, selection, options);                      // paint-only for borders
 */
import type {
  FilterSpecification,
  GeoJSONSourceSpecification,
  Map as MLMap,
  StyleSpecification,
} from 'maplibre-gl';
import {
  BASEMAP_MAXZOOM,
  BASEMAP_TILES,
  BORDER_ATTR,
  FEATURE_STATE,
  GLYPHS_URL,
  LAYER,
  RELIEF,
  SOURCE,
} from './contract';
import { graticule } from './graticule';
import { buildLayers, reliefLayer } from './layers';
import {
  withDefaults,
  type ClassicStyleOptions,
  type Selection,
} from './options';

const EMPTY = { type: 'FeatureCollection', features: [] } as const;

export interface YearUrls {
  borders?: string;
  labels?: string;
  capitals?: string;
}

const geojson = (
  data: string | undefined,
  extra: Partial<GeoJSONSourceSpecification> = {},
): GeoJSONSourceSpecification => ({
  type: 'geojson',
  data: data ?? (EMPTY as unknown as GeoJSONSourceSpecification['data']),
  ...extra,
});

export function classicAtlasStyle(
  origin: string,
  urls: YearUrls = {},
  partial: Partial<ClassicStyleOptions> = {},
): StyleSpecification {
  const o = withDefaults(partial);
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
        attribution:
          'Coasts, rivers, relief: <a href="https://www.naturalearthdata.com/">Natural Earth</a>',
      },
      [SOURCE.graticule]: geojson(undefined, { data: graticule(10) as never }),
      [SOURCE.borders]: geojson(urls.borders, {
        tolerance: 0.45,
        attribution:
          'Borders: <a href="https://github.com/aourednik/historical-basemaps">historical-basemaps</a> (GPL-3.0)',
      }),
      [SOURCE.labels]: geojson(urls.labels),
      [SOURCE.capitals]: geojson(urls.capitals),
    },
    layers: buildLayers(o),
  };
}

/**
 * Re-applies every option-dependent property. MapLibre skips values that are
 * deep-equal to the current ones, so this only touches what changed. Settings
 * changes that alter a data-driven border expression re-lay out the borders
 * source once; selection changes never do (see `setSelection`).
 */
export function applyStyleOptions(
  map: MLMap,
  partial: Partial<ClassicStyleOptions>,
) {
  const o = withDefaults(partial);
  const layers = buildLayers(o);
  if (map.getLayer(LAYER.relief)) layers.push(reliefLayer(o));
  for (const layer of layers) {
    if (!map.getLayer(layer.id)) continue;
    if ('filter' in layer && layer.filter)
      map.setFilter(layer.id, layer.filter as FilterSpecification);
    // Property names come from our own layer objects, so the loose typing is safe.
    const loose = map as unknown as {
      setLayoutProperty(id: string, k: string, v: unknown): void;
      setPaintProperty(id: string, k: string, v: unknown): void;
    };
    for (const [k, v] of Object.entries(layer.layout ?? {}))
      loose.setLayoutProperty(layer.id, k, v);
    for (const [k, v] of Object.entries(layer.paint ?? {}))
      loose.setPaintProperty(layer.id, k, v);
  }
}

/** Adds the relief raster under the edge bands. Call after the first paint. */
export function addRelief(
  map: MLMap,
  origin: string,
  partial: Partial<ClassicStyleOptions> = {},
) {
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
  map.addLayer(reliefLayer(withDefaults(partial)), LAYER.edgeBand);
}

/**
 * Marks the selection. Borders change through feature-state only (paint,
 * no re-tiling); the label and capital layers get new layout values, which
 * re-lays out only those small sources.
 *
 * `dependencyIds` lists the selected territory's dependencies. When omitted,
 * they are found in the loaded tiles (`ov` = selected id); call again on the
 * borders source's `sourcedata` so newly loaded tiles are marked too.
 */
export function setSelection(
  map: MLMap,
  selection: Selection | null,
  partial: Partial<ClassicStyleOptions> = {},
  dependencyIds?: readonly number[],
) {
  applyStyleOptions(map, { ...partial, selected: selection });
  if (!map.getSource(SOURCE.borders)) return;
  map.removeFeatureState({ source: SOURCE.borders });
  if (!selection) return;
  map.setFeatureState(
    { source: SOURCE.borders, id: selection.id },
    { [FEATURE_STATE.selected]: true },
  );
  const deps =
    dependencyIds ??
    map
      .querySourceFeatures(SOURCE.borders, {
        filter: ['==', ['get', BORDER_ATTR.overlord], selection.id],
      })
      .map((f) => f.id)
      .filter((id): id is number => typeof id === 'number');
  for (const id of new Set(deps)) {
    map.setFeatureState(
      { source: SOURCE.borders, id },
      { [FEATURE_STATE.overlordSelected]: true },
    );
  }
}

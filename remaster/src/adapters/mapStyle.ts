/**
 * T6 ADAPTER: the Classic-atlas MapLibre style (plan §2.1, Direction A),
 * integrated with `t3/classic-atlas-map-style` (@ 4dab0b1). The module lives
 * at remaster-spike/src/atlas/classic/ (contract in its `contract.ts`, review
 * and approved screenshots in docs/product/style-review/) and is imported in
 * place, so T6 stays its single owner. It has only type-level package
 * imports, so the remaster bundles it with its own MapLibre.
 *
 * This file maps the app's settings and selection onto T6's options; the
 * controller (src/atlas/mapController.ts) uses only the exports below. When
 * the module moves into remaster/ (P6 cleanup), change the import path only.
 */
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import {
  addMarkerImages,
  addRelief as classicAddRelief,
  classicAtlasStyle,
  detectLowPower,
  LAYER,
  setSelection,
  relocatedIds,
  setViewportLabels as classicSetViewportLabels,
  withDefaults,
  type AnchorCollection,
  type ClassicStyleOptions,
} from '@repo/remaster-spike/src/atlas/classic';
import type { Settings } from '../atlas/settings';

export {
  attachNeatline,
  attachPaperGrain,
  drawnClasses,
  FEATURE_STATE,
  LAYER,
  legendEntries,
  LOW_POWER_DROPS_GRAIN,
  LOW_POWER_SIMPLE_NEATLINE,
  MARKER,
  SOURCE,
  labelTerritories,
  landPolygons,
  viewportAnchors,
  type AnchorCollection,
  type LabelTerritory,
  type LegendEntry,
  type Rect,
} from '@repo/remaster-spike/src/atlas/classic';

/** Layers a click can select. */
export const INTERACTIVE_LAYERS = [LAYER.territoryFill];

/** What the style needs to know about the current selection. */
export interface SelectionStyle {
  /** The selected territory's id in this year's data, or null. */
  id: number | null;
  /** The selected territory's name, or null. */
  name: string | null;
  /** Ids of the selected territory's dependencies (index `ov` = id). */
  dependencyIds: number[];
}

export interface StyleOptions {
  /** Absolute origin for tiles and glyphs (MapLibre's worker resolves URLs). */
  origin: string;
  settings: Settings;
  /** T6's low-power rule: fewer waterlines, no hatch, no grain, single-rule neatline. */
  lowPower: boolean;
}

/** The app's settings, selection and device class as T6's style options. */
export const styleOptions = (
  settings: Settings,
  lowPower: boolean,
  sel: SelectionStyle | null = null,
  relocatedLabels: readonly number[] = [],
): ClassicStyleOptions =>
  withDefaults({
    relocatedLabels,
    settings: {
      textSize: settings.textSize,
      textCase: settings.textCase,
      countryOpacity: settings.countryOpacity,
      borderThickness: settings.borderThickness,
      showLabels: settings.showLabels,
    },
    projectorText: settings.projectorText,
    lowPower,
    selected:
      sel && sel.id !== null && sel.name
        ? { id: sel.id, name: sel.name }
        : null,
  });

/**
 * The full style. Year sources start empty; the controller hands MapLibre the
 * year's URLs once the preloaded downloads finish.
 */
export const createStyle = ({
  origin,
  settings,
  lowPower,
}: StyleOptions): StyleSpecification => {
  const style = classicAtlasStyle(origin, {}, styleOptions(settings, lowPower));
  // The owner dropped the graticule: students do not read coordinates, and
  // the lines made the map harder to read (2026-11-18).
  return {
    ...style,
    layers: style.layers.filter((layer) => layer.id !== LAYER.graticule),
  };
};

/**
 * Applies settings and the selection to a live map: paint and layout only,
 * and feature-state for the borders, so the year's sources are never re-tiled.
 */
export function applyDynamic(
  map: MapLibreMap,
  settings: Settings,
  sel: SelectionStyle,
  lowPower: boolean,
  anchors: AnchorCollection | null = null,
) {
  if (!map.getLayer(LAYER.stateLabels)) return;
  const options = styleOptions(settings, lowPower, sel, relocatedIds(anchors));
  setSelection(map, options.selected, options, sel.dependencyIds);
}

/**
 * Draws viewport anchors for territories whose own label points are off
 * screen or under the key, and hides those points (T6's viewportLabels.ts).
 */
export const setViewportLabels = (
  map: MapLibreMap,
  anchors: AnchorCollection,
  settings: Settings,
  sel: SelectionStyle,
  lowPower: boolean,
) =>
  classicSetViewportLabels(map, anchors, styleOptions(settings, lowPower, sel));

/** Relief loads after the first paint so it never delays the borders. */
export const addRelief = (
  map: MapLibreMap,
  origin: string,
  settings: Settings,
  lowPower: boolean,
) => classicAddRelief(map, origin, styleOptions(settings, lowPower));

/** Registers the city, capital, ruins and hatch images (idempotent). */
export const addMarkers = (map: MapLibreMap) => addMarkerImages(map);

/**
 * T6's device heuristic (software GL, ≤ 4 cores and ≤ 4 GB, Save-Data,
 * reduced transparency), overridable with `?lowPower=1` or `?lowPower=0`.
 */
export const resolveLowPower = (search: string) => {
  const forced = new URLSearchParams(search).get('lowPower');
  if (forced === '1' || forced === '0') return forced === '1';
  try {
    return detectLowPower(
      document.createElement('canvas').getContext('webgl2'),
    );
  } catch {
    return detectLowPower();
  }
};

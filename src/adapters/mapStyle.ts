/**
 * T6 ADAPTER: the Classic-atlas MapLibre style (plan §2.1, Direction A),
 * integrated with `t3/classic-atlas-map-style` (@ 4dab0b1). The module lives
 * at src/atlas/classic/ (contract in its `contract.ts`, review and approved
 * screenshots in docs/product/style-review/). It has only type-level package
 * imports, so the app bundles it with its own MapLibre.
 *
 * This file maps the app's settings and selection onto T6's options; the
 * controller (src/atlas/mapController.ts) uses only the exports below.
 */
import type {
  LayerSpecification,
  Map as MapLibreMap,
  StyleSpecification,
} from 'maplibre-gl';
import {
  addMarkerImages,
  addRelief as classicAddRelief,
  buildLayers,
  classicAtlasStyle,
  detectLowPower,
  FEATURE_STATE,
  LAYER,
  legendEntries as classicLegendEntries,
  relocatedIds,
  reliefLayer,
  setViewportLabels as classicSetViewportLabels,
  SOURCE,
  withDefaults,
  type AnchorCollection,
  type ClassicStyleOptions,
  type DrawnClasses,
  type LegendEntry,
} from '../atlas/classic';
import type { Settings } from '../atlas/settings';
import { applyLayerProperties } from '../lib/styleDiff';
import {
  TEXTBOOK_COLOR,
  TEXTBOOK_MAP_ACCENT,
  TEXTBOOK_WASHES,
  type ThemeId,
} from '../styles/tokens';
import {
  addTextbookImages,
  textbookDependencyTint,
  themeLayers,
} from './textbookStyle';

export {
  attachNeatline,
  attachPaperGrain,
  drawnClasses,
  FEATURE_STATE,
  LAYER,
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
} from '../atlas/classic';

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
  /** Map style: Classic atlas (T6) or Modern textbook (textbookStyle.ts). */
  theme?: ThemeId;
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
  theme = 'classic',
}: StyleOptions): StyleSpecification => {
  const options = styleOptions(settings, lowPower);
  return {
    ...classicAtlasStyle(origin, {}, options),
    layers: styledLayers(theme, options),
  };
};

/**
 * Both themes' layer lists have the same ids in the same order
 * (textbookStyle.ts), so a theme switch only sets properties. With the relief
 * added (after first paint), it is placed as T6's `addRelief` places it.
 * T6's graticule is left out of both.
 */
export function styledLayers(
  theme: ThemeId,
  options: ClassicStyleOptions,
  withRelief = false,
): LayerSpecification[] {
  const classic = buildLayers(options);
  if (withRelief)
    classic.splice(
      classic.findIndex((l) => l.id === LAYER.edgeBand),
      0,
      reliefLayer(options),
    );
  // Owner decision (2026-11-18): no graticule on any map, in either theme.
  return themeLayers(
    classic.filter((l) => l.id !== LAYER.graticule),
    options,
    theme === 'textbook',
  );
}

type LooseMap = {
  setPaintProperty(id: string, k: string, v: unknown): void;
};

/** T6's `applyStyleOptions`, for both themes (see `applyLayerProperties`). */
function applyLayers(
  map: MapLibreMap,
  theme: ThemeId,
  options: ClassicStyleOptions,
) {
  const withRelief = Boolean(map.getLayer(LAYER.relief));
  const other: ThemeId = theme === 'textbook' ? 'classic' : 'textbook';
  applyLayerProperties(map, styledLayers(theme, options, withRelief), [
    styledLayers(other, options, withRelief),
  ]);
}

/**
 * Applies the theme, settings and the selection to a live map: paint and
 * layout only, and feature-state for the borders, so the year's sources are
 * never re-tiled by a selection. Marks the selected territory and its
 * dependencies (T6's `setSelection`, with the theme's layers).
 */
export function applyDynamic(
  map: MapLibreMap,
  settings: Settings,
  sel: SelectionStyle,
  lowPower: boolean,
  anchors: AnchorCollection | null = null,
  theme: ThemeId = 'classic',
) {
  if (!map.getLayer(LAYER.stateLabels)) return;
  const options = styleOptions(settings, lowPower, sel, relocatedIds(anchors));
  applyLayers(map, theme, options);
  if (!map.getSource(SOURCE.borders)) return;
  map.removeFeatureState({ source: SOURCE.borders });
  if (!options.selected) return;
  map.setFeatureState(
    { source: SOURCE.borders, id: options.selected.id },
    { [FEATURE_STATE.selected]: true },
  );
  for (const id of new Set(sel.dependencyIds))
    map.setFeatureState(
      { source: SOURCE.borders, id },
      { [FEATURE_STATE.overlordSelected]: true },
    );
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
  theme: ThemeId = 'classic',
) => {
  const options = styleOptions(settings, lowPower);
  classicAddRelief(map, origin, options);
  const relief = styledLayers(theme, options, true).find(
    (l) => l.id === LAYER.relief,
  );
  for (const [k, v] of Object.entries(relief?.paint ?? {}))
    (map as unknown as LooseMap).setPaintProperty(LAYER.relief, k, v);
};

/** Registers both themes' city, capital, ruins and hatch images (idempotent). */
export const addMarkers = (map: MapLibreMap) => {
  addMarkerImages(map);
  addTextbookImages(map);
};

/**
 * The map key's legend in the theme's colours: T6's entries (only classes on
 * screen), with B's swatches for Modern textbook. Icons keep T6's marker ids;
 * the key draws them in the theme's look.
 */
export function legendEntries(
  drawn: DrawnClasses,
  theme: ThemeId = 'classic',
): LegendEntry[] {
  const entries = classicLegendEntries(drawn);
  if (theme === 'classic') return entries;
  const sample = TEXTBOOK_WASHES[2];
  return entries.map((entry) => {
    if (entry.symbol.kind !== 'swatch') return entry;
    if (entry.id === 'selected')
      return {
        ...entry,
        symbol: {
          kind: 'swatch',
          fill: TEXTBOOK_WASHES[0].fill,
          edge: TEXTBOOK_MAP_ACCENT,
          hatch: true,
        },
      };
    if (entry.id === 'overlord-dependency')
      return {
        ...entry,
        symbol: {
          kind: 'swatch',
          fill: TEXTBOOK_COLOR.selectedFill,
          edge: TEXTBOOK_MAP_ACCENT,
        },
      };
    return {
      ...entry,
      symbol: {
        ...entry.symbol,
        fill: textbookDependencyTint(sample),
        edge: sample.edge,
      },
    };
  });
}

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

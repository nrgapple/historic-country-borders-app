/**
 * Legend metadata for the map key (T7). The key lists only classes the map
 * is actually drawing: pass what is on screen, get the entries in key order.
 */
import type { Map as MLMap } from 'maplibre-gl';
import {
  BORDER_ATTR,
  LABEL_ATTR,
  LAYER,
  MARKER,
  PLACE_KIND_SITE,
} from './contract';
import {
  COLOR,
  OVERLORD_SELECTED_FILL,
  WASHES,
  dependencyTint,
} from './tokens';

export type LegendSymbol =
  | { kind: 'swatch'; fill: string; edge: string; hatch?: boolean }
  | { kind: 'icon'; image: string };

export interface LegendEntry {
  id:
    | 'selected'
    | 'dependency'
    | 'overlord-dependency'
    | 'capital'
    | 'city'
    | 'site';
  label: string;
  symbol: LegendSymbol;
}

/** Which symbol classes are on screen right now. */
export interface DrawnClasses {
  selected: boolean;
  dependency: boolean;
  /** A dependency of the selected territory is visible. */
  overlordDependency: boolean;
  capital: boolean;
  city: boolean;
  site: boolean;
  /** Low-power mode hides the hatch, so the swatch drops it too. */
  lowPower?: boolean;
}

export function legendEntries(d: DrawnClasses): LegendEntry[] {
  const sample = WASHES[2];
  const out: LegendEntry[] = [];
  if (d.selected)
    out.push({
      id: 'selected',
      label: 'Selected territory',
      symbol: { kind: 'swatch', fill: COLOR.selectedFill, edge: COLOR.accent },
    });
  if (d.overlordDependency)
    out.push({
      id: 'overlord-dependency',
      label: 'Ruled by the selected territory',
      symbol: {
        kind: 'swatch',
        fill: OVERLORD_SELECTED_FILL,
        edge: COLOR.accent,
      },
    });
  if (d.dependency)
    out.push({
      id: 'dependency',
      label: 'Colony, protectorate or vassal (lighter tint of its ruler)',
      symbol: {
        kind: 'swatch',
        fill: dependencyTint(sample),
        edge: sample.edge,
        hatch: !d.lowPower,
      },
    });
  if (d.capital)
    out.push({
      id: 'capital',
      label: 'Capital',
      symbol: { kind: 'icon', image: MARKER.capital },
    });
  if (d.city)
    out.push({
      id: 'city',
      label: 'City',
      symbol: { kind: 'icon', image: MARKER.city },
    });
  if (d.site)
    out.push({
      id: 'site',
      label: 'Archaeological site (ruins)',
      symbol: { kind: 'icon', image: MARKER.site },
    });
  return out;
}

const present = (map: MLMap, layer: string) =>
  map.getLayer(layer) ? map.queryRenderedFeatures({ layers: [layer] }) : [];

/** Reads the drawn classes from the rendered map. Call on `moveend`/`idle`, never per frame. */
export function drawnClasses(map: MLMap, lowPower = false): DrawnClasses {
  const fills = present(map, LAYER.territoryFill);
  const places = present(map, LAYER.places);
  return {
    selected: fills.some((f) => f.state?.selected),
    overlordDependency: fills.some((f) => f.state?.overlordSelected),
    dependency: fills.some((f) => f.properties?.[BORDER_ATTR.dependency] === 1),
    capital:
      present(map, LAYER.capitals).length +
        present(map, LAYER.selectedCapital).length >
      0,
    city: places.some(
      (f) => f.properties?.[LABEL_ATTR.placeKind] !== PLACE_KIND_SITE,
    ),
    site: places.some(
      (f) => f.properties?.[LABEL_ATTR.placeKind] === PLACE_KIND_SITE,
    ),
    lowPower,
  };
}

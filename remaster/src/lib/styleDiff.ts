import type {
  FilterSpecification,
  LayerSpecification,
  Map as MapLibreMap,
} from 'maplibre-gl';

type LooseMap = {
  setLayoutProperty(id: string, k: string, v: unknown): void;
  setPaintProperty(id: string, k: string, v: unknown): void;
};

/**
 * Sets every paint, layout and filter value of `target` on a live map, for
 * layers the map has. MapLibre skips values equal to the current ones, so
 * only what changed is touched. A property that one of the `alternatives`
 * (the other themes' layer lists) sets but `target` leaves out is reset to
 * its default, so switching themes back and forth never leaves a stale value.
 */
export function applyLayerProperties(
  map: MapLibreMap,
  target: readonly LayerSpecification[],
  alternatives: ReadonlyArray<readonly LayerSpecification[]> = [],
) {
  const keys = new Map<string, { layout: Set<string>; paint: Set<string> }>();
  for (const list of alternatives)
    for (const layer of list) {
      const entry = keys.get(layer.id) ?? {
        layout: new Set<string>(),
        paint: new Set<string>(),
      };
      Object.keys(layer.layout ?? {}).forEach((k) => entry.layout.add(k));
      Object.keys(layer.paint ?? {}).forEach((k) => entry.paint.add(k));
      keys.set(layer.id, entry);
    }
  const loose = map as unknown as LooseMap;
  for (const layer of target) {
    if (!map.getLayer(layer.id)) continue;
    if ('filter' in layer)
      map.setFilter(
        layer.id,
        (layer.filter ?? null) as FilterSpecification | null,
      );
    const layout = (layer.layout ?? {}) as Record<string, unknown>;
    const paint = (layer.paint ?? {}) as Record<string, unknown>;
    const other = keys.get(layer.id);
    for (const k of new Set([...Object.keys(layout), ...(other?.layout ?? [])]))
      loose.setLayoutProperty(layer.id, k, layout[k]);
    for (const k of new Set([...Object.keys(paint), ...(other?.paint ?? [])]))
      loose.setPaintProperty(layer.id, k, paint[k]);
  }
}

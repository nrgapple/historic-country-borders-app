import type { Map as MapLibreMap } from 'maplibre-gl';

/**
 * Folds the map credit into its (i) button once the map first settles.
 * MapLibre only applies its compact style if the credit already has text
 * when the control is added, which races the first source load, so this
 * sets it explicitly. About and the key carry the same sources in full.
 */
export function collapseAttributionOnIdle(
  map: MapLibreMap,
  container: HTMLElement,
) {
  map.once('idle', () => {
    const attribution = container.querySelector('.maplibregl-ctrl-attrib');
    attribution?.classList.add('maplibregl-compact');
    attribution?.classList.remove('maplibregl-compact-show');
  });
}

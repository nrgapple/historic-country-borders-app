import { AttributionControl, Map as MLMap, NavigationControl, setWorkerUrl, type GeoJSONSource, type MapMouseEvent } from 'maplibre-gl';
// MapLibre 6 is ESM-only and resolves its worker next to its own module; after
// bundling, point it at the hashed worker asset on our origin explicitly.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

setWorkerUrl(workerUrl);
import { atlasStyle, borderLayers, bordersSource, labelsSource } from './style';
import { actions, getState, readView, subscribe } from './store';
import { labelsUrl, loadIndex, mapUrl, prefetchYears, YEARS, type YearIndex } from './data';

/**
 * Imperative MapLibre controller. It owns the map and subscribes to the store;
 * React never re-renders because the camera moved. The year file is handed to
 * MapLibre by URL, so it is downloaded and parsed in MapLibre's worker and the
 * main thread never holds a parsed copy.
 */
export function mountMap(container: HTMLElement) {
  const origin = location.origin;
  const { year } = getState();
  const view = readView();
  const map = new MLMap({
    container,
    style: atlasStyle(origin),
    center: view.center,
    zoom: view.zoom,
    minZoom: 1,
    maxZoom: 10,
    renderWorldCopies: true,
    attributionControl: false,
    // Fewer pixels to fill on weak integrated GPUs; text stays crisp via SDF.
    pixelRatio: Math.min(devicePixelRatio, 2),
    fadeDuration: 150,
  });
  map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
  map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
  (window as unknown as { __map: MLMap }).__map = map; // measurement hook

  // The page preloads this year's file. Wait for that download to finish before
  // MapLibre's worker requests the same URL, so the worker is served from the
  // HTTP cache instead of downloading it a second time; the main thread only
  // drains bytes and never parses them.
  const firstUrl = mapUrl(year);
  const warm = (url: string) => fetch(url, { credentials: 'same-origin' }).then((r) => r.arrayBuffer()).catch(() => undefined);
  const warmed = warm(firstUrl);
  const warmedLabels = warm(labelsUrl(year));
  const addBorders = () => {
    if (map.getSource('borders')) return;
    map.addSource('borders', bordersSource(loadedYear === year ? firstUrl : mapUrl(loadedYear)));
    map.addSource('labels', labelsSource(labelsUrl(loadedYear)));
    for (const layer of borderLayers) map.addLayer(layer);
  };
  // isStyleLoaded() is also false while basemap tiles load, so track the
  // one-time 'style.load' ourselves.
  const styleLoaded = new Promise<void>((resolve) => map.once('style.load', () => resolve()));
  void Promise.all([warmed, warmedLabels, styleLoaded]).then(addBorders);

  let index: YearIndex | null = null;
  let loadedYear = year;

  const applySelection = () => {
    if (!map.getSource('borders')) return;
    map.removeFeatureState({ source: 'borders' });
    const name = getState().selected;
    if (!name || !index || index.year !== loadedYear) return;
    index.territories.forEach((t, id) => {
      if (t[0] === name) map.setFeatureState({ source: 'borders', id }, { selected: true });
    });
  };

  const loadYearIndex = (y: number) =>
    loadIndex(y).then((ix) => {
      if (y !== getState().year) return;
      index = ix;
      // A shared or carried-over selection survives only if the name exists this year.
      const name = getState().selected;
      if (name && !ix.territories.some((t) => t[0] === name)) actions.select(null);
      applySelection();
    }, () => actions.setStatus('error'));

  map.on('click', (e: MapMouseEvent) => {
    const hit = map.queryRenderedFeatures(e.point, { layers: ['borders-fill'] })[0];
    const id = typeof hit?.id === 'number' ? hit.id : undefined;
    const name = id !== undefined && index ? index.territories[id]?.[0] : undefined;
    actions.select(name ?? null);
  });
  map.on('mousemove', 'borders-fill', () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', 'borders-fill', () => (map.getCanvas().style.cursor = ''));
  map.on('moveend', () => {
    const c = map.getCenter();
    actions.writeView(c.lng, c.lat, map.getZoom());
  });
  map.on('sourcedata', (e) => {
    if (e.sourceId === 'borders' && e.isSourceLoaded) applySelection();
  });
  map.on('idle', () => {
    if (getState().status !== 'loading' || loadedYear !== getState().year) return;
    actions.setStatus('ready');
    performance.mark(`borders-idle:${loadedYear}`);
    const i = YEARS.indexOf(loadedYear);
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1200));
    idle(() => prefetchYears([YEARS[i - 1], YEARS[i + 1]].filter((y) => y !== undefined)));
  });
  map.on('error', (e) => {
    if ((e as { sourceId?: string }).sourceId === 'borders') actions.setStatus('error');
  });

  void loadYearIndex(year);
  let lastSelected = getState().selected;
  const unsubscribe = subscribe(() => {
    const s = getState();
    if (s.year !== loadedYear) {
      loadedYear = s.year;
      index = null;
      (map.getSource('borders') as GeoJSONSource | undefined)?.setData(mapUrl(s.year));
      (map.getSource('labels') as GeoJSONSource | undefined)?.setData(labelsUrl(s.year));
      void loadYearIndex(s.year);
    }
    if (s.selected !== lastSelected) {
      lastSelected = s.selected;
      applySelection();
    }
  });

  return {
    map,
    flyToBounds(b: [number, number, number, number]) {
      map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 48, maxZoom: 6, duration: 600 });
    },
    destroy() {
      unsubscribe();
      map.remove();
    },
  };
}

export const supportsWebGL2 = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
};

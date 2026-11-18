import { AttributionControl, Map as MLMap, NavigationControl, setWorkerUrl, type GeoJSONSource, type MapMouseEvent } from 'maplibre-gl';
// MapLibre 6 is ESM-only and resolves its worker next to its own module; after
// bundling, point it at the hashed worker asset on our origin explicitly.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

setWorkerUrl(workerUrl);
import {
  addMarkerImages,
  addRelief,
  applyStyleOptions,
  classicAtlasStyle,
  detectLowPower,
  LAYER,
  SOURCE,
  setSelection,
  withDefaults,
  type ClassicStyleOptions,
  type Selection,
} from './style';
import { actions, getState, readView, subscribe } from './store';
import { capitalsUrl, labelsUrl, loadIndex, mapUrl, prefetchYears, YEARS, type YearIndex } from './data';

/** Style options from the URL, for the harness: ?lowPower=1&projector=1&text=large&case=upper&opacity=0.5&border=3&labels=0 */
export function optionsFromQuery(search = location.search): Partial<ClassicStyleOptions> {
  const p = new URLSearchParams(search);
  const num = (k: string) => (p.get(k) !== null && Number.isFinite(Number(p.get(k))) ? Number(p.get(k)) : undefined);
  const settings: Partial<ClassicStyleOptions['settings']> = {};
  const text = p.get('text');
  if (text === 'small' || text === 'medium' || text === 'large') settings.textSize = text;
  if (p.get('case') === 'upper') settings.textCase = 'upper';
  if (num('opacity') !== undefined) settings.countryOpacity = num('opacity');
  if (num('border') !== undefined) settings.borderThickness = num('border');
  if (p.get('labels') === '0') settings.showLabels = false;
  const out: Partial<ClassicStyleOptions> = { settings: settings as ClassicStyleOptions['settings'] };
  if (p.has('lowPower')) out.lowPower = p.get('lowPower') === '1';
  if (p.get('projector') === '1') out.projectorText = true;
  return out;
}

/**
 * Imperative MapLibre controller. It owns the map and subscribes to the store;
 * React never re-renders because the camera moved. The year file is handed to
 * MapLibre by URL, so it is downloaded and parsed in MapLibre's worker and the
 * main thread never holds a parsed copy.
 */
export function mountMap(container: HTMLElement, initial: Partial<ClassicStyleOptions> = optionsFromQuery()) {
  const origin = location.origin;
  const { year } = getState();
  const view = readView();
  // Low-power default from device hints, decided before the style is built.
  let options = withDefaults({ ...initial, lowPower: initial.lowPower ?? probeLowPower() });
  const map = new MLMap({
    container,
    style: classicAtlasStyle(origin, {}, options),
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
  map.on('styleimagemissing', () => addMarkerImages(map));

  // The page preloads this year's file. Wait for that download to finish before
  // MapLibre's worker requests the same URL, so the worker is served from the
  // HTTP cache instead of downloading it a second time; the main thread only
  // drains bytes and never parses them.
  const warm = (url: string) => fetch(url, { credentials: 'same-origin' }).then((r) => r.arrayBuffer()).catch(() => undefined);
  const warmed = Promise.all([warm(mapUrl(year)), warm(labelsUrl(year))]);
  const styleLoaded = new Promise<void>((resolve) => map.once('style.load', () => resolve()));
  let loadedYear = year;
  const setYearData = (y: number) => {
    (map.getSource(SOURCE.borders) as GeoJSONSource | undefined)?.setData(mapUrl(y));
    (map.getSource(SOURCE.labels) as GeoJSONSource | undefined)?.setData(labelsUrl(y));
    (map.getSource(SOURCE.capitals) as GeoJSONSource | undefined)?.setData(capitalsUrl(y));
  };
  void Promise.all([warmed, styleLoaded]).then(() => {
    addMarkerImages(map);
    setYearData(loadedYear);
    // Relief is decoration: fetch it only after the borders have painted.
    map.once('idle', () => addRelief(map, origin, options));
  });

  let index: YearIndex | null = null;
  const selection = (): Selection | null => {
    const name = getState().selected;
    if (!name || !index || index.year !== loadedYear) return null;
    const id = index.territories.findIndex((t) => t[0] === name);
    return id < 0 ? null : { id, name };
  };
  const applySelection = () => {
    if (!map.getSource(SOURCE.borders)) return;
    options = { ...options, selected: selection() };
    setSelection(map, options.selected, options);
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
    const hit = map.queryRenderedFeatures(e.point, { layers: [LAYER.territoryFill] })[0];
    const id = typeof hit?.id === 'number' ? hit.id : undefined;
    const name = id !== undefined && index ? index.territories[id]?.[0] : undefined;
    actions.select(name ?? null);
  });
  map.on('mousemove', LAYER.territoryFill, () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', LAYER.territoryFill, () => (map.getCanvas().style.cursor = ''));
  map.on('moveend', () => {
    const c = map.getCenter();
    actions.writeView(c.lng, c.lat, map.getZoom());
  });
  // Dependencies of the selection are found in loaded tiles; mark new tiles too.
  map.on('sourcedata', (e) => {
    if (e.sourceId === SOURCE.borders && e.isSourceLoaded) applySelection();
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
    if ((e as { sourceId?: string }).sourceId === SOURCE.borders) actions.setStatus('error');
  });

  void loadYearIndex(year);
  let lastSelected = getState().selected;
  const unsubscribe = subscribe(() => {
    const s = getState();
    if (s.year !== loadedYear) {
      loadedYear = s.year;
      index = null;
      setYearData(s.year);
      void loadYearIndex(s.year);
    }
    if (s.selected !== lastSelected) {
      lastSelected = s.selected;
      applySelection();
    }
  });

  return {
    map,
    get options() {
      return options;
    },
    /** Settings, Projector text or low-power changed. */
    setOptions(partial: Partial<ClassicStyleOptions>) {
      options = withDefaults({ ...options, ...partial, settings: { ...options.settings, ...partial.settings } });
      applyStyleOptions(map, options);
    },
    flyToBounds(b: [number, number, number, number]) {
      map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 48, maxZoom: 6, duration: 600 });
    },
    destroy() {
      unsubscribe();
      map.remove();
    },
  };
}

function probeLowPower() {
  const gl = document.createElement('canvas').getContext('webgl2');
  const low = detectLowPower(gl);
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
  return low;
}

export const supportsWebGL2 = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
};

import {
  AttributionControl,
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapMouseEvent,
} from 'maplibre-gl';
// MapLibre 6 is ESM-only and resolves its worker next to its own module;
// after bundling, point it at the hashed worker asset on our origin.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import {
  addMarkers,
  addRelief,
  applyDynamic,
  attachNeatline,
  attachPaperGrain,
  createStyle,
  INTERACTIVE_LAYERS,
  LOW_POWER_DROPS_GRAIN,
  LOW_POWER_SIMPLE_NEATLINE,
  resolveLowPower,
  SOURCE,
  type SelectionStyle,
} from '../adapters/mapStyle';
import {
  capitalsUrl,
  framingBounds,
  labelsUrl,
  loadYearIndex,
  mapUrl,
  prefetchYears,
  type YearIndex,
} from '../adapters/yearData';
import { hasMapView, parseMapView } from '../lib/mapView';
import { focusPadding, paddingOffset } from '../lib/places';
import { actions, getState, subscribe, YEARS, type AtlasState, type Bbox } from './store';

setWorkerUrl(workerUrl);

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export interface MapHandle {
  map: MapLibreMap;
  destroy: () => void;
}

/**
 * The imperative MapLibre controller. It owns the map and subscribes to the
 * store, so camera moves never re-render React. Year files are handed to
 * MapLibre by URL: its worker downloads and parses them and the main thread
 * never holds a parsed copy of the polygons.
 */
export function mountMap(container: HTMLElement): MapHandle {
  const origin = window.location.origin;
  const initial = getState();
  const view = parseMapView(window.location.search);
  // A shared place with no camera in the link is framed once it is known.
  let frameSharedPlace = Boolean(initial.place) && !hasMapView(window.location.search);
  // The camera is written to the URL only when it changes, so a resize (or a
  // plain deep link) never adds a camera the visitor did not choose.
  let lastView = `${view.longitude.toFixed(4)},${view.latitude.toFixed(4)},${view.zoom.toFixed(2)}`;
  const lowPower = resolveLowPower(window.location.search);
  const map = new MapLibreMap({
    container,
    style: createStyle({ origin, settings: initial.settings, lowPower }),
    center: [view.longitude, view.latitude],
    zoom: view.zoom,
    minZoom: 1,
    maxZoom: 10,
    renderWorldCopies: true,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    maxPitch: 0,
    // Fewer pixels to fill on weak integrated GPUs; SDF text stays crisp.
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    fadeDuration: 150,
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
  map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
  map.on('styleimagemissing', () => addMarkers(map));
  map.once('style.load', () => addMarkers(map));

  // T6's degree-ladder neatline (a single rule on phones and in low power)
  // and the paper grain over the map frame, dropped in low power.
  const cleanups: Array<() => void> = [];
  const frame = container.parentElement ?? container;
  const neatline = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  neatline.setAttribute('class', 'neatline');
  neatline.setAttribute('aria-hidden', 'true');
  frame.append(neatline);
  cleanups.push(() => neatline.remove());
  const phone = () => window.matchMedia?.('(max-width: 699px)').matches ?? false;
  cleanups.push(attachNeatline(map, neatline, () => phone() || (lowPower && LOW_POWER_SIMPLE_NEATLINE)));
  if (!(lowPower && LOW_POWER_DROPS_GRAIN)) cleanups.push(attachPaperGrain(frame));
  container.dataset.lowPower = String(lowPower);
  // The credit strip and About carry the same sources: start the compact
  // attribution closed (MapLibre opens it on load) so it does not cover the
  // map; its (i) button still opens it.
  map.once('idle', () =>
    container
      .querySelector('.maplibregl-ctrl-attrib.maplibregl-compact-show')
      ?.classList.remove('maplibregl-compact-show'),
  );

  let loadedYear = initial.year;
  let index: YearIndex | null = null;
  let names = new Map<string, number>();
  let dataRequested = false;
  let destroyed = false;

  const setYearData = (year: number) => {
    const borders = map.getSource(SOURCE.borders) as GeoJSONSource | undefined;
    const labels = map.getSource(SOURCE.labels) as GeoJSONSource | undefined;
    const capitalPoints = map.getSource(SOURCE.capitals) as GeoJSONSource | undefined;
    if (!borders || !labels) return;
    container.removeAttribute('data-loaded');
    map.removeFeatureState({ source: SOURCE.borders });
    void borders.setData(mapUrl(year));
    void labels.setData(labelsUrl(year));
    void capitalPoints?.setData(capitalsUrl(year) ?? { type: 'FeatureCollection', features: [] });
    dataRequested = true;
    // The index may already be here: re-apply the selection to the new data.
    if (index?.year === year) applySelection();
  };

  // The page preloads the first year's files. Wait for those downloads to
  // finish before MapLibre's worker asks for the same URLs, so the worker is
  // served from the HTTP cache instead of downloading them a second time.
  const warm = (url: string) =>
    fetch(url, { credentials: 'same-origin' })
      .then((response) => response.arrayBuffer())
      .catch(() => undefined);
  const styleLoaded = new Promise<void>((resolve) => map.once('style.load', () => resolve()));
  void Promise.all([warm(mapUrl(initial.year)), warm(labelsUrl(initial.year)), styleLoaded]).then(() => {
    if (!destroyed) setYearData(loadedYear);
  });

  const selection = (): SelectionStyle => {
    const place = getState().place;
    const id = place ? names.get(place) : undefined;
    return {
      id: id ?? null,
      name: id === undefined ? null : place,
      dependencyIds:
        id === undefined ? [] : (index?.territories ?? []).filter((t) => t.dep && t.ov === id).map((t) => t.id),
    };
  };

  /**
   * Every polygon of a territory shares its id (T1), so one feature-state
   * selects the whole territory; T6's setSelection also marks its
   * dependencies, and re-lays out only the label and capital layers.
   */
  const applySelection = () => {
    if (!map.getSource(SOURCE.borders)) return;
    applyDynamic(map, getState().settings, selection(), lowPower);
  };

  const fit = (bounds: Bbox) => {
    const padding = focusPadding({ width: container.clientWidth, height: container.clientHeight });
    const camera = map.cameraForBounds(
      [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ],
      { padding, maxZoom: 6 },
    );
    if (!camera) return;
    // Move with `offset` rather than `padding`: padding stays on the camera
    // and would skew the centre written to shared links.
    map.easeTo({ ...camera, offset: paddingOffset(padding), duration: prefersReducedMotion() ? 0 : 900 });
  };

  const loadIndex = (year: number) => {
    loadYearIndex(year).then(
      (loaded) => {
        if (destroyed || year !== getState().year) return;
        index = loaded;
        names = new Map(loaded.territories.map((t) => [t.NAME, t.id]));
        const place = getState().place;
        // A shared or carried-over place survives only if it exists this year.
        if (place && !names.has(place)) actions.select(null);
        else if (place && frameSharedPlace) fit(framingBounds(loaded.territories[names.get(place)!].bbox));
        frameSharedPlace = false;
        applySelection();
      },
      () => {
        if (!destroyed && year === getState().year) actions.setStatus('error');
      },
    );
  };
  loadIndex(initial.year);

  map.on('click', (event: MapMouseEvent) => {
    const hit = map.queryRenderedFeatures(event.point, { layers: INTERACTIVE_LAYERS })[0];
    const id = typeof hit?.id === 'number' ? hit.id : undefined;
    const name = id !== undefined ? index?.territories[id]?.NAME : undefined;
    actions.select(name ?? null, { track: Boolean(name) });
  });
  for (const layer of INTERACTIVE_LAYERS) {
    map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
  }
  map.on('moveend', () => {
    const center = map.getCenter().wrap();
    const key = `${center.lng.toFixed(4)},${center.lat.toFixed(4)},${map.getZoom().toFixed(2)}`;
    if (key === lastView) return;
    lastView = key;
    actions.writeView({ longitude: center.lng, latitude: center.lat, zoom: map.getZoom() });
  });
  map.once('idle', () => addRelief(map, origin, getState().settings, lowPower));
  map.on('idle', () => {
    const state = getState();
    if (!dataRequested || loadedYear !== state.year) return;
    container.setAttribute('data-loaded', '');
    if (state.status !== 'loading' || !index) return;
    actions.setStatus('ready');
    performance.mark(`borders-idle:${loadedYear}`);
    const i = YEARS.indexOf(loadedYear);
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
    idle(() => prefetchYears([YEARS[i - 1], YEARS[i + 1]].filter((y) => y !== undefined)));
  });
  map.on('error', (event) => {
    const sourceId = (event as { sourceId?: string }).sourceId;
    if (sourceId === SOURCE.borders || sourceId === SOURCE.labels) actions.setStatus('error');
    // A listener replaces MapLibre's own logging; keep other errors visible.
    else console.error(event.error);
  });

  // The map fills a container whose size changes with the panel, focus mode
  // and Safari's toolbars; MapLibre only tracks window resizes on its own.
  const resizer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => map.resize());
  resizer?.observe(container);

  let last: AtlasState = initial;
  const unsubscribe = subscribe(() => {
    const state = getState();
    if (state.year !== loadedYear || state.reload !== last.reload) {
      loadedYear = state.year;
      index = null;
      names = new Map();
      setYearData(state.year);
      loadIndex(state.year);
    } else if (state.place !== last.place) {
      applySelection();
    } else if (state.settings !== last.settings) {
      applySelection();
    }
    if (state.frame && state.frame !== last.frame) fit(state.frame.bounds);
    last = state;
  });

  return {
    map,
    destroy() {
      destroyed = true;
      unsubscribe();
      cleanups.forEach((cleanup) => cleanup());
      resizer?.disconnect();
      map.remove();
    },
  };
}

export const supportsWebGL2 = () => {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
};

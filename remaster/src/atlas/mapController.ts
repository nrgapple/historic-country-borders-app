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
  labelTerritories,
  landPolygons,
  resolveLowPower,
  setViewportLabels,
  SOURCE,
  viewportAnchors,
  type AnchorCollection,
  type LabelTerritory,
  type Rect,
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
import { loadLand } from '../lib/land';
import { hasMapView, parseMapView } from '../lib/mapView';
import { focusPadding } from '../lib/places';
import {
  actions,
  getState,
  subscribe,
  YEARS,
  type AtlasState,
  type Bbox,
} from './store';

setWorkerUrl(workerUrl);

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export interface MapHandle {
  map: MapLibreMap;
  /** T6's low-power decision for this device (the legend drops the hatch). */
  lowPower: boolean;
  /**
   * Re-checks state names against the panels over the map. Call after an
   * element marked `data-map-obstacle` opens, closes or resizes.
   */
  refreshLabels: () => void;
  destroy: () => void;
}

/** The collapsed map key's height plus its offset from the map's top edge on phones. */
const MAP_KEY_BAR_PX = 64;

const EMPTY_ANCHORS: AnchorCollection = {
  type: 'FeatureCollection',
  features: [],
};

/** Panels over the map (`data-map-obstacle`), in px relative to the map. */
function obstaclesOver(container: HTMLElement): Rect[] {
  const stage = container.closest('.stage') ?? container.parentElement;
  if (!stage) return [];
  const base = container.getBoundingClientRect();
  const out: Rect[] = [];
  stage.querySelectorAll<HTMLElement>('[data-map-obstacle]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    out.push({
      left: r.left - base.left,
      top: r.top - base.top,
      right: r.right - base.left,
      bottom: r.bottom - base.top,
    });
  });
  return out;
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
  let frameSharedPlace =
    Boolean(initial.place) && !hasMapView(window.location.search);
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
  const neatline = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg',
  );
  neatline.setAttribute('class', 'neatline');
  neatline.setAttribute('aria-hidden', 'true');
  frame.append(neatline);
  cleanups.push(() => neatline.remove());
  const phone = () =>
    window.matchMedia?.('(max-width: 699px)').matches ?? false;
  cleanups.push(
    attachNeatline(
      map,
      neatline,
      () => phone() || (lowPower && LOW_POWER_SIMPLE_NEATLINE),
    ),
  );
  if (!(lowPower && LOW_POWER_DROPS_GRAIN))
    cleanups.push(attachPaperGrain(frame));
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
  // Viewport-aware state names (T6 viewportLabels.ts): the year's label
  // points by territory, and the anchors drawn for the current view.
  let labelInfo = new Map<number, LabelTerritory>();
  let anchors: AnchorCollection = EMPTY_ANCHORS;
  let anchorsKey = '';
  let labelsDirty = false;

  const showAnchors = (next: AnchorCollection) => {
    const key = JSON.stringify([
      next.features.map((f) => [f.id, f.geometry.coordinates]),
      next.hidden ?? [],
    ]);
    if (key === anchorsKey) return;
    anchorsKey = key;
    anchors = next;
    setViewportLabels(map, next, getState().settings, selection(), lowPower);
  };
  // The water mask: the 110m land the key's globe also uses (one download).
  let land: ReturnType<typeof landPolygons> | null = null;
  let landState: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  const runRelabel = () => {
    if (destroyed || !map.getSource(SOURCE.viewportLabels)) return;
    if (map.isMoving()) return; // the next idle runs it
    // Low-power devices (school Chromebooks) skip the viewport relabel: it
    // costs ~25-75 ms per settled move on a fast but loaded machine, and the
    // built-in label points still name every territory near its centre.
    if (lowPower || !getState().settings.showLabels || !labelInfo.size) {
      labelsDirty = false;
      showAnchors(EMPTY_ANCHORS);
      return;
    }
    if (landState === 'idle') {
      landState = 'loading';
      void loadLand().then((fc) => {
        land = fc ? landPolygons(fc) : null;
        landState = fc ? 'ready' : 'failed';
        if (!destroyed) relabel();
      });
    }
    if (landState === 'loading') return;
    labelsDirty = false;
    const start = performance.now();
    const next = viewportAnchors(map, {
      territories: labelInfo,
      bboxOf: (id) => index?.territories[id]?.bbox,
      land,
      obstacles: obstaclesOver(container),
      selectedId: selection().id,
      previous: anchors,
    });
    // Visible in the Performance panel; runs once per settled move.
    performance.measure?.('viewport-labels', { start });
    showAnchors(next);
  };
  let relabelQueued = false;
  /** Recomputes once the map is settled, in idle time: never while it moves. */
  const relabel = () => {
    labelsDirty = true;
    if (relabelQueued || !map.loaded() || map.isMoving()) return;
    relabelQueued = true;
    const run = () => {
      relabelQueued = false;
      if (labelsDirty) runRelabel();
    };
    if (window.requestIdleCallback)
      window.requestIdleCallback(run, { timeout: 400 });
    else window.setTimeout(run, 0);
  };
  const loadLabels = (year: number) => {
    fetch(labelsUrl(year), { credentials: 'same-origin' })
      .then((response) => response.json())
      .then((labels) => {
        if (destroyed || year !== loadedYear) return;
        labelInfo = labelTerritories(labels);
        relabel();
      })
      .catch(() => undefined);
  };

  const setYearData = (year: number) => {
    const borders = map.getSource(SOURCE.borders) as GeoJSONSource | undefined;
    const labels = map.getSource(SOURCE.labels) as GeoJSONSource | undefined;
    const capitalPoints = map.getSource(SOURCE.capitals) as
      GeoJSONSource | undefined;
    if (!borders || !labels) return;
    container.removeAttribute('data-loaded');
    map.removeFeatureState({ source: SOURCE.borders });
    labelInfo = new Map();
    showAnchors(EMPTY_ANCHORS);
    loadLabels(year);
    void borders.setData(mapUrl(year));
    void labels.setData(labelsUrl(year));
    void capitalPoints?.setData(
      capitalsUrl(year) ?? { type: 'FeatureCollection', features: [] },
    );
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
  const styleLoaded = new Promise<void>((resolve) =>
    map.once('style.load', () => resolve()),
  );
  void Promise.all([
    warm(mapUrl(initial.year)),
    warm(labelsUrl(initial.year)),
    styleLoaded,
  ]).then(() => {
    if (!destroyed) setYearData(loadedYear);
  });

  const selection = (): SelectionStyle => {
    const place = getState().place;
    const id = place ? names.get(place) : undefined;
    return {
      id: id ?? null,
      name: id === undefined ? null : place,
      dependencyIds:
        id === undefined
          ? []
          : (index?.territories ?? [])
              .filter((t) => t.dep && t.ov === id)
              .map((t) => t.id),
    };
  };

  /**
   * Every polygon of a territory shares its id (T1), so one feature-state
   * selects the whole territory; T6's setSelection also marks its
   * dependencies, and re-lays out only the label and capital layers.
   */
  const applySelection = () => {
    if (!map.getSource(SOURCE.borders)) return;
    applyDynamic(map, getState().settings, selection(), lowPower, anchors);
  };

  const fit = (bounds: Bbox) => {
    const padding = focusPadding({
      width: container.clientWidth,
      height: container.clientHeight,
      // A framed place opens the sheet; on phones the collapsed map key then
      // sits at the top of the map (MapKey.css), so keep the place below it.
      topbarBottom: phone() ? MAP_KEY_BAR_PX : 0,
    });
    const camera = map.cameraForBounds(
      [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ],
      { padding, maxZoom: 6 },
    );
    if (!camera) return;
    // MapLibre 6 already shifts `camera.center` by the asymmetric padding
    // (cameraForBoxAndBearing), so adding `offset` would shift it twice. Ease
    // to the centre and zoom only: no padding stays on the camera, so the
    // centre written to shared links stays the map's centre.
    map.easeTo({
      center: camera.center,
      zoom: camera.zoom,
      duration: prefersReducedMotion() ? 0 : 900,
    });
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
        else if (place && frameSharedPlace)
          fit(framingBounds(loaded.territories[names.get(place)!].bbox));
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
    const hit = map.queryRenderedFeatures(event.point, {
      layers: INTERACTIVE_LAYERS,
    })[0];
    const id = typeof hit?.id === 'number' ? hit.id : undefined;
    const name = id !== undefined ? index?.territories[id]?.NAME : undefined;
    actions.select(name ?? null, { track: Boolean(name) });
  });
  for (const layer of INTERACTIVE_LAYERS) {
    map.on(
      'mouseenter',
      layer,
      () => (map.getCanvas().style.cursor = 'pointer'),
    );
    map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
  }
  map.on('moveend', relabel);
  map.on('resize', relabel);
  map.on('idle', () => {
    if (labelsDirty) relabel();
  });
  map.on('moveend', () => {
    const center = map.getCenter().wrap();
    const key = `${center.lng.toFixed(4)},${center.lat.toFixed(4)},${map.getZoom().toFixed(2)}`;
    if (key === lastView) return;
    lastView = key;
    actions.writeView({
      longitude: center.lng,
      latitude: center.lat,
      zoom: map.getZoom(),
    });
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
    const idle =
      window.requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 1200));
    idle(() =>
      prefetchYears(
        [YEARS[i - 1], YEARS[i + 1]].filter((y) => y !== undefined),
      ),
    );
  });
  map.on('error', (event) => {
    const sourceId = (event as { sourceId?: string }).sourceId;
    if (sourceId === SOURCE.borders || sourceId === SOURCE.labels)
      actions.setStatus('error');
    // A listener replaces MapLibre's own logging; keep other errors visible.
    else console.error(event.error);
  });

  // The map fills a container whose size changes with the panel, focus mode
  // and Safari's toolbars; MapLibre only tracks window resizes on its own.
  const resizer =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => map.resize());
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
      // The panel opens or closes over the map: re-check names under it.
      relabel();
    } else if (state.settings !== last.settings) {
      applySelection();
      relabel();
    }
    if (state.frame && state.frame !== last.frame) fit(state.frame.bounds);
    last = state;
  });

  return {
    map,
    lowPower,
    refreshLabels: relabel,
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

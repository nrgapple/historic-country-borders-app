import {
  addProtocol,
  AttributionControl,
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapMouseEvent,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import pa from '../data/pa.json';
import {
  attachPaperGrain,
  LOW_POWER_DROPS_GRAIN,
  resolveLowPower,
} from '../adapters/mapStyle';
import { trackEvent } from '../lib/analytics';
import { hasMapView, parseMapView } from '../lib/mapView';
import { focusPadding } from '../lib/places';
import {
  actions,
  getState,
  subscribe,
  type AtlasState,
  type Bbox,
} from '../atlas/store';
import type { MapHandle } from '../atlas/mapController';
import {
  applyPaOptions,
  createPaStyle,
  DISTRICT_SOURCE_LAYER,
  PA_BOUNDS,
  PA_INTERACTIVE_LAYERS,
  PA_MAX_BOUNDS,
  PA_MAX_ZOOM,
  PA_MIN_ZOOM,
  PA_PROTOCOL,
  PA_SOURCE,
  type PaStyleOptions,
} from './paStyle';
import { loadDistrictIndex, type DistrictIndex } from './usePASchoolDistricts';
import { HATCH_IMAGE, hatchImage, piaaName, ROMAN } from './colourBy';
import { sportsLabelLines } from './districts';

setWorkerUrl(workerUrl);

type Coverage = Record<string, Record<string, number[][]>>;

/** True when the tile is in a per-zoom run index (scripts/build-pa.mjs). */
export const covered = (coverage: Coverage, z: number, x: number, y: number) =>
  (coverage[z]?.[y] ?? []).some(([x0, x1]) => x >= x0 && x <= x1);

/** Rejection message for basemap tiles outside T8's coverage. */
export const OUTSIDE_COVERAGE = 'pa-tiles: outside coverage';

const TILE_SETS = {
  basemap: { url: pa.basemap.url, coverage: pa.basemap.coverage as Coverage },
  districts: {
    url: pa.districtTiles.url,
    coverage: pa.districtTiles.coverage as Coverage,
  },
} as const;

/**
 * `pa-tiles://<set>/<z>/<x>/<y>`: serves only tiles that exist, so MapLibre
 * never requests a missing file.
 * - A basemap tile outside T8's coverage (beyond the state at z11–12, beyond
 *   the margin at z9–10) is rejected without a request; MapLibre then draws
 *   the nearest loaded parent, overzoomed, as context around the state.
 * - A district tile with no districts in it is an empty tile.
 */
export const resolvePaTile = (url: string, origin: string) => {
  const match = /^pa-tiles:\/\/(basemap|districts)\/(\d+)\/(\d+)\/(\d+)$/.exec(
    url,
  );
  if (!match) throw new Error(`pa-tiles: bad URL ${url}`);
  const set = TILE_SETS[match[1] as keyof typeof TILE_SETS];
  const [z, x, y] = match.slice(2).map(Number);
  if (!covered(set.coverage, z, x, y))
    return match[1] === 'basemap' ? ('outside' as const) : ('empty' as const);
  return `${origin}${set.url
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y))}`;
};

let protocolAdded = false;
const addPaProtocol = (origin: string) => {
  if (protocolAdded) return;
  protocolAdded = true;
  addProtocol(PA_PROTOCOL, async (params, abortController) => {
    const target = resolvePaTile(params.url, origin);
    if (target === 'outside') throw new Error(OUTSIDE_COVERAGE);
    if (target === 'empty') return { data: new ArrayBuffer(0) };
    const response = await fetch(target, {
      signal: abortController.signal,
      credentials: 'same-origin',
    });
    if (!response.ok)
      throw new Error(`pa-tiles: HTTP ${response.status} for ${target}`);
    return { data: await response.arrayBuffer() };
  });
};

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * The imperative MapLibre controller for /pa/school-districts. Like the year
 * controller it subscribes to the atlas store (place, settings, frame
 * requests), so camera moves never re-render React.
 */
export function mountPaMap(container: HTMLElement): MapHandle {
  const origin = window.location.origin;
  addPaProtocol(origin);
  const initial = getState();
  const search = window.location.search;
  const sharedView = hasMapView(search);
  // A shared district with no camera in the link is framed once it is known.
  let frameSharedPlace = Boolean(initial.place) && !sharedView;
  const view = parseMapView(search);
  let lastView = sharedView
    ? `${view.longitude.toFixed(4)},${view.latitude.toFixed(4)},${view.zoom.toFixed(2)}`
    : '';
  const lowPower = resolveLowPower(search);
  let index: DistrictIndex | null = null;
  let names = new Map<string, number>();
  let selectedId: number | null = null;
  let destroyed = false;

  const options = (): PaStyleOptions => ({
    settings: getState().settings,
    selectedId,
  });

  const map = new MapLibreMap({
    container,
    style: createPaStyle(origin, options()),
    ...(sharedView
      ? { center: [view.longitude, view.latitude], zoom: view.zoom }
      : { bounds: PA_BOUNDS, fitBoundsOptions: { padding: 12 } }),
    maxBounds: PA_MAX_BOUNDS,
    minZoom: PA_MIN_ZOOM,
    maxZoom: PA_MAX_ZOOM,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    maxPitch: 0,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    fadeDuration: 150,
  });
  map.touchZoomRotate.disableRotation();
  // The "no PIAA football" hatch is generated here, not loaded from a sprite.
  map.on('styleimagemissing', (event: { id: string }) => {
    if (event.id === HATCH_IMAGE && !map.hasImage(HATCH_IMAGE))
      map.addImage(HATCH_IMAGE, hatchImage(), { pixelRatio: 2 });
  });
  map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
  // ODbL: the OpenStreetMap credit stays expanded (compact only on phones,
  // where MapLibre opens it on load and the visitor may close it).
  map.addControl(
    new AttributionControl({ compact: undefined }),
    'bottom-right',
  );

  const cleanups: Array<() => void> = [];
  const frame = container.parentElement ?? container;
  if (!(lowPower && LOW_POWER_DROPS_GRAIN))
    cleanups.push(attachPaperGrain(frame));
  container.dataset.lowPower = String(lowPower);

  const setSelection = () => {
    const place = getState().place;
    const next = place ? (names.get(place) ?? null) : null;
    if (next === selectedId && map.getLayer(PA_INTERACTIVE_LAYERS[0])) {
      applyPaOptions(map, options());
      return;
    }
    const target = {
      source: PA_SOURCE.districts,
      sourceLayer: DISTRICT_SOURCE_LAYER,
    };
    if (selectedId !== null)
      map.removeFeatureState({ ...target, id: selectedId }, 'selected');
    selectedId = next;
    if (selectedId !== null)
      map.setFeatureState({ ...target, id: selectedId }, { selected: true });
    applyPaOptions(map, options());
  };

  const fit = (bounds: Bbox) => {
    const padding = focusPadding({
      width: container.clientWidth,
      height: container.clientHeight,
    });
    const camera = map.cameraForBounds(
      [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ],
      { padding, maxZoom: 12 },
    );
    if (!camera) return;
    // MapLibre 6 already shifts `camera.center` by the asymmetric padding
    // (cameraForBoxAndBearing), so no further offset: the camera keeps no
    // padding and the centre written to shared links stays the map's centre.
    map.easeTo({
      center: camera.center,
      zoom: camera.zoom,
      duration: prefersReducedMotion() ? 0 : 900,
    });
  };

  const styleLoaded = new Promise<void>((resolve) =>
    map.once('style.load', () => resolve()),
  );
  const load = () =>
    Promise.all([loadDistrictIndex(), styleLoaded]).then(
      ([loaded]) => {
        if (destroyed) return;
        index = loaded;
        names = new Map(loaded.districts.map((d) => [d.NAME, d.id]));
        void (
          map.getSource(PA_SOURCE.labels) as GeoJSONSource | undefined
        )?.setData({
          type: 'FeatureCollection',
          features: loaded.districts.map((d) => ({
            type: 'Feature',
            id: d.id,
            properties: {
              id: d.id,
              n: d.NAME,
              a: d.km2,
              ...sportsLabelLines(d.sports),
            },
            geometry: { type: 'Point', coordinates: d.label },
          })),
        });
        void (
          map.getSource(PA_SOURCE.piaaLabels) as GeoJSONSource | undefined
        )?.setData({
          type: 'FeatureCollection',
          features: (loaded.piaaLabels ?? []).map((p) => ({
            type: 'Feature',
            properties: { n: piaaName(p.piaa), r: ROMAN[p.piaa - 1] },
            geometry: { type: 'Point', coordinates: p.label },
          })),
        });
        const place = getState().place;
        // A shared place survives only if the district exists.
        if (place && !names.has(place)) actions.select(null);
        else if (place && frameSharedPlace)
          fit(loaded.districts[names.get(place)!].bbox);
        frameSharedPlace = false;
        setSelection();
      },
      () => undefined, // The island reports the error and offers a retry.
    );
  void load();

  map.on('click', (event: MapMouseEvent) => {
    const hit = map.queryRenderedFeatures(event.point, {
      layers: PA_INTERACTIVE_LAYERS,
    })[0];
    const id = typeof hit?.id === 'number' ? hit.id : undefined;
    const name = id !== undefined ? index?.districts[id]?.NAME : undefined;
    if (name) trackEvent('district_select', { name });
    actions.select(name ?? null);
  });
  for (const layer of PA_INTERACTIVE_LAYERS) {
    map.on(
      'mouseenter',
      layer,
      () => (map.getCanvas().style.cursor = 'pointer'),
    );
    map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
  }
  const viewKey = () => {
    const center = map.getCenter();
    return `${center.lng.toFixed(4)},${center.lat.toFixed(4)},${map.getZoom().toFixed(2)}`;
  };
  // The opening view of an unshared link is where we are, not a choice: the
  // camera is written only once the visitor (or the finder) moves it.
  map.once('load', () => {
    if (!lastView) lastView = viewKey();
  });
  map.on('moveend', () => {
    const key = viewKey();
    if (key === lastView) return;
    const center = map.getCenter();
    lastView = key;
    actions.writeView({
      longitude: center.lng,
      latitude: center.lat,
      zoom: map.getZoom(),
    });
  });
  map.on('idle', () => {
    if (!index || container.hasAttribute('data-loaded')) return;
    if (!map.isSourceLoaded(PA_SOURCE.districts)) return;
    container.setAttribute('data-loaded', '');
    performance.mark('pa-districts-idle');
  });
  map.on('error', (event) => {
    const error = (event as unknown as { error?: { message?: string } }).error;
    if (error?.message === OUTSIDE_COVERAGE) return;
    console.error(error);
  });

  const resizer =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => map.resize());
  resizer?.observe(container);

  let last: AtlasState = initial;
  const unsubscribe = subscribe(() => {
    const state = getState();
    if (state.reload !== last.reload) {
      container.removeAttribute('data-loaded');
      void load();
    }
    if (state.place !== last.place || state.settings !== last.settings)
      setSelection();
    if (state.frame && state.frame !== last.frame) fit(state.frame.bounds);
    last = state;
  });

  return {
    map,
    lowPower,
    // District names are tile labels; there is no viewport relabel to refresh.
    refreshLabels() {},
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

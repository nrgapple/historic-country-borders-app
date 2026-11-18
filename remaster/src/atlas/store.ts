import { createContext, useContext, useSyncExternalStore } from 'react';
import historicalManifest from '@repo/data/historical-manifest.json';
import { trackEvent } from '../lib/analytics';
import { parsePlace, writeMapView, writePlace, type MapView } from '../lib/mapView';
import { eraOf, yearPath } from '../lib/years';
import {
  DEFAULT_SETTINGS,
  readStoredSettings,
  sanitizeSettings,
  storeSettings,
  type Settings,
} from './settings';

/**
 * The atlas's whole client state in one small external store.
 *
 * React reads it through `useAtlas` (useSyncExternalStore); the imperative
 * MapLibre controller subscribes directly, so camera moves never re-render
 * React. The URL is the source of truth for anything shareable:
 *
 *   /year/<year>?lng=<lng>&lat=<lat>&zoom=<zoom>&place=<name>
 *
 * - A year change pushes a history entry, so Back and Forward step through
 *   the years visited; `popstate` restores year and place.
 * - The camera is written with replaceState after the camera settles.
 * - `place` is written with replaceState whenever the selection changes. A
 *   shared place is kept in the URL until the year's index has loaded and
 *   proven it exists, so a slow load cannot erase a shared link.
 *
 * Settings persist in localStorage (same key as the current app); overlays
 * and focus mode are per-visit.
 */

export const YEARS: readonly number[] = historicalManifest.years;

export type Overlay = 'settings' | 'about' | 'feedback' | null;
export type DataStatus = 'loading' | 'ready' | 'error';
export type YearChangeMethod = 'step' | 'track' | 'keyboard' | 'select' | 'history';
/** [west, south, east, north] in degrees; east may exceed 180 across the antimeridian. */
export type Bbox = [number, number, number, number];

export interface FrameRequest {
  bounds: Bbox;
  /** Increments per request so the same bounds can be framed twice. */
  id: number;
}

export interface AtlasState {
  year: number;
  /** The selected territory name (`?place=`); survives year changes while it exists. */
  place: string | null;
  /** Status of the current year's map data. */
  status: DataStatus;
  settings: Settings;
  overlay: Overlay;
  /** Projector/focus mode: only the map, a caption and a restore button. */
  focusMode: boolean;
  /** The latest request to frame a place on the map (a camera command). */
  frame: FrameRequest | null;
  /** False once the island finds no WebGL 2; the map then shows the fallback. */
  webgl: boolean;
  /** Increments on "Try again" so the map and index reload the year. */
  reload: number;
}

const initialState = (year: number): AtlasState => ({
  year,
  place: null,
  status: 'loading',
  settings: DEFAULT_SETTINGS,
  overlay: null,
  focusMode: false,
  frame: null,
  webgl: true,
  reload: 0,
});

type Listener = () => void;
let state: AtlasState = initialState(YEARS[0]);
const listeners = new Set<Listener>();
let started = false;
let frameId = 0;

export const getState = () => state;

export const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const set = (patch: Partial<AtlasState>) => {
  const keys = Object.keys(patch) as Array<keyof AtlasState>;
  if (keys.every((key) => Object.is(patch[key], state[key]))) return;
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

/** The year in a pathname such as "/year/-500", if it is a published year. */
export const parseYearPath = (pathname: string): number | undefined => {
  const match = /^\/year\/(-?\d+)\/?$/.exec(pathname);
  const year = match ? Number(match[1]) : NaN;
  return YEARS.includes(year) ? year : undefined;
};

const syncDocument = () => {
  const root = document.documentElement;
  const era = eraOf(state.year).id;
  if (root.dataset.era !== era) root.dataset.era = era;
  if (state.settings.projectorText) root.dataset.text = 'projector';
  else delete root.dataset.text;
};

const onPopState = () => {
  const year = parseYearPath(window.location.pathname);
  if (year === undefined) return;
  set({
    year,
    place: parsePlace(window.location.search) ?? null,
    status: year === state.year ? state.status : 'loading',
    overlay: null,
  });
};

export const actions = {
  /** Starts the store from the prerendered year and the current URL. Idempotent. */
  init(year: number) {
    if (started) return;
    started = true;
    state = {
      ...initialState(year),
      place: parsePlace(window.location.search) ?? null,
      settings: readStoredSettings(),
    };
    window.addEventListener('popstate', onPopState);
    subscribe(syncDocument);
    syncDocument();
  },

  /** A year change pushes a history entry so Back steps through visited years. */
  setYear(year: number, method: YearChangeMethod = 'select') {
    if (year === state.year || !YEARS.includes(year)) return;
    trackEvent('year_change', { year, method });
    const { search, hash } = window.location;
    window.history.pushState(null, '', `${yearPath(year)}${search}${hash}`);
    set({ year, status: 'loading' });
  },

  /** Selects a territory (or clears with null) and mirrors it to `?place=`. */
  select(place: string | null, { track = false }: { track?: boolean } = {}) {
    const name = place?.trim() || null;
    if (name && track) trackEvent('country_select', { name, year: state.year });
    writePlace(name ?? undefined);
    set({ place: name });
  },

  /** Asks the map to frame a place; the controller applies it when ready. */
  frame(bounds: Bbox) {
    frameId += 1;
    set({ frame: { bounds, id: frameId } });
  },

  setStatus(status: DataStatus) {
    set({ status });
  },

  /** Reloads the current year's data after an error. */
  retry() {
    set({ status: 'loading', reload: state.reload + 1 });
  },

  setWebgl(webgl: boolean) {
    set({ webgl });
  },

  /** Camera position is written only after the camera settles; no React render. */
  writeView(view: MapView) {
    writeMapView(view);
  },

  updateSettings(changes: Partial<Settings>) {
    const next = sanitizeSettings({ ...state.settings, ...changes });
    storeSettings(next);
    set({ settings: next });
    Object.entries(changes).forEach(([name, value]) =>
      trackEvent('setting_changed', { name, value: String(value) }),
    );
  },

  resetSettings() {
    storeSettings(DEFAULT_SETTINGS);
    set({ settings: DEFAULT_SETTINGS });
    trackEvent('settings_reset');
  },

  openOverlay(overlay: Exclude<Overlay, null>) {
    set({ overlay: state.overlay === overlay ? null : overlay });
    trackEvent('overlay_open', { overlay });
  },

  closeOverlay() {
    set({ overlay: null });
  },

  toggleFocusMode() {
    trackEvent('focus_mode', { enabled: !state.focusMode });
    set({ focusMode: !state.focusMode, overlay: null });
  },
};

/** The prerendered year, so server and hydration renders agree. */
export const InitialYear = createContext<number>(YEARS[0]);
const serverStates = new Map<number, AtlasState>();
const serverState = (year: number) => {
  let value = serverStates.get(year);
  if (!value) {
    value = initialState(year);
    serverStates.set(year, value);
  }
  return value;
};

/**
 * Reads a slice of the store. Selectors must return primitives or objects
 * that already live in the state, so snapshots stay referentially stable.
 */
export function useAtlas<T>(selector: (state: AtlasState) => T): T {
  const initialYear = useContext(InitialYear);
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(serverState(initialYear)),
  );
}

/** Test helper: resets module state and listeners. */
export const __resetStore = (year: number = YEARS[0]) => {
  if (typeof window !== 'undefined')
    window.removeEventListener('popstate', onPopState);
  listeners.clear();
  started = false;
  frameId = 0;
  state = initialState(year);
};

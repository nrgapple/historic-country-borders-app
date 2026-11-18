import { useSyncExternalStore } from 'react';
import { parseYearPath, yearPath } from './years';
import { YEARS } from './data';

/**
 * The atlas's whole client state in one tiny external store. React reads it
 * with useSyncExternalStore; the imperative map controller subscribes to it
 * directly, so camera moves and year changes never re-render the React tree.
 * The URL is the source of truth for what can be shared: the year is the
 * path, the camera and selection are query parameters.
 */
export interface AtlasState {
  year: number;
  /** Selected territory name; survives year changes while the name exists. */
  selected: string | null;
  status: 'loading' | 'ready' | 'error';
}

type Listener = () => void;
let state: AtlasState = { year: YEARS[0], selected: null, status: 'loading' };
const listeners = new Set<Listener>();

export const getState = () => state;
export const subscribe = (fn: Listener) => (listeners.add(fn), () => listeners.delete(fn));
const set = (patch: Partial<AtlasState>) => {
  const next = { ...state, ...patch };
  if (Object.keys(patch).every((k) => Object.is(next[k as keyof AtlasState], state[k as keyof AtlasState]))) return;
  state = next;
  listeners.forEach((fn) => fn());
};

export function useAtlas<T>(selector: (s: AtlasState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

const writeQuery = (key: string, value: string | null) => {
  const url = new URL(location.href);
  if (value === null) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  history.replaceState(history.state, '', url);
};

export const actions = {
  init(year: number) {
    state = { year, selected: new URLSearchParams(location.search).get('place'), status: 'loading' };
    addEventListener('popstate', () => {
      const y = parseYearPath(location.pathname, YEARS);
      if (y !== undefined) set({ year: y, status: 'loading' });
    });
  },
  /** Year changes push history entries so Back steps through visited years. */
  setYear(year: number) {
    if (year === state.year || !YEARS.includes(year)) return;
    history.pushState(null, '', `${yearPath(year)}${location.search}`);
    set({ year, status: 'loading' });
  },
  select(name: string | null) {
    writeQuery('place', name);
    set({ selected: name });
  },
  setStatus(status: AtlasState['status']) {
    set({ status });
  },
  /** Camera position is written only after the camera settles, with no React render. */
  writeView(lng: number, lat: number, zoom: number) {
    const url = new URL(location.href);
    url.searchParams.set('lng', lng.toFixed(2));
    url.searchParams.set('lat', lat.toFixed(2));
    url.searchParams.set('zoom', zoom.toFixed(2));
    history.replaceState(history.state, '', url);
  },
};

export const readView = () => {
  const p = new URLSearchParams(location.search);
  const n = (k: string) => (p.get(k) !== null && Number.isFinite(Number(p.get(k))) ? Number(p.get(k)) : undefined);
  const lng = n('lng'), lat = n('lat'), zoom = n('zoom');
  return lng !== undefined && lat !== undefined ? { center: [lng, lat] as [number, number], zoom: zoom ?? 2 } : { center: [10, 30] as [number, number], zoom: 1.6 };
};

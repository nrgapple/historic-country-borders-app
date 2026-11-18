/**
 * T1 ADAPTER: per-year historical data (plan §6, split format).
 *
 * Everything the app knows about year files goes through this module. Today
 * it reads the manifest written by the STAND-IN `scripts/build-data.mjs`
 * (`src/data/years.json`), which converts the committed payloads into T1's
 * announced format:
 *
 * - polygons: GeoJSON, numeric feature `id` = index into the territory list,
 *   property `c` = palette slot (0-29, 30 = unknown);
 * - labels: points with `n` (territory name) and `a` (area, m²), and places
 *   with `p` (name) and, once T1 adds it, `k` = 'site' for archaeological sites;
 * - index: `{ year, territories: [name, partOf, subjectTo, precision, bbox] }`.
 *
 * SWITCH when T1 lands: point `manifest` at T1's manifest (or make
 * build-data.mjs copy it) and, if T1 publishes capitals or dependency
 * attributes, fill `capitals` in `YearFiles`. Nothing else reads year files.
 */
import manifest from '../data/years.json';
import { createResource, fetchJson, useResource } from '../lib/resource';
import { YEARS } from '../atlas/store';

export interface YearFiles {
  /** Territory polygons, parsed in MapLibre's worker. */
  map: string;
  /** Territory label points and dated places. */
  labels: string;
  /** Territory facts for the finder, panel and prerendered list. */
  index: string;
  /** Wikidata context (capitals, rulers, lifespans, changes). */
  context: string | null;
  /** T1 capitals point file; absent until T1 lands. */
  capitals?: string;
}

const files = manifest.files as Record<string, YearFiles>;

if (import.meta.env.DEV) {
  const built = (manifest.years as number[]).join();
  if (built !== YEARS.join())
    console.warn('src/data/years.json is stale: run `yarn remaster:data`.');
}

export const yearFiles = (year: number): YearFiles | undefined =>
  files[String(year)];

const absolute = (path: string) =>
  typeof window === 'undefined' ? path : new URL(path, window.location.href).href;

/** Absolute URLs, because MapLibre's worker resolves them. */
export const mapUrl = (year: number) => absolute(files[String(year)].map);
export const labelsUrl = (year: number) => absolute(files[String(year)].labels);

/** [name, partOf, subjectTo, precision, [west, south, east, north]]. */
export type Territory = [
  name: string,
  partOf: string | null,
  subjectTo: string | null,
  precision: number | null,
  bbox: [number, number, number, number],
];

export interface YearIndex {
  year: number;
  territories: Territory[];
}

export const validateYearIndex = (value: unknown, year: number): YearIndex => {
  const index = value as YearIndex;
  if (
    !index ||
    index.year !== year ||
    !Array.isArray(index.territories) ||
    !index.territories.every(
      (t) =>
        Array.isArray(t) &&
        typeof t[0] === 'string' &&
        Array.isArray(t[4]) &&
        t[4].length === 4,
    )
  )
    throw new Error(`The ${year} territory index is malformed.`);
  return index;
};

/** A few recent indexes stay parsed (2-100 KB each); the HTTP cache keeps the rest. */
export const yearIndexes = createResource<YearIndex>(
  async (key, signal) => {
    const year = Number(key);
    const file = files[key];
    if (!file) throw new Error(`No map is published for ${year}.`);
    return validateYearIndex(await fetchJson<unknown>(file.index, signal), year);
  },
  { maxEntries: 4 },
);

export const loadYearIndex = (year: number) => yearIndexes.load(String(year));

export const useYearIndex = (year: number) =>
  useResource(yearIndexes, files[String(year)] ? String(year) : null);

/** Warms the HTTP cache for neighbouring years at idle; never on Save-Data or slow links. */
const prefetched = new Set<string>();
export function prefetchYears(years: number[]) {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (
    connection?.saveData ||
    ['slow-2g', '2g', '3g'].includes(connection?.effectiveType ?? '')
  )
    return;
  for (const year of years) {
    const entry = files[String(year)];
    if (!entry) continue;
    for (const href of [entry.map, entry.labels, entry.index]) {
      if (prefetched.has(href)) continue;
      prefetched.add(href);
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      document.head.append(link);
    }
  }
}

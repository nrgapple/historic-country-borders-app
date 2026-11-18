/**
 * T1 ADAPTER: per-year historical data (plan §6), integrated with T1's split
 * files (`t3/historical-data-pipeline`; format in docs/HISTORICAL_DATA.md
 * "Split year files" and docs/HISTORICAL_CONTEXT.md "Capital points").
 *
 * Everything the app knows about year files goes through this module. It
 * reads `src/data/years.json`, which `scripts/build-data.mjs` writes from
 * `data/historical-split-assets.json` and `data/historical-capitals.json`.
 *
 * - polygons: numeric feature `id` = territory id (shared by every polygon
 *   of a territory, and its position in the index); `c` = wash 0–11; and for
 *   dependencies `dep`, `ov` (overlord id), `oc` (overlord wash);
 * - labels: territory points `{ n, a }` (a = km²) with the territory `id`,
 *   and places `{ p, k }` with k = 'city' | 'site';
 * - index: `{ schemaVersion, year, territories: TerritoryEntry[] }`;
 * - capitals: points `{ name, t, qid }`, t = territory id.
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
  /** Capital points, one per territory with a known, validated capital. */
  capitals: string | null;
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
  typeof window === 'undefined'
    ? path
    : new URL(path, window.location.href).href;

/** Absolute URLs, because MapLibre's worker resolves them. */
export const mapUrl = (year: number) => absolute(files[String(year)].map);
export const labelsUrl = (year: number) => absolute(files[String(year)].labels);
export const capitalsUrl = (year: number) => {
  const url = files[String(year)]?.capitals;
  return url ? absolute(url) : null;
};

/** One territory in a year's index; its array position is its `id`. */
export interface Territory {
  id: number;
  NAME: string;
  PARTOF?: string;
  SUBJECTO?: string;
  /** 1 approximate, 2 moderately precise, 3 set by treaty or law. */
  BORDERPRECISION?: number;
  /** [west, south, east, north]; west > east across the antimeridian. */
  bbox: [number, number, number, number];
  /** The territory label point. */
  label?: [number, number];
  /** "ABBREVN" when the name came from the source's abbreviation. */
  nameFrom?: string;
  dep?: 1;
  /** The overlord's territory id (dependencies only). */
  ov?: number;
  /** The overlord's wash (dependencies only). */
  oc?: number;
}

export interface YearIndex {
  schemaVersion: 1;
  year: number;
  territories: Territory[];
}

export const validateYearIndex = (value: unknown, year: number): YearIndex => {
  const index = value as YearIndex;
  if (
    !index ||
    index.schemaVersion !== 1 ||
    index.year !== year ||
    !Array.isArray(index.territories) ||
    !index.territories.every(
      (t, position) =>
        t &&
        t.id === position &&
        typeof t.NAME === 'string' &&
        Array.isArray(t.bbox) &&
        t.bbox.length === 4,
    )
  )
    throw new Error(`The ${year} territory index is malformed.`);
  return index;
};

/**
 * Bounds MapLibre can frame. A box across the antimeridian (west > east)
 * gets an eastern edge past 180°, so the camera takes the short way round.
 */
export const framingBounds = ([west, south, east, north]: Territory['bbox']): [
  number,
  number,
  number,
  number,
] => [west, south, west > east ? east + 360 : east, north];

/** A few recent indexes stay parsed (2–220 KB each); the HTTP cache keeps the rest. */
export const yearIndexes = createResource<YearIndex>(
  async (key, signal) => {
    const year = Number(key);
    const file = files[key];
    if (!file) throw new Error(`No map is published for ${year}.`);
    return validateYearIndex(
      await fetchJson<unknown>(file.index, signal),
      year,
    );
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
    for (const href of [entry.map, entry.labels, entry.index, entry.capitals]) {
      if (!href || prefetched.has(href)) continue;
      prefetched.add(href);
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      document.head.append(link);
    }
  }
}

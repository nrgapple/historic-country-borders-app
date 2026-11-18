import manifest from '../data/years.json';

export const YEARS: readonly number[] = manifest.years;
const files = manifest.files as Record<string, { map: string; labels: string; capitals: string; index: string }>;
export const mapUrl = (year: number) => new URL(files[year].map, location.href).href;
export const labelsUrl = (year: number) => new URL(files[year].labels, location.href).href;
export const capitalsUrl = (year: number) => new URL(files[year].capitals, location.href).href;
export const indexUrl = (year: number) => files[year].index;

/** [name, partOf, subjectTo, precision, [w, s, e, n]]; the array index is the map feature id. */
export type Territory = [string, string | null, string | null, number | null, [number, number, number, number]];
export interface YearIndex { year: number; territories: Territory[] }

const isIndex = (v: unknown): v is YearIndex =>
  !!v && typeof (v as YearIndex).year === 'number' && Array.isArray((v as YearIndex).territories);

/** Small (2-100 KB) per-year facts for the finder and panel; bounded cache of 3. */
const cache = new Map<number, Promise<YearIndex>>();
export function loadIndex(year: number, signal?: AbortSignal): Promise<YearIndex> {
  let p = cache.get(year);
  if (!p) {
    p = fetch(indexUrl(year), { signal }).then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const v = await r.json();
      if (!isIndex(v) || v.year !== year) throw new Error('Malformed year index');
      return v;
    });
    p.catch(() => cache.delete(year));
    cache.set(year, p);
    if (cache.size > 3) cache.delete(cache.keys().next().value!);
  }
  return p;
}

/** Warm the HTTP cache for neighbouring years at idle, never on Save-Data or slow links. */
const prefetched = new Set<string>();
export function prefetchYears(years: number[]) {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (c?.saveData || ['slow-2g', '2g', '3g'].includes(c?.effectiveType ?? '')) return;
  for (const y of years) {
    if (files[y] === undefined) continue;
    for (const href of [files[y].map, files[y].labels, files[y].index]) {
      if (prefetched.has(href)) continue;
      prefetched.add(href);
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      document.head.append(link);
    }
  }
}

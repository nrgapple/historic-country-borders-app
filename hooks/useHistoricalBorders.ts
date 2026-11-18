import { useEffect } from 'react';
import historicalAssets from '../data/historical-assets.json';
import { createResource, fetchJson, useResource } from '../lib/resource';
import type { BordersEndpointData } from '../util/types';

interface HistoricalAsset {
  url: string;
}

const assets = historicalAssets.assets as Record<string, HistoricalAsset>;

export const historicalAssetUrl = (year: number): string | undefined =>
  assets[String(year)]?.url;

const isFeatureCollection = (value: unknown) =>
  Boolean(value) &&
  (value as { type?: unknown }).type === 'FeatureCollection' &&
  Array.isArray((value as { features?: unknown }).features);

export const validateHistoricalPayload = (
  value: unknown,
): BordersEndpointData => {
  const payload = value as BordersEndpointData;
  if (
    !payload ||
    !isFeatureCollection(payload.data?.borders) ||
    !isFeatureCollection(payload.data?.labels) ||
    !isFeatureCollection(payload.places)
  ) {
    throw new Error('The historical map data is malformed.');
  }
  return payload;
};

/**
 * Parsed payloads are 5–20 MB in memory. Keep the current and previous year so
 * flipping back and forth is instant; anything older comes from the HTTP cache.
 */
export const historicalBorders = createResource(
  async (url, signal) =>
    validateHistoricalPayload(await fetchJson<unknown>(url, signal)),
  { maxEntries: 2 },
);

const prefetched = new Set<string>();

const shouldPrefetch = () => {
  if (typeof navigator === 'undefined') return false;
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  return !['slow-2g', '2g', '3g'].includes(connection.effectiveType ?? '');
};

/**
 * Warms the HTTP cache for adjacent years with a low-priority `<link
 * rel="prefetch">`. Nothing is parsed or held in memory until it is needed.
 */
export const prefetchYears = (years: number[]) => {
  if (typeof document === 'undefined' || !shouldPrefetch()) return;
  years.forEach((year) => {
    const url = historicalAssetUrl(year);
    if (!url || prefetched.has(url)) return;
    prefetched.add(url);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  });
};

export const useHistoricalBorders = (
  year: number,
  neighbours: number[] = [],
) => {
  const url = historicalAssetUrl(year) ?? null;
  const state = useResource(historicalBorders, url, { keepPrevious: true });
  const ready = Boolean(state.value) && !state.isLoading;
  const neighbourKey = neighbours.join(',');

  useEffect(() => {
    if (!ready || !neighbourKey) return;
    const idle =
      (
        window as Window & {
          requestIdleCallback?: (callback: () => void) => number;
        }
      ).requestIdleCallback ??
      ((callback: () => void) => setTimeout(callback, 1200));
    idle(() => prefetchYears(neighbourKey.split(',').map(Number)));
  }, [ready, neighbourKey]);

  return {
    ...state,
    error:
      state.error ?? (url ? undefined : new Error(`Unknown year: ${year}`)),
  };
};

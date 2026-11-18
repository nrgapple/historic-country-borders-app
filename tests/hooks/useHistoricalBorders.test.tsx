import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import historicalAssets from '../../data/historical-assets.json';
import {
  historicalAssetUrl,
  historicalBorders,
  prefetchYears,
  useHistoricalBorders,
  validateHistoricalPayload,
} from '../../hooks/useHistoricalBorders';

const collection = { type: 'FeatureCollection', features: [] };
const payload = {
  data: { borders: collection, labels: collection },
  places: collection,
};

describe('historical border assets', () => {
  beforeEach(() => historicalBorders.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    document.head
      .querySelectorAll('link[rel="prefetch"]')
      .forEach((link) => link.remove());
  });

  it('maps AD and BC years to content-hashed static assets', () => {
    expect(historicalAssetUrl(1994)).toBe(
      (historicalAssets.assets as Record<string, { url: string }>)['1994'].url,
    );
    expect(historicalAssetUrl(-100)).toMatch(
      /^\/data\/historical\/bc100\.[a-f0-9]+\.json$/,
    );
    expect(historicalAssetUrl(9999)).toBeUndefined();
  });

  it('validates payload shape', () => {
    expect(validateHistoricalPayload(payload)).toBe(payload);
    expect(() => validateHistoricalPayload({ data: {} })).toThrow('malformed');
  });

  it('loads a year and reports unknown years as errors without fetching', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => payload }),
    );
    const { result } = renderHook(() => useHistoricalBorders(1994));
    await waitFor(() => expect(result.current.value).toEqual(payload));
    expect(result.current.error).toBeUndefined();

    const unknown = renderHook(() => useHistoricalBorders(9999));
    expect(unknown.result.current.error?.message).toContain('Unknown year');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('prefetches neighbours once and respects Save-Data', () => {
    prefetchYears([1914, 1914]);
    expect(document.head.querySelectorAll('link[rel="prefetch"]')).toHaveLength(
      1,
    );

    vi.stubGlobal('navigator', { connection: { saveData: true } });
    prefetchYears([1920]);
    expect(document.head.querySelectorAll('link[rel="prefetch"]')).toHaveLength(
      1,
    );
  });
});

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import contextManifest from '@repo/data/historical-context.json';
import historicalManifest from '@repo/data/historical-manifest.json';
import {
  useYearContext,
  yearContextUrl,
  yearContexts,
} from '../useYearContext';

const contextFor = (year: number) => ({
  schemaVersion: 1,
  year,
  source: { name: 'Wikidata', license: 'CC0-1.0', retrievedAt: '2026-11-17' },
  places: {},
  changes: null,
});

describe('year context assets', () => {
  beforeEach(() => yearContexts.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('maps every route year to a content-hashed context file', () => {
    expect(Object.keys(contextManifest.years).sort()).toEqual(
      historicalManifest.years.map(String).sort(),
    );
    expect(yearContextUrl(1914)).toMatch(
      /^\/data\/context\/1914\.[a-f0-9]{16}\.json$/,
    );
    expect(yearContextUrl(-500)).toMatch(/^\/data\/context\/bc500\./);
    expect(yearContextUrl(9999)).toBeUndefined();
  });

  it('loads the year and keeps the previous one while the next loads', async () => {
    let resolveNext: (value: unknown) => void = () => {};
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => contextFor(1900) })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveNext = resolve;
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(
      ({ year }) => useYearContext(year),
      { initialProps: { year: 1900 } },
    );
    await waitFor(() => expect(result.current.current?.year).toBe(1900));

    rerender({ year: 1914 });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.current).toBeUndefined();
    expect(result.current.value?.year).toBe(1900);

    resolveNext({ ok: true, json: async () => contextFor(1914) });
    await waitFor(() => expect(result.current.current?.year).toBe(1914));
  });

  it('reports malformed files and unknown years without breaking', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    const { result } = renderHook(() => useYearContext(1914));
    await waitFor(() =>
      expect(result.current.error?.message).toContain('malformed'),
    );
    expect(result.current.current).toBeUndefined();

    const unknown = renderHook(() => useYearContext(9999));
    expect(unknown.result.current).toMatchObject({
      current: undefined,
      isLoading: false,
    });
  });
});

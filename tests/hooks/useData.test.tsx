import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SWRConfig } from 'swr';
import historicalAssets from '../../data/historical-assets.json';
import { historicalAssetUrl, useData } from '../../hooks/useData';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
);

describe('useData static historical assets', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('resolves AD and BC years to pinned immutable assets', () => {
    expect(historicalAssetUrl('1994')).toBe(
      historicalAssets.assets['1994'].url,
    );
    expect(historicalAssetUrl('bc100')).toBe(
      historicalAssets.assets['-100'].url,
    );
    expect(historicalAssetUrl('not-a-year')).toBeUndefined();
  });

  it('loads the existing browser contract without an API route', async () => {
    const payload = { data: { labels: {}, borders: {} }, places: {} };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => payload,
    } as Response);
    const { result } = renderHook(() => useData('1994', 'ignored', 'ignored'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetch).toHaveBeenCalledWith(historicalAssets.assets['1994'].url);
    expect(result.current.data).toBe(payload);
  });

  it('reports missing and unavailable static assets', async () => {
    const missing = renderHook(() => useData('9999', 'ignored', 'ignored'), {
      wrapper,
    });
    expect(missing.result.current.isError).toBeInstanceOf(Error);

    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response);
    const unavailable = renderHook(
      () => useData('1994', 'ignored', 'ignored'),
      { wrapper },
    );
    await waitFor(() =>
      expect(unavailable.result.current.isError).toBeInstanceOf(Error),
    );
  });
});

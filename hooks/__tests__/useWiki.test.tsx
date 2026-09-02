import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SWRConfig } from 'swr';
import { useWikiData } from '../useWiki';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
);

describe('useWikiData', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('loads a source-backed summary directly from Wikipedia CORS API', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        query: {
          pages: { '1': { extract: 'France is a country in Europe.' } },
        },
      }),
    } as Response);

    const { result } = renderHook(() => useWikiData(' France '), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/en\.wikipedia\.org\/w\/api\.php\?/);
    expect(String(url)).toContain('origin=*');
    expect(String(url)).toContain('gsrsearch=France');
    expect(options).toEqual(
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.info).toBe('France is a country in Europe.');
  });

  it('returns not found for empty results and a safe message when unavailable', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ query: { pages: {} } }),
    } as Response);
    const empty = renderHook(() => useWikiData('Unknown'), { wrapper });
    await waitFor(() => expect(empty.result.current.isLoading).toBe(false));
    expect(empty.result.current.info).toBe('Not Found');

    vi.mocked(fetch).mockRejectedValueOnce(new Error('Failed to fetch'));
    const unavailable = renderHook(() => useWikiData('France'), { wrapper });
    await waitFor(() =>
      expect(unavailable.result.current.isLoading).toBe(false),
    );
    expect(unavailable.result.current.info).toContain(
      'temporarily unavailable',
    );
  });
});

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

  it('loads Wikipedia content from the bounded application endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ content: 'France is a country in Europe.' }),
    } as Response);

    const { result } = renderHook(() => useWikiData('France'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetch).toHaveBeenCalledWith('/api/wikipedia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'France' }),
    });
    expect(result.current.info).toBe('France is a country in Europe.');
  });

  it('returns a safe message when the endpoint is unavailable', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Failed to fetch'));
    const { result } = renderHook(() => useWikiData('France'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.info).toContain('Network connection issue');
  });
});

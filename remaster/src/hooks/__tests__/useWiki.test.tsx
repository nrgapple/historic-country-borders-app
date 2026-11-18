import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetWikiCache,
  stripLeadParenthetical,
  trimExtract,
  useWikiSummary,
  wikiQueryUrl,
} from '../useWiki';

const page = (overrides: Record<string, unknown> = {}) => ({
  ok: true,
  json: async () => ({
    query: {
      pages: {
        '1': {
          title: 'France',
          extract: 'France is a country in Western Europe.',
          fullurl: 'https://en.wikipedia.org/wiki/France',
          thumbnail: {
            source: 'https://upload.wikimedia.org/flag.png',
            width: 320,
            height: 200,
          },
          ...overrides,
        },
      },
    },
  }),
});

describe('useWikiSummary', () => {
  beforeEach(() => {
    __resetWikiCache();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loads a source-linked summary directly from the Wikipedia CORS API', async () => {
    vi.mocked(fetch).mockResolvedValue(page() as Response);
    const { result } = renderHook(() => useWikiSummary(' France '));
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/en\.wikipedia\.org\/w\/api\.php\?/);
    expect(String(url)).toContain('origin=*');
    expect(String(url)).toContain('gsrsearch=France');
    expect(options).toEqual(
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.summary).toEqual({
      title: 'France',
      extract: 'France is a country in Western Europe.',
      url: 'https://en.wikipedia.org/wiki/France',
      thumbnail: {
        source: 'https://upload.wikimedia.org/flag.png',
        width: 320,
        height: 200,
      },
    });
  });

  it('distinguishes a missing article from an unavailable service', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ query: { pages: {} } }),
    } as Response);
    const missing = renderHook(() => useWikiSummary('Nowhere'));
    await waitFor(() => expect(missing.result.current.isMissing).toBe(true));
    expect(missing.result.current.error).toBeUndefined();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as Response);
    const down = renderHook(() => useWikiSummary('Elsewhere'));
    await waitFor(() => expect(down.result.current.error).toBeTruthy());
    expect(down.result.current.isMissing).toBe(false);
  });

  it('rejects untrusted thumbnail hosts and caches repeated lookups', async () => {
    vi.mocked(fetch).mockResolvedValue(
      page({ thumbnail: { source: 'https://evil.example/x.png' } }) as Response,
    );
    const first = renderHook(() => useWikiSummary('France'));
    await waitFor(() => expect(first.result.current.summary).toBeTruthy());
    expect(first.result.current.summary?.thumbnail).toBeUndefined();

    const second = renderHook(() => useWikiSummary('France'));
    expect(second.result.current.summary?.title).toBe('France');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('skips empty and oversized names without a request', () => {
    const empty = renderHook(() => useWikiSummary(''));
    expect(empty.result.current.isLoading).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('wiki helpers', () => {
  it('drops the pronunciation parenthetical from the opening sentence', () => {
    expect(
      stripLeadParenthetical(
        "The Achaemenid Empire (, ə-KEE-mə-nid; Old Persian: 𐎧𐏁𐏂 (Xšāça), lit. 'The Empire') was an ancient Iranian empire. It had (many) satraps.",
      ),
    ).toBe(
      'The Achaemenid Empire was an ancient Iranian empire. It had (many) satraps.',
    );
    expect(
      stripLeadParenthetical('France is a country. Paris (capital).'),
    ).toBe('France is a country. Paris (capital).');
    expect(stripLeadParenthetical('Broken (lead without end')).toBe(
      'Broken (lead without end',
    );
  });

  it('trims extracts at sentence boundaries', () => {
    const text = `${'First sentence is here. '.repeat(30)}`;
    const trimmed = trimExtract(text, 100);
    expect(trimmed.length).toBeLessThanOrEqual(100);
    expect(trimmed.endsWith('.')).toBe(true);
    expect(trimExtract('Short.')).toBe('Short.');
    expect(trimExtract('word '.repeat(50), 40).endsWith('…')).toBe(true);
  });

  it('builds a bounded search query', () => {
    const url = new URL(wikiQueryUrl('Ottoman Empire'));
    expect(url.searchParams.get('gsrlimit')).toBe('1');
    expect(url.searchParams.get('exintro')).toBe('1');
    expect(url.searchParams.get('inprop')).toBe('url');
  });
});

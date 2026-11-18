import { describe, expect, it, vi } from 'vitest';

const { runProductionSmoke } = require('../scripts/lib/production-smoke');

const bodies: Record<string, string> = {
  '/': 'Historic Borders',
  '/year/1994': 'Historic Borders',
  '/year/-100': 'Historic Borders',
  '/pa/school-districts': 'Pennsylvania school districts',
  '/robots.txt': 'User-agent: GPTBot',
  '/sitemap.xml': '<loc>https://historicborders.app/pa/school-districts</loc>',
  '/year/9999': 'That map is not available',
};

const successfulFetch = vi.fn(async (input: URL, _options?: RequestInit) => {
  const path = input.pathname;
  const isHistoricalData = path.startsWith('/data/historical/');
  const isSchoolData = path === '/data/pa-school-districts.json';
  return new Response(bodies[path] || '', {
    status: path === '/year/9999' ? 404 : 200,
    headers: {
      'cache-control': isHistoricalData
        ? 'public, max-age=31536000, immutable'
        : isSchoolData
          ? 'public, max-age=3600, stale-while-revalidate=86400'
          : 'public, max-age=0, must-revalidate',
    },
  });
});

describe('production static smoke checks', () => {
  it('covers both journeys and map assets without invoking Worker compute', async () => {
    const results = await runProductionSmoke({
      baseUrl: 'https://historicborders.app',
      historicalAssetPath: '/data/historical/1994.hash.json',
      fetchImpl: successfulFetch,
    });

    expect(results).toHaveLength(9);
    expect(successfulFetch).toHaveBeenCalledTimes(9);
    expect(
      successfulFetch.mock.calls.map(([, options]) => options?.method),
    ).toEqual([
      'GET',
      'GET',
      'GET',
      'GET',
      'HEAD',
      'HEAD',
      'GET',
      'GET',
      'GET',
    ]);
  });

  it('expects an immutable cache on the remaster district index', async () => {
    await expect(
      runProductionSmoke({
        baseUrl: 'https://historicborders.app',
        historicalAssetPath: '/data/historical/1994.polygons.hash.json',
        schoolAssetPath: '/data/pa/districts.hash.json',
        fetchImpl: successfulFetch,
      }),
    ).rejects.toThrow('/data/pa/districts.hash.json: unexpected cache-control');

    const immutableFetch = vi.fn(async (input: URL, options?: RequestInit) =>
      input.pathname.startsWith('/data/pa/')
        ? new Response('', {
            headers: { 'cache-control': 'public, max-age=31536000, immutable' },
          })
        : successfulFetch(input, options),
    );
    await expect(
      runProductionSmoke({
        baseUrl: 'https://historicborders.app',
        historicalAssetPath: '/data/historical/1994.polygons.hash.json',
        schoolAssetPath: '/data/pa/districts.hash.json',
        fetchImpl: immutableFetch,
      }),
    ).resolves.toHaveLength(9);
  });

  it('rejects compute markers and incorrect cache policy', async () => {
    const computeFetch = vi.fn(
      async () =>
        new Response('Historic Borders', {
          headers: {
            'cache-control': 'no-store',
            'x-historicborders-compute': 'unexpected',
          },
        }),
    );

    await expect(
      runProductionSmoke({
        baseUrl: 'https://historicborders.app',
        historicalAssetPath: '/data/historical/1994.hash.json',
        fetchImpl: computeFetch,
      }),
    ).rejects.toThrow('unexpectedly invoked Worker compute');
  });
});

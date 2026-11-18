'use strict';

const STATIC_CACHE = /public/;
const IMMUTABLE_CACHE = /max-age=31536000.*immutable/;
const SCHOOL_CACHE = /max-age=3600.*stale-while-revalidate=86400/;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const checkResponse = async (
  baseUrl,
  fetchImpl,
  { path, status = 200, method = 'GET', content, cache = STATIC_CACHE },
) => {
  const startedAt = Date.now();
  const response = await fetchImpl(new URL(path, baseUrl), {
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  });
  const durationMs = Date.now() - startedAt;
  assert(
    response.status === status,
    `${path}: expected ${status}, got ${response.status}`,
  );
  assert(
    !response.headers.get('x-historicborders-compute'),
    `${path}: unexpectedly invoked Worker compute`,
  );
  const cacheControl = response.headers.get('cache-control') || '';
  assert(
    cache.test(cacheControl),
    `${path}: unexpected cache-control ${cacheControl || '(missing)'}`,
  );
  if (content) {
    const body = await response.text();
    assert(
      body.includes(content),
      `${path}: expected content marker is missing`,
    );
  }
  return { path, status: response.status, durationMs, cacheControl };
};

const runProductionSmoke = async ({
  baseUrl,
  historicalAssetPath,
  fetchImpl = fetch,
}) => {
  assert(
    /^https:\/\//.test(baseUrl),
    'Production smoke BASE_URL must use HTTPS',
  );
  const checks = [
    { path: '/', content: 'Historic Borders' },
    { path: '/year/1994', content: 'Historic Borders' },
    { path: '/year/-100', content: 'Historic Borders' },
    { path: '/pa/school-districts', content: 'Pennsylvania school districts' },
    { path: historicalAssetPath, method: 'HEAD', cache: IMMUTABLE_CACHE },
    {
      path: '/data/pa-school-districts.json',
      method: 'HEAD',
      cache: SCHOOL_CACHE,
    },
    { path: '/robots.txt', content: 'GPTBot' },
    { path: '/sitemap.xml', content: '/pa/school-districts' },
    { path: '/year/9999', status: 404, content: 'That map is not available' },
  ];
  const results = [];
  for (const check of checks) {
    results.push(await checkResponse(baseUrl, fetchImpl, check));
  }
  return results;
};

module.exports = { runProductionSmoke };

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMocks } from 'node-mocks-http';
import handler from '../../pages/api/wikipedia';

describe('/api/wikipedia', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('returns a source-backed summary', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ['France', ['France'], [], []],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { pages: { '1': { extract: 'France is in Europe.' } } },
        }),
      } as Response);
    const { req, res } = createMocks({
      method: 'POST',
      body: { name: ' France ' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData()).content).toBe('France is in Europe.');
    expect(res.getHeader('cache-control')).toContain('s-maxage=86400');
  });

  it('bounds methods, origins, body size, and names', async () => {
    const method = createMocks({ method: 'GET' });
    await handler(method.req, method.res);
    expect(method.res._getStatusCode()).toBe(405);

    const origin = createMocks({
      method: 'POST',
      headers: { host: 'historicborders.app', origin: 'https://example.com' },
      body: { name: 'France' },
    });
    await handler(origin.req, origin.res);
    expect(origin.res._getStatusCode()).toBe(403);

    const body = createMocks({
      method: 'POST',
      headers: { 'content-length': '1025' },
      body: { name: 'France' },
    });
    await handler(body.req, body.res);
    expect(body.res._getStatusCode()).toBe(413);

    const name = createMocks({
      method: 'POST',
      body: { name: 'x'.repeat(161) },
    });
    await handler(name.req, name.res);
    expect(name.res._getStatusCode()).toBe(400);
  });

  it('returns not found for no search result', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ['Unknown', [], [], []],
    } as Response);
    const { req, res } = createMocks({
      method: 'POST',
      body: { name: 'Unknown' },
    });
    await handler(req, res);
    expect(JSON.parse(res._getData()).content).toBe('Not Found');
  });

  it('fails safely when Wikipedia is unavailable', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('timeout'));
    const { req, res } = createMocks({
      method: 'POST',
      body: { name: 'France' },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(503);
    expect(JSON.parse(res._getData()).error).toContain(
      'temporarily unavailable',
    );
  });
});

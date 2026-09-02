import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMocks } from 'node-mocks-http';
import borderHandler from '../../pages/api/borders/[[...slug]]';
import districtHandler from '../../pages/api/pa-school-districts';

describe('temporary map routes', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('bounds the border route method and path parameters', async () => {
    const method = createMocks({ method: 'POST' });
    await borderHandler(method.req, method.res);
    expect(method.res._getStatusCode()).toBe(405);

    const invalid = createMocks({
      method: 'GET',
      query: { slug: ['owner', '..', '1900'] },
    });
    await borderHandler(invalid.req, invalid.res);
    expect(invalid.res._getStatusCode()).toBe(400);
  });

  it('bounds the district route method and upstream size', async () => {
    const method = createMocks({ method: 'POST' });
    await districtHandler(method.req, method.res);
    expect(method.res._getStatusCode()).toBe(405);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          'content-length': String(25 * 1024 * 1024 + 1),
        }),
      }),
    );
    const oversized = createMocks({ method: 'GET' });
    await districtHandler(oversized.req, oversized.res);
    expect(oversized.res._getStatusCode()).toBe(502);
  });
});

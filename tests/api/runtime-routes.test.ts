import { describe, expect, it } from 'vitest';
import { createMocks } from 'node-mocks-http';
import borderHandler from '../../pages/api/borders/[[...slug]]';

describe('temporary map routes', () => {
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
});

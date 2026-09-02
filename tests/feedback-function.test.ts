import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../functions/api/feedback';

const payload = {
  user: '',
  message: 'Useful map',
  rate: 'nice',
  visitorId: 'visitor-1',
};
const limiter = (success = true) => ({
  limit: vi.fn().mockResolvedValue({ success }),
});
const request = (body: unknown = payload, init: RequestInit = {}) =>
  new Request('https://preview.historicborders.pages.dev/api/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://preview.historicborders.pages.dev',
      ...init.headers,
    },
    body: JSON.stringify(body),
    ...init,
  });

const invoke = (req: Request, env: Record<string, unknown>) =>
  onRequest({ request: req, env } as never);

describe('Cloudflare feedback function', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('crypto', { randomUUID: () => 'feedback-id' });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('is path-, method-, origin-, content-type-, size-, and schema-bounded', async () => {
    expect(
      (
        await invoke(
          new Request('https://example.com/api/not-feedback', {
            method: 'POST',
          }),
          {},
        )
      ).status,
    ).toBe(404);
    expect(
      (await invoke(new Request('https://example.com/api/feedback'), {}))
        .status,
    ).toBe(405);
    expect(
      (
        await invoke(
          request(payload, {
            headers: {
              'Content-Type': 'application/json',
              Origin: 'https://attacker.example',
            },
          }),
          {},
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await invoke(
          request(payload, { headers: { 'Content-Type': 'text/plain' } }),
          {},
        )
      ).status,
    ).toBe(415);
    expect(
      (await invoke(request({ ...payload, message: 'x'.repeat(8_200) }), {}))
        .status,
    ).toBe(413);
    expect(
      (await invoke(request({ ...payload, rate: 'excellent' }), {})).status,
    ).toBe(400);
  });

  it('requires and applies the platform rate limiter', async () => {
    expect(
      (await invoke(request(), { DISCORD_WEBHOOK_URL: 'https://discord.test' }))
        .status,
    ).toBe(503);
    expect(
      (
        await invoke(request(), {
          FEEDBACK_RATE_LIMITER: limiter(false),
          DISCORD_WEBHOOK_URL: 'https://discord.test',
        })
      ).status,
    ).toBe(429);
  });

  it('stores through configured destinations and succeeds when one works', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce({ ok: false } as Response);
    const rate = limiter();
    const response = await invoke(request(), {
      FEEDBACK_RATE_LIMITER: rate,
      DISCORD_WEBHOOK_URL: 'https://discord.test/webhook',
      AIRTABLE_PERSONAL_ACCESS_TOKEN: 'token',
      AIRTABLE_BASE_ID: 'base',
      AIRTABLE_TABLE_NAME: 'Feedback',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('X-HistoricBorders-Compute')).toBe('feedback');
    expect(await response.json()).toEqual({
      message: 'success',
      stored: 1,
      total: 2,
    });
    expect(rate.limit).toHaveBeenCalledWith({ key: 'unknown' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('fails safely when storage is absent or unavailable', async () => {
    expect(
      (await invoke(request(), { FEEDBACK_RATE_LIMITER: limiter() })).status,
    ).toBe(503);
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    expect(
      (
        await invoke(request(), {
          FEEDBACK_RATE_LIMITER: limiter(),
          DISCORD_WEBHOOK_URL: 'https://discord.test',
        })
      ).status,
    ).toBe(503);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackRateLimiter, handleFeedback } from '../worker';

const payload = {
  user: '',
  message: 'Useful map',
  rate: 'nice',
  visitorId: 'visitor-1',
};
const limiter = (status = 204) => {
  const stubFetch = vi.fn().mockResolvedValue(new Response(null, { status }));
  return {
    idFromName: vi.fn().mockReturnValue('limiter-id'),
    get: vi.fn().mockReturnValue({ fetch: stubFetch }),
    stubFetch,
  };
};
const request = (body: unknown = payload, init: RequestInit = {}) =>
  new Request('https://historic-borders.example.workers.dev/api/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://historic-borders.example.workers.dev',
      ...init.headers,
    },
    body: JSON.stringify(body),
    ...init,
  });

const invoke = (req: Request, env: Record<string, unknown>) =>
  handleFeedback(req, env as never);

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
          FEEDBACK_RATE_LIMITER: limiter(429),
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
    expect(rate.idFromName).toHaveBeenCalledWith('unknown');
    expect(rate.stubFetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('strictly limits the twenty-first request in one Durable Object window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-03T00:00:00Z'));
    const values = new Map<string, unknown>();
    const storage = {
      get: async <T>(key: string) => values.get(key) as T | undefined,
      put: async <T>(key: string, value: T) => void values.set(key, value),
      transaction: async <T>(callback: (transaction: unknown) => Promise<T>) =>
        callback(storage),
      setAlarm: vi.fn().mockResolvedValue(undefined),
      delete: async (key: string) => values.delete(key),
    };
    const durableLimiter = new FeedbackRateLimiter({ storage } as never);

    for (let requestNumber = 1; requestNumber <= 20; requestNumber += 1) {
      expect((await durableLimiter.fetch()).status).toBe(204);
    }
    expect((await durableLimiter.fetch()).status).toBe(429);
    await durableLimiter.alarm();
    expect((await durableLimiter.fetch()).status).toBe(204);
    vi.useRealTimers();
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

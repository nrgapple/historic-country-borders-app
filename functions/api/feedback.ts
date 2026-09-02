interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface FeedbackEnv {
  FEEDBACK_RATE_LIMITER: RateLimiter;
  DISCORD_WEBHOOK_URL?: string;
  AIRTABLE_PERSONAL_ACCESS_TOKEN?: string;
  AIRTABLE_BASE_ID?: string;
  AIRTABLE_TABLE_NAME?: string;
}

interface PagesContext {
  request: Request;
  env: FeedbackEnv;
}

type Rating = '' | 'nice' | 'meh' | 'bad';

interface FeedbackPayload {
  user?: unknown;
  message?: unknown;
  rate?: unknown;
  visitorId?: unknown;
  metadata?: unknown;
}

const json = (
  body: object,
  status: number,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-HistoricBorders-Compute': 'feedback',
      ...headers,
    },
  });

const withTimeout = async (
  url: string,
  init: RequestInit,
  milliseconds = 5_000,
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), milliseconds);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const validPayload = (body: FeedbackPayload) => {
  const { user = '', message = '', rate = '', visitorId, metadata } = body;
  return (
    typeof user === 'string' &&
    user.length <= 320 &&
    typeof message === 'string' &&
    message.length <= 2_000 &&
    typeof rate === 'string' &&
    ['', 'nice', 'meh', 'bad'].includes(rate) &&
    typeof visitorId === 'string' &&
    visitorId.length >= 1 &&
    visitorId.length <= 200 &&
    (metadata === undefined ||
      (typeof metadata === 'object' &&
        metadata !== null &&
        !Array.isArray(metadata) &&
        JSON.stringify(metadata).length <= 4_000))
  );
};

const discordBody = (
  payload: { user: string; message: string; rate: Rating; visitorId: string },
  id: string,
  timestamp: string,
) => {
  const emoji = { nice: '😃', meh: '😐', bad: '😡', '': '🤷‍♂️' }[payload.rate];
  return {
    username: 'HB Feedback',
    embeds: [
      {
        title: `${emoji} New Feedback Received`,
        color:
          payload.rate === 'nice'
            ? 0x2ecc71
            : payload.rate === 'bad'
              ? 0xe74c3c
              : 0xf39c12,
        fields: [
          { name: 'Rating', value: emoji, inline: true },
          { name: 'Feedback ID', value: id, inline: true },
          { name: 'Visitor ID', value: payload.visitorId, inline: true },
          payload.user
            ? { name: 'Email', value: payload.user, inline: true }
            : null,
          payload.message
            ? {
                name: 'Message',
                value: payload.message.slice(0, 1024),
                inline: false,
              }
            : null,
        ].filter(Boolean),
        timestamp,
      },
    ],
  };
};

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  if (new URL(request.url).pathname !== '/api/feedback') {
    return json({ message: 'Not found' }, 404);
  }
  if (request.method !== 'POST')
    return json({ message: 'Method not allowed' }, 405, { Allow: 'POST' });

  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin)
    return json({ message: 'Forbidden origin' }, 403);

  const declaredLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declaredLength) && declaredLength > 8_192) {
    return json({ message: 'Feedback payload is too large' }, 413);
  }
  if (
    !request.headers
      .get('Content-Type')
      ?.toLowerCase()
      .startsWith('application/json')
  ) {
    return json({ message: 'Content-Type must be application/json' }, 415);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 8_192) {
    return json({ message: 'Feedback payload is too large' }, 413);
  }
  let body: FeedbackPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ message: 'Invalid feedback payload' }, 400);
  }
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    !validPayload(body)
  ) {
    return json({ message: 'Invalid feedback payload' }, 400);
  }

  if (!env.FEEDBACK_RATE_LIMITER)
    return json({ message: 'Feedback is temporarily unavailable' }, 503);
  const clientKey = request.headers.get('CF-Connecting-IP') || 'unknown';
  const { success } = await env.FEEDBACK_RATE_LIMITER.limit({ key: clientKey });
  if (!success) return json({ message: 'Too many feedback submissions' }, 429);

  const payload = {
    user: (body.user || '') as string,
    message: (body.message || '') as string,
    rate: (body.rate || '') as Rating,
    visitorId: body.visitorId as string,
  };
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const operations: Promise<boolean>[] = [];

  if (env.DISCORD_WEBHOOK_URL) {
    operations.push(
      withTimeout(env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordBody(payload, id, timestamp)),
      }).then(
        (response) => response.ok,
        () => false,
      ),
    );
  }

  if (env.AIRTABLE_PERSONAL_ACCESS_TOKEN && env.AIRTABLE_BASE_ID) {
    const table = encodeURIComponent(env.AIRTABLE_TABLE_NAME || 'Feedback');
    operations.push(
      withTimeout(
        `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}/${table}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.AIRTABLE_PERSONAL_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            records: [
              {
                fields: {
                  'Feedback ID': id,
                  Timestamp: timestamp,
                  Rating: payload.rate,
                  'Visitor ID': payload.visitorId,
                  Environment:
                    (body.metadata as { dev?: unknown } | undefined)?.dev ===
                    true
                      ? 'Development'
                      : 'Production',
                  ...(payload.user ? { Email: payload.user } : {}),
                  ...(payload.message ? { Message: payload.message } : {}),
                  ...(body.metadata
                    ? { Metadata: JSON.stringify(body.metadata) }
                    : {}),
                },
              },
            ],
          }),
        },
      ).then(
        (response) => response.ok,
        () => false,
      ),
    );
  }

  if (operations.length === 0)
    return json({ message: 'Feedback is temporarily unavailable' }, 503);
  const results = await Promise.all(operations);
  const stored = results.filter(Boolean).length;
  if (stored === 0) return json({ message: 'Failed to store feedback' }, 503);
  return json({ message: 'success', stored, total: operations.length }, 200);
}

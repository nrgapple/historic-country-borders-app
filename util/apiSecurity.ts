import type { NextApiRequest, NextApiResponse } from 'next';

export function rejectCrossOriginRequest(
  req: NextApiRequest,
  res: NextApiResponse,
): boolean {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return false;

  try {
    if (new URL(origin).host === host) return false;
  } catch {
    // Invalid origins are rejected below.
  }

  res.status(403).json({ error: 'Origin not allowed' });
  return true;
}

export function hasOversizedBody(
  req: NextApiRequest,
  res: NextApiResponse,
  maximumBytes: number,
): boolean {
  const value = req.headers['content-length'];
  const length = Array.isArray(value) ? Number(value[0]) : Number(value);
  if (!Number.isFinite(length) || length <= maximumBytes) return false;

  res.status(413).json({ error: 'Request body too large' });
  return true;
}

export async function settleWithin<T>(
  promise: Promise<T>,
  milliseconds: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('Operation timed out')),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface RateWindow {
  count: number;
  resetAt: number;
}

export function createFixedWindowLimiter(limit: number, windowMs: number) {
  const windows = new Map<string, RateWindow>();

  return {
    allow(key: string, now = Date.now()): boolean {
      const current = windows.get(key);
      if (!current || current.resetAt <= now) {
        windows.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (current.count >= limit) return false;
      current.count += 1;
      return true;
    },
    clear() {
      windows.clear();
    },
  };
}

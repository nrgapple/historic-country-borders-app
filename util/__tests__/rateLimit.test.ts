import { describe, expect, it } from 'vitest';
import { createFixedWindowLimiter } from '../rateLimit';

describe('createFixedWindowLimiter', () => {
  it('bounds each key and resets after the configured window', () => {
    const limiter = createFixedWindowLimiter(2, 1_000);
    expect(limiter.allow('visitor', 0)).toBe(true);
    expect(limiter.allow('visitor', 1)).toBe(true);
    expect(limiter.allow('visitor', 2)).toBe(false);
    expect(limiter.allow('other', 2)).toBe(true);
    expect(limiter.allow('visitor', 1_000)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { landRings, orthographic, viewOutline } from '../globe';

describe('locator globe', () => {
  it('puts the view centre in the middle of the disc and hides the far side', () => {
    const p = orthographic([15, 47], 32, 30);
    const [x, y, v] = p([15, 47]);
    expect(x).toBeCloseTo(32);
    expect(y).toBeCloseTo(32);
    expect(v).toBe(true);
    expect(p([-165, -47])[2]).toBe(false);
    // East is right, north is up.
    expect(p([25, 47])[0]).toBeGreaterThan(32);
    expect(p([15, 57])[1]).toBeLessThan(32);
  });

  it('traces the view outline along all four edges', () => {
    const ring = viewOutline([-10, 30, 50, 65]);
    expect(ring[0]).toEqual([-10, 65]);
    expect(ring).toContainEqual([50, 30]);
    expect(Math.max(...ring.map((p) => p[0]))).toBe(50);
    expect(Math.min(...ring.map((p) => p[1]))).toBe(30);
  });

  it('reads outer rings from Polygon and MultiPolygon land', () => {
    const square = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ];
    expect(
      landRings({
        features: [
          { geometry: { type: 'Polygon', coordinates: [square] } },
          {
            geometry: {
              type: 'MultiPolygon',
              coordinates: [[square], [square]],
            },
          },
          { geometry: null },
        ],
      }),
    ).toHaveLength(3);
  });
});

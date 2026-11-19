import { deepPoint, mercatorX, mercatorY, triangulate } from './geometry';

const ring = (x0: number, y0: number, x1: number, y1: number) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
];

describe('mercator', () => {
  it('maps the world onto MapLibre’s 0–1 square', () => {
    expect(mercatorX(-180)).toBe(0);
    expect(mercatorX(0)).toBe(0.5);
    expect(mercatorX(180)).toBe(1);
    expect(mercatorY(0)).toBeCloseTo(0.5);
    expect(mercatorY(85.051129)).toBeCloseTo(0, 5);
    expect(mercatorY(-89)).toBeCloseTo(1, 5);
  });
});

describe('triangulate', () => {
  const year = triangulate(1914, {
    features: [
      {
        id: 0,
        properties: { c: 3, name: 'ignored' },
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [ring(0, 0, 10, 10), ring(4, 4, 6, 6)],
            [ring(20, 0, 22, 2)],
          ],
        },
      },
      {
        id: 1,
        properties: { dep: 1, ov: 0, oc: 3 },
        geometry: { type: 'Polygon', coordinates: [ring(-10, 0, -5, 5)] },
      },
      {
        id: 'bad',
        properties: {},
        geometry: { type: 'Point', coordinates: [0, 0] },
      },
    ],
  });

  it('keeps numeric paint properties by territory id', () => {
    expect(year.props[0]).toEqual({ c: 3 });
    expect(year.props[1]).toEqual({ dep: 1, ov: 0, oc: 3 });
  });

  it('triangulates every part, holes included, tagged with its territory', () => {
    // 10x10 with a 2x2 hole (8 triangles) + 2x2 square + 5x5 square.
    expect(year.indices.length).toBe(3 * (8 + 2 + 2));
    expect(year.positions.length).toBe(year.ids.length * 2);
    for (const index of year.indices)
      expect(index).toBeLessThan(year.ids.length);
    expect(new Set(year.ids)).toEqual(new Set([0, 1]));
    // Triangle area equals polygon area minus holes (in mercator units).
    let area = 0;
    for (let i = 0; i < year.indices.length; i += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => year.indices[i + k] * 2);
      const p = year.positions;
      area +=
        Math.abs(
          (p[b] - p[a]) * (p[c + 1] - p[a + 1]) -
            (p[c] - p[a]) * (p[b + 1] - p[a + 1]),
        ) / 2;
    }
    const box = (x0: number, y0: number, x1: number, y1: number) =>
      (mercatorX(x1) - mercatorX(x0)) * (mercatorY(y0) - mercatorY(y1));
    const expected =
      box(0, 0, 10, 10) -
      box(4, 4, 6, 6) +
      box(20, 0, 22, 2) +
      box(-10, 0, -5, 5);
    expect(area).toBeCloseTo(expected, 6);
  });

  it('records one part per polygon with a seed inside its land', () => {
    expect(year.parts.map((p) => p.id)).toEqual([0, 0, 1]);
    for (const part of year.parts) {
      const [x0, y0, x1, y1] = part.bbox;
      expect(part.seed[0]).toBeGreaterThan(x0);
      expect(part.seed[0]).toBeLessThan(x1);
      expect(part.seed[1]).toBeGreaterThan(y0);
      expect(part.seed[1]).toBeLessThan(y1);
    }
    // The seed of the square with a hole avoids the hole.
    const [sx, sy] = year.parts[0].seed;
    const inHole =
      sx > mercatorX(4) &&
      sx < mercatorX(6) &&
      sy < mercatorY(4) &&
      sy > mercatorY(6);
    expect(inHole).toBe(false);
  });

  it('survives an empty or malformed file', () => {
    expect(triangulate(1, {}).indices.length).toBe(0);
    expect(triangulate(1, { features: [] }).parts).toEqual([]);
  });
});

describe('deepPoint', () => {
  it('finds a point deep inside an L shape, not in its notch', () => {
    // An L: the bbox centre (0.5, 0.5) is outside the polygon.
    const l = Float64Array.from([
      0, 0, 1, 0, 1, 0.4, 0.4, 0.4, 0.4, 1, 0, 1, 0, 0,
    ]);
    const [x, y] = deepPoint([l], [0, 0, 1, 1]);
    expect(x < 0.4 || y < 0.4).toBe(true);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
  });
});

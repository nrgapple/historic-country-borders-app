import { describe, expect, it } from 'vitest';
import {
  bboxesIntersect,
  decodeIds,
  edgeDistance,
  idColor,
  isComfortable,
  labelTerritories,
  landPolygons,
  pickAnchors,
  placementOf,
  relocatedIds,
  VIEWPORT_LABEL,
} from './viewportLabels';

/** Builds a grid from rows of characters: '.' is -1, digits are ids. */
const gridOf = (rows: string[]) => {
  const w = rows[0].length;
  const h = rows.length;
  const g = new Int32Array(w * h);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => (g[y * w + x] = ch === '.' ? -1 : Number(ch))),
  );
  return { g, w, h };
};

describe('isComfortable', () => {
  const size = { width: 1000, height: 600 };
  it('accepts a point well inside the map', () => {
    expect(isComfortable(500, 300, size)).toBe(true);
  });
  it('rejects points off screen or so close to an edge that the name is clipped', () => {
    expect(isComfortable(-20, 300, size)).toBe(false);
    expect(isComfortable(size.width - 10, 300, size)).toBe(false);
    expect(isComfortable(500, 5, size)).toBe(false);
  });
  it('rejects a point under, or just beside, the map key', () => {
    const key = { left: 20, top: 400, right: 260, bottom: 580 };
    expect(isComfortable(150, 500, size, [key])).toBe(false);
    expect(isComfortable(300, 500, size, [key])).toBe(false); // name would run under the key
    expect(isComfortable(600, 500, size, [key])).toBe(true);
  });
});

describe('edgeDistance', () => {
  it('is zero on region edges and the grid border, and grows inward', () => {
    const { g, w, h } = gridOf([
      '1111111',
      '1111111',
      '1111111',
      '1111111',
      '1111111',
    ]);
    const d = edgeDistance(g, w, h);
    expect(d[0]).toBe(0);
    expect(d[1 * w + 1]).toBe(1);
    expect(d[2 * w + 3]).toBe(2);
  });
  it('treats empty cells (-1) and other ids as edges', () => {
    const { g, w, h } = gridOf(['22222', '22.22', '22222']);
    const d = edgeDistance(g, w, h);
    expect(d[1 * w + 2]).toBe(0);
    expect(d[1 * w + 1]).toBe(0); // beside the hole
  });
});

describe('pickAnchors', () => {
  const big = gridOf([
    '..........',
    '.11111111.',
    '.11111111.',
    '.11111111.',
    '.11111111.',
    '.11111111.',
    '..........',
    '.2........',
  ]);

  it('anchors a large visible territory at its deepest cell', () => {
    const a = pickAnchors(big.g, big.w, big.h, { minCells: 10, minDepth: 1 });
    const one = a.get(1)!;
    expect(one.cells).toBe(40);
    expect(one.depth).toBeGreaterThanOrEqual(2);
    expect(one.cy).toBeGreaterThanOrEqual(2);
    expect(one.cy).toBeLessThanOrEqual(4);
    expect(one.cx).toBeGreaterThanOrEqual(3);
    expect(one.cx).toBeLessThanOrEqual(6);
  });

  it('skips slivers: too few cells or too shallow', () => {
    const a = pickAnchors(big.g, big.w, big.h, { minCells: 10, minDepth: 1 });
    expect(a.has(2)).toBe(false);
    const shallow = pickAnchors(big.g, big.w, big.h, {
      minCells: 1,
      minDepth: 5,
    });
    expect(shallow.size).toBe(0);
  });

  it('keeps a previous anchor while it is still deep enough (no jitter)', () => {
    const a = pickAnchors(big.g, big.w, big.h, {
      minCells: 10,
      minDepth: 1,
      keepShare: 0.5,
      previous: new Map([[1, { cx: 3, cy: 2 }]]),
    });
    expect(a.get(1)).toMatchObject({ cx: 3, cy: 2 });
    const moved = pickAnchors(big.g, big.w, big.h, {
      minCells: 10,
      minDepth: 1,
      previous: new Map([[1, { cx: 0, cy: 0 }]]), // now outside the territory
    });
    expect(moved.get(1)).not.toMatchObject({ cx: 0, cy: 0 });
  });
});

describe('decodeIds', () => {
  const pixels = (ids: (number | null)[], w: number, h: number) => {
    const out = new Uint8ClampedArray(w * h * 4);
    ids.forEach((id, i) => {
      if (id === null) return;
      const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(idColor(id))!;
      out.set([+m[1], +m[2], +m[3], 255], i * 4);
    });
    return out;
  };
  it('round-trips ids above 255 and drops pixels whose neighbours disagree', () => {
    const ids = [300, 300, 300, 300, 300, 300, 300, 300, 7];
    const g = decodeIds(pixels(ids, 3, 3), 3, 3);
    expect(g[0]).toBe(300);
    expect(g[4]).toBe(300);
    expect(g[5]).toBe(-1); // beside the 7
    expect(g[8]).toBe(-1);
  });
  it('maps transparent and water pixels to -1', () => {
    const rgba = new Uint8ClampedArray(4 * 4);
    rgba.set([0, 0, 0, 255], 0); // water
    const g = decodeIds(rgba, 2, 2);
    expect([...g]).toEqual([-1, -1, -1, -1]);
  });
});

describe('labelTerritories', () => {
  it('groups every label point of a territory and keeps the largest area', () => {
    const t = labelTerritories({
      features: [
        {
          id: 131,
          properties: { n: 'Russian Empire', a: 21356357 },
          geometry: { type: 'Point', coordinates: [66.85, 52.45] },
        },
        {
          id: 131,
          properties: { n: 'Russian Empire', a: 105260 },
          geometry: { type: 'Point', coordinates: [-178.3, 67.2] },
        },
        {
          properties: { p: 'Prague', k: 'city' },
          geometry: { type: 'Point', coordinates: [14.4, 50.1] },
        },
      ],
    });
    expect([...t.keys()]).toEqual([131]);
    expect(t.get(131)).toMatchObject({
      name: 'Russian Empire',
      areaKm2: 21356357,
      points: [
        [66.85, 52.45],
        [-178.3, 67.2],
      ],
    });
  });
});

it('keeps the tuning constants sane', () => {
  expect(VIEWPORT_LABEL.minShare).toBeGreaterThan(0);
  expect(VIEWPORT_LABEL.minShare).toBeLessThan(0.1);
  expect(VIEWPORT_LABEL.keepShare).toBeLessThan(1);
});

describe('placementOf and relocatedIds', () => {
  const size = { width: 1000, height: 600 };
  const key = { left: 20, top: 400, right: 260, bottom: 580 };
  it('tells a clipped point from one hidden by a panel', () => {
    expect(placementOf(500, 300, size, [key])).toBe('comfortable');
    expect(placementOf(-40, 300, size, [key])).toBe('edge');
    expect(placementOf(150, 500, size, [key])).toBe('under');
    expect(placementOf(268, 500, size, [key])).toBe('under');
    expect(placementOf(300, 500, size, [key])).toBe('beside');
  });
  it('hides both anchored and hidden territories at their own points', () => {
    expect(
      relocatedIds({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 131,
            properties: { n: 'Russian Empire', a: 1 },
            geometry: { type: 'Point', coordinates: [40, 55] },
          },
        ],
        hidden: [86],
      }),
    ).toEqual([131, 86]);
    expect(relocatedIds(null)).toEqual([]);
  });
});

describe('bboxesIntersect and landPolygons', () => {
  it('finds overlaps across the antimeridian and rejects distant boxes', () => {
    expect(bboxesIntersect([27, 38, 190, 78], [-10, 30, 50, 62])).toBe(true);
    // T1 writes the Russian Empire's box with east < west.
    const russia = [17.89, 35.25, -169.83, 77.6] as const;
    expect(bboxesIntersect(russia, [-38.9, 26, 68.9, 62.1])).toBe(true);
    expect(bboxesIntersect(russia, [-175, 60, -160, 70])).toBe(true);
    expect(bboxesIntersect(russia, [-100, 30, -80, 50])).toBe(false);
    expect(bboxesIntersect([170, 50, 179, 70], [-185, 55, -170, 65])).toBe(
      true,
    );
    expect(bboxesIntersect([100, -10, 120, 5], [-10, 30, 50, 62])).toBe(false);
    expect(bboxesIntersect([0, -40, 20, -30], [-10, 30, 50, 62])).toBe(false);
  });
  it('keeps holes, so lakes inside land stay water', () => {
    const outer = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 0],
    ];
    const hole = [
      [2, 1],
      [3, 1],
      [3, 2],
      [2, 1],
    ];
    expect(
      landPolygons({
        features: [
          { geometry: { type: 'Polygon', coordinates: [outer, hole] } },
          { geometry: null },
        ],
      }),
    ).toEqual([[outer, hole]]);
  });
});

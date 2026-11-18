import { describe, expect, it } from 'vitest';
import { bboxOf, coverageRuns, districtWashes } from './pa-lib.mjs';

const square = (x, y) => ({
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [x, y],
        [x + 1, y],
        [x + 1, y + 1],
        [x, y + 1],
        [x, y],
      ],
    ],
  },
});

describe('PA district build helpers', () => {
  it('never gives neighbouring districts the same wash', () => {
    // A 3 × 3 grid: every cell shares vertices with up to eight others.
    const cells = [];
    for (let x = 0; x < 3; x += 1)
      for (let y = 0; y < 3; y += 1) cells.push(square(x, y));
    const wash = districtWashes(cells);
    const touches = (a, b) =>
      Math.abs(
        a.geometry.coordinates[0][0][0] - b.geometry.coordinates[0][0][0],
      ) <= 1 &&
      Math.abs(
        a.geometry.coordinates[0][0][1] - b.geometry.coordinates[0][0][1],
      ) <= 1;
    cells.forEach((a, i) =>
      cells.forEach((b, j) => {
        if (i !== j && touches(a, b)) expect(wash[i]).not.toBe(wash[j]);
      }),
    );
    expect(Math.max(...wash)).toBeLessThan(12);
    expect(districtWashes(cells)).toEqual(wash);
  });

  it('computes bounds and coverage runs', () => {
    expect(
      bboxOf(square(-75.123456, 40).geometry).map((v) => +v.toFixed(5)),
    ).toEqual([-75.12346, 40, -74.12346, 41]);
    expect(
      coverageRuns([
        { z: 5, x: 3, y: 1 },
        { z: 5, x: 1, y: 1 },
        { z: 5, x: 2, y: 1 },
        { z: 5, x: 7, y: 1 },
        { z: 6, x: 0, y: 2 },
      ]),
    ).toEqual({
      5: {
        1: [
          [1, 3],
          [7, 7],
        ],
      },
      6: { 2: [[0, 0]] },
    });
  });
});

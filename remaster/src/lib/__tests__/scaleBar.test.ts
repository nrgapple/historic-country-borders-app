import { describe, expect, it } from 'vitest';
import {
  barPx,
  formatLatitude,
  haversineKm,
  NICE_KM,
  pxPerDegree,
  scaleBar,
} from '../scaleBar';

/**
 * Independent check: unproject the bar's ends with Web Mercator (MapLibre's
 * 512 px world, as `map.unproject` does) around the centre latitude, and
 * measure them with the haversine formula.
 */
const unprojectedKm = (lat: number, zoom: number, px: number) => {
  const dLng = px / pxPerDegree(zoom);
  return haversineKm([-dLng / 2, lat], [dLng / 2, lat]);
};

describe('scale bar (plan §9.2 P3: within ±2% of haversine at z2–8)', () => {
  const zooms = [2, 2.6, 3, 3.2, 4, 5, 6, 7, 8];
  const lats = [-60, -33.9, 0, 23.5, 41, 47, 55.7, 64, 70];

  it.each(zooms)('is true at the centre latitude at z%s', (zoom) => {
    for (const lat of lats) {
      for (const maxPx of [96, 132]) {
        const s = scaleBar(lat, zoom, maxPx, 48);
        const measured = unprojectedKm(lat, zoom, s.px);
        expect(Math.abs(measured - s.km) / s.km).toBeLessThan(0.02);
      }
    }
  });

  it('picks the longest round distance that fits the space', () => {
    for (const zoom of [2, 4, 6, 8]) {
      const s = scaleBar(47, zoom, 132, 48);
      expect(NICE_KM).toContain(s.km);
      expect(s.px).toBeLessThanOrEqual(132);
      const next = NICE_KM[NICE_KM.indexOf(s.km as never) + 1];
      if (next) expect(barPx(next, 47, zoom) ?? Infinity).toBeGreaterThan(132);
    }
  });

  it('is longer per kilometre toward the poles (Mercator stretch)', () => {
    expect(barPx(500, 60, 3)!).toBeGreaterThan(barPx(500, 0, 3)! * 1.9);
  });

  it('reports the latitude it is true at', () => {
    expect(scaleBar(46.6, 3, 132).lat).toBe(47);
    expect(formatLatitude(47)).toBe('47° N');
    expect(formatLatitude(-34)).toBe('34° S');
    expect(formatLatitude(0)).toBe('0°');
  });

  it('matches a known distance: 1° of longitude on the equator is about 111 km', () => {
    expect(haversineKm([0, 0], [1, 0])).toBeCloseTo(111.2, 1);
  });

  it('never returns an empty bar, even far out or near the poles', () => {
    const s = scaleBar(84, 1, 96);
    expect(s.px).toBeGreaterThan(0);
    expect(Number.isFinite(s.px)).toBe(true);
  });
});

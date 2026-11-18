import { describe, expect, it, vi } from 'vitest';

vi.mock('maplibre-gl', () => ({
  addProtocol: vi.fn(),
  setWorkerUrl: vi.fn(),
  AttributionControl: vi.fn(),
  NavigationControl: vi.fn(),
  Map: vi.fn(),
}));
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?url', () => ({
  default: '/worker.js',
}));

const { covered, resolvePaTile } = await import('../paMap');
const pa = (await import('../../data/pa.json')).default;

describe('pa-tiles protocol', () => {
  const coverage = {
    '12': {
      '1550': [
        [1130, 1135],
        [1140, 1140],
      ],
    },
  };

  it('reads per-zoom row runs', () => {
    expect(covered(coverage, 12, 1130, 1550)).toBe(true);
    expect(covered(coverage, 12, 1140, 1550)).toBe(true);
    expect(covered(coverage, 12, 1137, 1550)).toBe(false);
    expect(covered(coverage, 11, 1130, 1550)).toBe(false);
  });

  it('maps covered tiles to first-party URLs and never requests the rest', () => {
    const [z, rows] = Object.entries(pa.basemap.coverage).at(-1)!;
    const [y, runs] = Object.entries(rows as Record<string, number[][]>)[0];
    const x = runs[0][0];
    expect(
      resolvePaTile(
        `pa-tiles://basemap/${z}/${x}/${y}`,
        'https://example.test',
      ),
    ).toBe(
      `https://example.test/tiles/pa/${pa.basemap.buildId}/${z}/${x}/${y}.pbf`,
    );
    // Ohio at z12 is outside the state coverage: MapLibre falls back to a parent.
    expect(resolvePaTile('pa-tiles://basemap/12/1100/1530', '')).toBe(
      'outside',
    );
    // A district tile over Lake Erie has no districts: an empty tile, no request.
    expect(resolvePaTile('pa-tiles://districts/11/500/700', '')).toBe('empty');
    expect(() => resolvePaTile('https://example.test/1/2/3', '')).toThrow();
  });
});

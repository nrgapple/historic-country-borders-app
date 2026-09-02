import { describe, expect, it } from 'vitest';

const {
  buildPayload,
  validateBorderSource,
  validatePayload,
  validatePlacesSource,
} = require('../scripts/lib/historical-data');

const ring = [
  [0, 0],
  [2, 0],
  [2, 2],
  [0, 2],
  [0, 0],
];

const borders = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { NAME: 'Testland' },
      geometry: { type: 'Polygon', coordinates: [ring] },
    },
    {
      type: 'Feature',
      properties: { NAME: 'Islands', SUBJECTO: 'Testland' },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [ring],
          [
            [
              [10, 10],
              [11, 10],
              [11, 11],
              [10, 11],
              [10, 10],
            ],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { NAME: 'unclaimed' },
      geometry: { type: 'Polygon', coordinates: [ring] },
    },
  ],
};

const places = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Old', inhabitedSince: -500, inhabitedUntil: 500 },
      geometry: { type: 'Point', coordinates: [1, 1] },
    },
    {
      type: 'Feature',
      properties: { name: 'New', inhabitedSince: 1000, inhabitedUntil: null },
      geometry: { type: 'Point', coordinates: [2, 2] },
    },
    {
      type: 'Feature',
      properties: {
        name: 'Undated',
        inhabitedSince: null,
        inhabitedUntil: null,
      },
      geometry: { type: 'Point', coordinates: [3, 3] },
    },
  ],
};

describe('historical data pipeline', () => {
  it('validates and preprocesses Polygon, MultiPolygon, and dated places', () => {
    expect(validateBorderSource(borders)).toBe(borders);
    expect(validatePlacesSource(places)).toBe(places);
    const payload = validatePayload(buildPayload(-100, borders, places));
    expect(payload.data.borders.features).toHaveLength(2);
    expect(payload.data.labels.features).toHaveLength(2);
    expect(payload.data.labels.features[0].geometry.type).toBe('Point');
    expect(
      payload.places.features.map((feature: any) => feature.properties.name),
    ).toEqual(['Old']);
  });

  it('rejects malformed and out-of-range geometry', () => {
    const malformed = structuredClone(borders);
    malformed.features[0].geometry.coordinates[0][0] = [181, 0];
    expect(() => validateBorderSource(malformed)).toThrow(/invalid coordinate/);
  });
});

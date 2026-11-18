import { describe, expect, it } from 'vitest';

const {
  COORDINATE_PRECISION,
  buildPayload,
  countFallbackRings,
  publishRing,
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

  it('rounds border, label, and place coordinates to five decimals', () => {
    expect(COORDINATE_PRECISION).toBe(5);
    const precise = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            NAME: 'Precisia',
            SUBJECTO: 'Overlord',
            PARTOF: 'Greater Precisia',
            BORDERPRECISION: 1,
            ABBREVN: 'Prc',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [10.123456789012345, 20.987654321098765],
                [12.000004999999999, 20.987654321098765],
                [12.000004999999999, 22.333333333333332],
                [10.123456789012345, 22.333333333333332],
                [10.123456789012345, 20.987654321098765],
              ],
            ],
          },
        },
      ],
    };
    const precisePlaces = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Capital', inhabitedSince: 0 },
          geometry: {
            type: 'Point',
            coordinates: [11.111111111111111, 21.555555555555555],
          },
        },
      ],
    };

    const payload = validatePayload(buildPayload(100, precise, precisePlaces));
    const [border] = payload.data.borders.features;
    expect(border.geometry.coordinates).toEqual([
      [
        [10.12346, 20.98765],
        [12, 20.98765],
        [12, 22.33333],
        [10.12346, 22.33333],
        [10.12346, 20.98765],
      ],
    ]);
    expect(border.properties).toMatchObject({
      NAME: 'Precisia',
      SUBJECTO: 'Overlord',
      PARTOF: 'Greater Precisia',
      BORDERPRECISION: 1,
    });
    expect(border.properties.COLOR).toMatch(/^#[0-9A-F]{6}$/);
    const [label] = payload.data.labels.features;
    // Labels carry only what the label layer reads.
    expect(Object.keys(label.properties).sort()).toEqual(['AREA', 'NAME']);
    expect(label.properties.NAME).toBe('Precisia');
    expect(label.properties.AREA).toBeGreaterThan(0);
    label.geometry.coordinates.forEach((value: number) =>
      expect(Number(value.toFixed(5))).toBe(value),
    );
    expect(payload.places.features[0].geometry.coordinates).toEqual([
      11.11111, 21.55556,
    ]);
    expect(precise.features[0].geometry.coordinates[0][0][0]).toBe(
      10.123456789012345,
    );
    expect(countFallbackRings(payload)).toBe(0);
  });

  it('omits empty upstream properties from published features', () => {
    const payload = buildPayload(
      1000,
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { NAME: 'Sparse', wikipedia: null, ABBREVN: '' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 0],
                ],
              ],
            },
          },
        ],
      },
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              name: 'Town',
              inhabitedSince: 0,
              inhabitedUntil: null,
              'name.fr': null,
            },
            geometry: { type: 'Point', coordinates: [0.5, 0.5] },
          },
        ],
      },
    );
    expect(payload.data.borders.features[0].properties).not.toHaveProperty(
      'wikipedia',
    );
    expect(payload.data.borders.features[0].properties).not.toHaveProperty(
      'ABBREVN',
    );
    expect(payload.places.features[0].properties).toEqual({
      name: 'Town',
      inhabitedSince: 0,
    });
  });

  it('drops consecutive duplicate positions created by rounding', () => {
    const { ring: published, fallback } = publishRing([
      [0, 0],
      [0.000001, 0.000002],
      [0.000004, 0],
      [1, 0],
      [1, 1],
      [1.000001, 1.000001],
      [0, 1],
      [0, 0],
    ]);
    expect(fallback).toBe(false);
    expect(published).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ]);
  });

  it('keeps the original ring when rounding would collapse it', () => {
    const tiny = [
      [5.000001, 5.000001],
      [5.000002, 5.000001],
      [5.000002, 5.000002],
      [5.000001, 5.000001],
    ];
    expect(publishRing(tiny)).toEqual({ ring: tiny, fallback: true });

    const collapsing = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { NAME: 'Speck' },
          geometry: { type: 'MultiPolygon', coordinates: [[ring], [tiny]] },
        },
      ],
    };
    const payload = validatePayload(
      buildPayload(0, collapsing, { type: 'FeatureCollection', features: [] }),
    );
    const [mainland, speck] = payload.data.borders.features[0].geometry
      .coordinates as number[][][][];
    expect(mainland[0]).toEqual(ring);
    expect(speck[0]).toEqual(tiny);
    expect(countFallbackRings(payload)).toBe(1);
  });

  it('rejects published payloads with unrounded or duplicate coordinates', () => {
    const payload = buildPayload(-100, borders, places);
    const unrounded = structuredClone(payload);
    unrounded.data.borders.features[0].geometry.coordinates[0][1] = [
      2.0000001, 0,
    ];
    expect(() => validatePayload(unrounded)).toThrow(/unrounded or duplicate/);

    const duplicated = structuredClone(payload);
    duplicated.data.borders.features[0].geometry.coordinates[0].splice(
      1,
      0,
      [2, 0],
    );
    expect(() => validatePayload(duplicated)).toThrow(/unrounded or duplicate/);

    const label = structuredClone(payload);
    label.data.labels.features[0].geometry.coordinates = [1.123456, 1];
    expect(() => validatePayload(label)).toThrow(/label 0 has unrounded/);

    const place = structuredClone(payload);
    place.places.features[0].geometry.coordinates = [1, 1.123456];
    expect(() => validatePayload(place)).toThrow(/place 0 has unrounded/);
  });

  it('rejects malformed and out-of-range geometry', () => {
    const malformed = structuredClone(borders);
    malformed.features[0].geometry.coordinates[0][0] = [181, 0];
    expect(() => validateBorderSource(malformed)).toThrow(/invalid coordinate/);
  });
});

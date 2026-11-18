import { describe, expect, it } from 'vitest';

const {
  applyBorderOverrides,
  applyPlaceNameOverrides,
  applyPlaceOverrides,
  COORDINATE_PRECISION,
  buildPayload,
  countFallbackRings,
  placesForYear,
  publishRing,
  validateBorderSource,
  textDefect,
  validateNameOverrides,
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

  it('applies reviewed place end dates and rejects stale overrides', () => {
    const source = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            name: 'Ur',
            inhabitedSince: -5000,
            inhabitedUntil: null,
          },
          geometry: { type: 'Point', coordinates: [46.1, 30.96] },
        },
        {
          type: 'Feature',
          properties: { name: 'Ur', inhabitedSince: null },
          geometry: { type: 'Point', coordinates: [46.1, 30.96] },
        },
      ],
    };
    const file = (overrides: unknown[]) => ({ schemaVersion: 1, overrides });
    const ur = {
      name: 'Ur',
      inhabitedUntil: -500,
      source: 'https://en.wikipedia.org/wiki/Ur',
    };
    const applied = applyPlaceOverrides(source, file([ur]));
    expect(applied.features[0].properties.inhabitedUntil).toBe(-500);
    expect(applied.features[1].properties.inhabitedUntil).toBeUndefined();
    expect(placesForYear(1492, applied).features).toHaveLength(0);
    expect(placesForYear(-1000, applied).features).toHaveLength(1);

    expect(() =>
      applyPlaceOverrides(source, file([{ ...ur, name: 'Atlantis' }])),
    ).toThrow('match no dated place');
    expect(() =>
      applyPlaceOverrides(source, file([{ ...ur, inhabitedUntil: -9000 }])),
    ).toThrow('ends before it starts');
    expect(() =>
      applyPlaceOverrides(source, file([{ ...ur, source: 'http://x' }])),
    ).toThrow('is invalid');
  });

  describe('blank and padded names', () => {
    const square = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    const source = (properties: Record<string, unknown>) => ({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties,
          geometry: { type: 'Polygon', coordinates: [square] },
        },
      ],
    });
    const noPlaces = { type: 'FeatureCollection', features: [] };

    it('keeps a whitespace-only NAME as an unnamed border with an unnamed label', () => {
      const payload = buildPayload(
        -5000,
        source({
          NAME: '      ',
          ABBREVN: 'Cardial Ware culture',
          PARTOF: '   ',
          SUBJECTO: 'Cardial Ware culture',
        }),
        noPlaces,
      );
      const [border] = payload.data.borders.features;
      const [label] = payload.data.labels.features;
      expect(border.properties).not.toHaveProperty('NAME');
      expect(border.properties).not.toHaveProperty('PARTOF');
      expect(border.properties.ABBREVN).toBe('Cardial Ware culture');
      expect(label.properties).not.toHaveProperty('NAME');
      expect(label.properties.AREA).toBeGreaterThan(0);
      expect(() => validatePayload(payload)).not.toThrow();
    });

    it('treats an empty NAME like a whitespace-only one and keeps its color', () => {
      const blank = buildPayload(1994, source({ NAME: '' }), noPlaces);
      expect(blank.data.borders.features[0].properties).toEqual({
        COLOR: '#FF6B6B',
      });
    });

    it('trims padded names without changing their color', () => {
      const padded = buildPayload(
        100,
        source({ NAME: 'Pomeranian culture ' }),
        noPlaces,
      );
      const trimmed = buildPayload(
        100,
        source({ NAME: 'Pomeranian culture' }),
        noPlaces,
      );
      expect(padded.data.borders.features[0].properties.NAME).toBe(
        'Pomeranian culture',
      );
      expect(padded.data.labels.features[0].properties.NAME).toBe(
        'Pomeranian culture',
      );
      // The color hashes the source spelling, so published palettes are stable.
      expect(padded.data.borders.features[0].properties.COLOR).not.toBe(
        trimmed.data.borders.features[0].properties.COLOR,
      );
    });

    it('rejects blank, padded, and mismatched names in published payloads', () => {
      const payload = buildPayload(
        1000,
        source({ NAME: 'Testland' }),
        noPlaces,
      );
      const withName = (border: unknown, label: unknown) => ({
        ...payload,
        data: {
          borders: {
            ...payload.data.borders,
            features: [
              {
                ...payload.data.borders.features[0],
                properties: { NAME: border },
              },
            ],
          },
          labels: {
            ...payload.data.labels,
            features: [
              {
                ...payload.data.labels.features[0],
                properties: { NAME: label, AREA: 1 },
              },
            ],
          },
        },
      });
      expect(() => validatePayload(withName('   ', '   '))).toThrow(/blank/);
      expect(() => validatePayload(withName('', ''))).toThrow(/blank/);
      expect(() => validatePayload(withName('Testland ', 'Testland '))).toThrow(
        /untrimmed/,
      );
      expect(() => validatePayload(withName('Testland', 'Other'))).toThrow(
        /different names/,
      );
      expect(() =>
        validatePayload(withName(undefined, undefined)),
      ).not.toThrow();
    });

    it('rejects blank place names', () => {
      const payload = buildPayload(1000, source({ NAME: 'Testland' }), {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: '  ', inhabitedSince: 0 },
            geometry: { type: 'Point', coordinates: [0.5, 0.5] },
          },
        ],
      });
      expect(() => validatePayload(payload)).toThrow(/blank name/);
    });
  });
});

describe('reviewed name overrides', () => {
  const square = (west: number, south: number, size: number) => [
    [west, south],
    [west + size, south],
    [west + size, south + size],
    [west, south + size],
    [west, south],
  ];
  const feature = (
    properties: Record<string, unknown>,
    ring = square(6, 46, 1),
  ) => ({
    type: 'Feature',
    properties,
    geometry: { type: 'Polygon', coordinates: [ring] },
  });
  const collection = (features: unknown[]) => ({
    type: 'FeatureCollection',
    features,
  });
  const noPlaces = collection([]);
  // A 0.0001° square is about 0.0001 km²: a sliver.
  const sliver = (properties: Record<string, unknown>) =>
    feature(properties, square(7.28, 45.9, 0.0001));
  const swiss = () =>
    collection([
      feature({ NAME: '', ABBREVN: '', SUBJECTO: '', PARTOF: '' }),
      sliver({
        NAME: 'Switzerland',
        ABBREVN: 'Switzerland',
        SUBJECTO: 'Switzerland',
        PARTOF: 'Switzerland',
      }),
      feature({ NAME: 'Austria' }, square(10, 47, 1)),
    ]);
  const reviewed = {
    source: 'https://en.wikipedia.org/wiki/Example',
    note: 'Reviewed.',
  };
  const file = (extra: Record<string, unknown> = {}) => ({
    schemaVersion: 1,
    borders: [],
    places: [],
    overlordAliases: [],
    ...extra,
  });
  const name = (value: string) => ({
    NAME: value,
    ABBREVN: value,
    SUBJECTO: value,
    PARTOF: value,
  });
  const swissEntries = [
    {
      years: [1994, 2000],
      match: { NAME: '' },
      set: name('Switzerland'),
      ...reviewed,
    },
    {
      years: [1994, 2000],
      match: { NAME: 'Switzerland' },
      drop: 'sliver',
      ...reviewed,
    },
  ];
  const overrides = (borders: unknown[], extra = {}) =>
    validateNameOverrides(file({ borders, ...extra }));
  const names = (payload: any) =>
    payload.data.borders.features.map((f: any) => f.properties.NAME);

  it('names the real polygon and drops the sliver that carried the name', () => {
    const payload = validatePayload(
      buildPayload(1994, swiss(), noPlaces, overrides(swissEntries)),
    );
    expect(names(payload)).toEqual(['Switzerland', 'Austria']);
    expect(payload.data.labels.features[0].properties.NAME).toBe('Switzerland');
    expect(payload.data.borders.features[0].properties).toMatchObject(
      name('Switzerland'),
    );
    // The corrected record hashes like the named Switzerland of other years.
    const named = buildPayload(
      1960,
      collection([feature(name('Switzerland'))]),
      noPlaces,
    );
    expect(payload.data.borders.features[0].properties.COLOR).toBe(
      named.data.borders.features[0].properties.COLOR,
    );
    // Years without an entry are untouched.
    expect(
      names(buildPayload(1960, swiss(), noPlaces, overrides(swissEntries))),
    ).toEqual([undefined, 'Switzerland', 'Austria']);
  });

  it('requires every entry to match exactly one source record', () => {
    expect(() =>
      buildPayload(
        1994,
        swiss(),
        noPlaces,
        overrides([{ ...swissEntries[0], match: { NAME: 'Swiss' } }]),
      ),
    ).toThrow(/matches 0 records in 1994/);
    const twice = collection([
      feature({ NAME: 'Kingfom of Italy' }),
      feature({ NAME: 'Kingfom of Italy' }, square(10, 40, 1)),
    ]);
    const italy = {
      years: [1914],
      match: { NAME: 'Kingfom of Italy' },
      set: { NAME: 'Kingdom of Italy' },
      ...reviewed,
    };
    expect(() =>
      buildPayload(1914, twice, noPlaces, overrides([italy])),
    ).toThrow(/matches 2 records/);
    // Matching on more fields narrows to one record.
    const one = collection([
      feature({ NAME: 'Aragón', PARTOF: 'Arag\uFFFDn' }),
      feature({ NAME: 'Aragón', PARTOF: 'Aragón' }, square(10, 40, 1)),
    ]);
    const aragon = {
      years: [1100],
      match: { NAME: 'Aragón', PARTOF: 'Arag\uFFFDn' },
      set: { PARTOF: 'Aragón' },
      ...reviewed,
    };
    const fixed = validatePayload(
      buildPayload(1100, one, noPlaces, overrides([aragon])),
    );
    expect(
      fixed.data.borders.features.map((f: any) => f.properties.PARTOF),
    ).toEqual(['Aragón', 'Aragón']);
  });

  it('rejects two entries for one record and an entry that changes nothing', () => {
    const rename = (to: string) => ({
      years: [1914],
      match: { NAME: 'Kingfom of Italy' },
      set: { NAME: to },
      ...reviewed,
    });
    const source = collection([feature({ NAME: 'Kingfom of Italy' })]);
    expect(() =>
      buildPayload(
        1914,
        source,
        noPlaces,
        overrides([rename('Kingdom of Italy'), rename('Italy')]),
      ),
    ).toThrow(/match the same record/);
    expect(() =>
      buildPayload(
        1914,
        source,
        noPlaces,
        overrides([rename('Kingfom of Italy')]),
      ),
    ).toThrow(/changes nothing/);
  });

  it('drops only sub-km² slivers whose name another record still publishes', () => {
    const drop = (match: Record<string, string>) => ({
      years: [1994],
      match,
      drop: 'sliver',
      ...reviewed,
    });
    // Without the rename, nothing else publishes "Switzerland".
    expect(() =>
      applyBorderOverrides(
        1994,
        swiss(),
        overrides([drop({ NAME: 'Switzerland' })]),
      ),
    ).toThrow(/no other record publishes that name/);
    // A real territory (about 8,000 km²) is never dropped.
    expect(() =>
      applyBorderOverrides(
        1994,
        swiss(),
        overrides([drop({ NAME: 'Austria' })]),
      ),
    ).toThrow(/only slivers under 1 km²/);
  });

  it('validates the override file', () => {
    const entry = swissEntries[0];
    const bad = (borders: unknown[]) => () =>
      validateNameOverrides(file({ borders }));
    expect(() => validateNameOverrides({ schemaVersion: 2 })).toThrow(
      /unsupported schema/,
    );
    expect(bad([{ ...entry, source: 'http://example.org' }])).toThrow(
      /https source/,
    );
    expect(bad([{ ...entry, note: ' ' }])).toThrow(/review note/);
    expect(bad([{ ...entry, years: [] }])).toThrow(/distinct integer years/);
    expect(bad([{ ...entry, years: [1994, 1994] }])).toThrow(
      /distinct integer years/,
    );
    expect(bad([{ ...entry, drop: 'sliver' }])).toThrow(
      /exactly one of set and drop/,
    );
    expect(bad([{ ...swissEntries[1], drop: 'territory' }])).toThrow(
      /only drop a "sliver"/,
    );
    expect(bad([{ ...entry, match: { COLOR: '#000' } }])).toThrow(
      /match must use only/,
    );
    [
      'Arag\uFFFDn',
      'Cochim\u00C3\u00AD',
      'M?ori',
      'Na\u0300nh',
      ' Padded',
    ].forEach((value) =>
      expect(bad([{ ...entry, set: { NAME: value } }])).toThrow(
        /blank or defective name/,
      ),
    );
    const alias = {
      years: [1914],
      from: 'United Kingdom',
      to: 'United Kingdom of Great Britain and Ireland',
      ...reviewed,
    };
    expect(() =>
      validateNameOverrides(file({ overlordAliases: [alias, alias] })),
    ).toThrow(/repeats United Kingdom in 1914/);
    expect(() =>
      validateNameOverrides(
        file({ overlordAliases: [{ ...alias, to: 'United Kingdom' }] }),
      ),
    ).toThrow(/to itself/);
    const parsed = validateNameOverrides(file({ overlordAliases: [alias] }));
    expect(parsed.overlordAliases.get(1914).get('United Kingdom')).toBe(
      'United Kingdom of Great Britain and Ireland',
    );
  });

  it('renames exactly one place and rejects stale place entries', () => {
    const point = (properties: Record<string, unknown>) => ({
      type: 'Feature',
      properties,
      geometry: { type: 'Point', coordinates: [13.36721, 38.11673] },
    });
    const places = collection([
      point({ name: 'Ziz,  Palermo', inhabitedSince: -734 }),
      point({ name: 'Rome', inhabitedSince: -753 }),
    ]);
    const palermo = {
      match: { name: 'Ziz,  Palermo' },
      set: { name: 'Palermo' },
      ...reviewed,
    };
    const renamed = applyPlaceNameOverrides(
      places,
      validateNameOverrides(file({ places: [palermo] })),
    );
    expect(renamed.features.map((f: any) => f.properties.name)).toEqual([
      'Palermo',
      'Rome',
    ]);
    expect(places.features[0].properties.name).toBe('Ziz,  Palermo');
    expect(() =>
      applyPlaceNameOverrides(
        renamed,
        validateNameOverrides(file({ places: [palermo] })),
      ),
    ).toThrow(/matches 0 places/);
    expect(() =>
      applyPlaceNameOverrides(
        places,
        validateNameOverrides(
          file({
            places: [
              { ...palermo, match: { name: 'Rome' }, set: { name: 'Rome' } },
            ],
          }),
        ),
      ),
    ).toThrow(/changes nothing/);
  });
});

describe('published text', () => {
  const square = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0, 0],
  ];
  const payloadFor = (
    properties: Record<string, unknown>,
    place?: Record<string, unknown>,
  ) =>
    buildPayload(
      1492,
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties,
            geometry: { type: 'Polygon', coordinates: [square] },
          },
        ],
      },
      {
        type: 'FeatureCollection',
        features: place
          ? [
              {
                type: 'Feature',
                properties: { inhabitedSince: 0, ...place },
                geometry: { type: 'Point', coordinates: [0.5, 0.5] },
              },
            ]
          : [],
      },
    );

  it('publishes names and every other string as NFC', () => {
    const decomposed = "Gwich'in Na\u0300nh";
    expect(decomposed.normalize('NFC')).not.toBe(decomposed);
    const payload = validatePayload(
      payloadFor(
        { NAME: decomposed, SUBJECTO: decomposed, PARTOF: decomposed },
        { name: 'Teotihuaca\u0301n', description: 'Pir\u00e1mide' },
      ),
    );
    const [border] = payload.data.borders.features;
    expect(border.properties.NAME).toBe("Gwich'in N\u00e0nh");
    expect(border.properties.SUBJECTO).toBe("Gwich'in N\u00e0nh");
    expect(payload.data.labels.features[0].properties.NAME).toBe(
      "Gwich'in N\u00e0nh",
    );
    expect(payload.places.features[0].properties.name).toBe('Teotihuac\u00e1n');
  });

  it('flags replacement characters, mojibake and lost characters', () => {
    expect(textDefect('Arag\uFFFDn', { name: true })).toMatch(/U\+FFFD/);
    expect(textDefect('Cochim\u00C3\u00AD', { name: true })).toMatch(
      /mojibake/,
    );
    expect(textDefect('\u00e2\u20ac\u0153quoted', { name: true })).toMatch(
      /mojibake/,
    );
    expect(textDefect('M?ori', { name: true })).toMatch(/"\?"/);
    expect(textDefect('Na\u0300nh')).toMatch(/not NFC/);
    // Real names that look similar are fine.
    ['\u00C3wa', '?', 'Ziz', 'Tŝilhqot’in Nen', 'https://x.org/?a=b'].forEach(
      (value) => expect(textDefect(value, { name: true })).toBeNull(),
    );
    // Only names are checked for "?": URLs and descriptions may contain it.
    expect(textDefect('M?ori')).toBeNull();
  });

  it('rejects defective text in published payloads', () => {
    const payload = payloadFor({ NAME: 'Testland' }, { name: 'Town' });
    const withBorder = (properties: Record<string, unknown>) => ({
      ...payload,
      data: {
        ...payload.data,
        borders: {
          ...payload.data.borders,
          features: [{ ...payload.data.borders.features[0], properties }],
        },
      },
    });
    expect(() =>
      validatePayload(withBorder({ NAME: 'Testland', PARTOF: 'Arag\uFFFDn' })),
    ).toThrow(/PARTOF contains U\+FFFD/);
    expect(() =>
      validatePayload(withBorder({ NAME: 'Testland', SUBJECTO: 'M?ori' })),
    ).toThrow(/SUBJECTO has a character replaced/);
    const place = structuredClone(payload);
    place.places.features[0].properties.name = 'Na\u0300nh';
    expect(() => validatePayload(place)).toThrow(/place 0 name is not NFC/);
  });
});

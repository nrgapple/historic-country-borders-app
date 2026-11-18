import { describe, expect, it } from 'vitest';

const {
  ATLAS_COLORS,
  buildPayload,
} = require('../scripts/lib/historical-data');
const {
  ATLAS_WASH_COUNT,
  buildSplitAssets,
  buildSplitYear,
  isRfc7946Wound,
  placeKind,
  rewindGeometry,
  separateOverlordWashes,
  ringSignedArea,
  splitFileName,
  territoryBbox,
  validatePlaceClasses,
  validatePlaceClassesAgainstPayloads,
  validatePlaceClassesAgainstPlaces,
  validateSplitYear,
  washIndex,
} = require('../scripts/lib/historical-split');

type Position = [number, number];
type Ring = Position[];

const box = (west: number, south: number, east: number, north: number) =>
  [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ] as Ring;
const clockwise = (ring: Ring) => ring.slice().reverse();
const polygon = (...rings: Ring[]) => ({
  type: 'Polygon',
  coordinates: rings,
});
const border = (
  properties: Record<string, unknown>,
  geometry: unknown = polygon(box(0, 0, 1, 1)),
) => ({ type: 'Feature', properties, geometry });
const collection = (features: unknown[]) => ({
  type: 'FeatureCollection',
  features,
});
const place = (name: string, since: number, until?: number) => ({
  type: 'Feature',
  properties: {
    name,
    inhabitedSince: since,
    ...(until === undefined ? {} : { inhabitedUntil: until }),
  },
  geometry: { type: 'Point', coordinates: [0.5, 0.5] },
});
const classesFile = (places: unknown[]) => ({
  schemaVersion: 1,
  classes: { 'archaeological-site': 'Known chiefly through archaeology.' },
  places,
});
const site = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  class: 'archaeological-site',
  source: 'https://en.wikipedia.org/wiki/Example',
  note: 'Reviewed.',
  ...extra,
});
const noClasses = new Map();

/** Builds a combined payload with the production pipeline, then splits it. */
const split = (
  features: unknown[],
  places: unknown[] = [],
  classes = noClasses,
  year = 1914,
) =>
  buildSplitYear(
    year,
    buildPayload(year, collection(features), collection(places)),
    classes,
  );

describe('atlas wash index', () => {
  it('maps legacy color slot i to wash i % 12, as the approved mock does', () => {
    expect(ATLAS_WASH_COUNT).toBe(12);
    expect(washIndex(ATLAS_COLORS[0])).toBe(0);
    expect(washIndex(ATLAS_COLORS[11])).toBe(11);
    expect(washIndex(ATLAS_COLORS[12])).toBe(0);
    expect(washIndex(ATLAS_COLORS[29])).toBe(5);
    expect(washIndex(ATLAS_COLORS[13].toLowerCase())).toBe(1);
  });

  it('rejects a color outside the legacy palette', () => {
    expect(() => washIndex('#000000')).toThrow(/Unknown atlas color/);
  });
});

describe('RFC 7946 winding', () => {
  it('measures counter-clockwise rings as positive', () => {
    expect(ringSignedArea(box(0, 0, 2, 2))).toBe(8);
    expect(ringSignedArea(clockwise(box(0, 0, 2, 2)))).toBe(-8);
  });

  it('makes exteriors counter-clockwise and holes clockwise', () => {
    const wrong = polygon(clockwise(box(0, 0, 4, 4)), box(1, 1, 2, 2));
    expect(isRfc7946Wound(wrong)).toBe(false);
    const fixed = rewindGeometry(wrong);
    expect(isRfc7946Wound(fixed)).toBe(true);
    expect(fixed.coordinates[0]).toEqual(box(0, 0, 4, 4));
    expect(fixed.coordinates[1]).toEqual(clockwise(box(1, 1, 2, 2)));
  });

  it('rewinds every part of a MultiPolygon and keeps correct rings as they are', () => {
    const multi = {
      type: 'MultiPolygon',
      coordinates: [[box(0, 0, 1, 1)], [clockwise(box(5, 5, 6, 6))]],
    };
    const fixed = rewindGeometry(multi);
    expect(fixed.coordinates[0][0]).toBe(multi.coordinates[0][0]);
    expect(fixed.coordinates[1][0]).toEqual(box(5, 5, 6, 6));
    expect(isRfc7946Wound(fixed)).toBe(true);
  });

  it('leaves zero-area rings alone, since they have no orientation', () => {
    const sliver = [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 0],
    ] as Ring;
    expect(rewindGeometry(polygon(sliver)).coordinates[0]).toBe(sliver);
    expect(isRfc7946Wound(polygon(sliver))).toBe(true);
  });

  it('publishes rewound polygons without moving any position', () => {
    const { polygons } = split([
      border({ NAME: 'Testland' }, polygon(clockwise(box(0, 0, 1, 1)))),
    ]);
    expect(polygons.features[0].geometry.coordinates[0]).toEqual(
      box(0, 0, 1, 1),
    );
  });
});

describe('territory bbox', () => {
  it('rounds outward to two decimals', () => {
    expect(
      territoryBbox([polygon(box(10.123, -5.678, 20.001, 30.009))]),
    ).toEqual([10.12, -5.68, 20.01, 30.01]);
  });

  it('spans the antimeridian with west > east instead of the whole world', () => {
    const russia = {
      type: 'MultiPolygon',
      coordinates: [[box(20, 40, 180, 77)], [box(-180, 60, -170, 70)]],
    };
    expect(territoryBbox([russia])).toEqual([20, 40, -170, 77]);
  });

  it('keeps an ordinary box when the widest gap is at the antimeridian', () => {
    expect(
      territoryBbox([polygon(box(-10, 0, 0, 5)), polygon(box(5, 0, 10, 5))]),
    ).toEqual([-10, 0, 10, 5]);
  });
});

describe('split year files', () => {
  it('gives every feature of a territory the same dense id and shares nothing else', () => {
    const result = split([
      border({ NAME: 'Alpha' }, polygon(box(0, 0, 1, 1))),
      border({ NAME: 'Beta' }, polygon(box(2, 0, 3, 1))),
      border({ NAME: 'Alpha' }, polygon(box(5, 5, 9, 9))),
    ]);
    expect(result.polygons.features.map((f: { id: number }) => f.id)).toEqual([
      0, 1, 0,
    ]);
    expect(Object.keys(result.polygons.features[0].properties)).toEqual(['c']);
    expect(
      result.index.territories.map((t: { NAME: string }) => t.NAME),
    ).toEqual(['Alpha', 'Beta']);
    // Facts and the label point come from the feature with the largest polygon.
    expect(result.index.territories[0].label).toEqual(
      result.labels.features[2].geometry.coordinates,
    );
    expect(result.index.territories[0].bbox).toEqual([0, 0, 9, 9]);
    expect(result.counts).toMatchObject({
      territories: 2,
      polygons: 3,
      territoryLabels: 3,
    });
    expect(() => validateSplitYear(1914, result)).not.toThrow();
  });

  it('publishes label area in km² and the index facts trimmed, omitting blanks', () => {
    const result = split([
      border({
        NAME: 'Testland',
        PARTOF: ' Greater Testland ',
        SUBJECTO: '   ',
        BORDERPRECISION: 2,
        ABBREVN: 'Test',
      }),
    ]);
    const [label] = result.labels.features;
    expect(label).toMatchObject({ id: 0, properties: { n: 'Testland' } });
    expect(label.properties.a).toBeGreaterThan(12000);
    expect(label.properties.a).toBeLessThan(12500);
    expect(result.index.territories[0]).toEqual({
      id: 0,
      NAME: 'Testland',
      PARTOF: 'Greater Testland',
      BORDERPRECISION: 2,
      bbox: [0, 0, 1, 1],
      label: label.geometry.coordinates,
    });
  });

  describe('blank names', () => {
    it("names a blank-NAME border from the source's own ABBREVN and records it", () => {
      const result = split(
        [border({ NAME: '      ', ABBREVN: 'Cardial Ware culture' })],
        [],
        noClasses,
        -5000,
      );
      expect(result.index.territories[0]).toMatchObject({
        NAME: 'Cardial Ware culture',
        nameFrom: 'ABBREVN',
      });
      expect(result.labels.features[0].properties.n).toBe(
        'Cardial Ware culture',
      );
      expect(result.counts.namedFromAbbreviation).toBe(1);
    });

    it('merges an ABBREVN-named border into an existing territory of that name', () => {
      const result = split([
        border({ NAME: 'Netherlands' }, polygon(box(4, 51, 5, 53))),
        border(
          { NAME: '  ', ABBREVN: 'Netherlands' },
          polygon(box(6, 51, 7, 52)),
        ),
      ]);
      expect(result.index.territories).toHaveLength(1);
      expect(result.index.territories[0]).not.toHaveProperty('nameFrom');
    });

    it('keeps an unnamed border without an id, label, or index entry', () => {
      const result = split([
        border({ NAME: '', SUBJECTO: 'Bega' }),
        border({ NAME: 'Liechtenstein' }, polygon(box(9, 47, 10, 48))),
      ]);
      expect(result.polygons.features[0]).not.toHaveProperty('id');
      expect(result.polygons.features[0].properties).toEqual({
        c: expect.any(Number),
      });
      expect(result.labels.features).toHaveLength(1);
      expect(result.index.territories).toHaveLength(1);
      expect(result.counts.unnamedPolygons).toBe(1);
      expect(() => validateSplitYear(1914, result)).not.toThrow();
    });
  });

  describe('dependencies', () => {
    const empire = border(
      { NAME: 'United Kingdom', COLOR: '#3498DB' },
      polygon(box(-5, 50, 1, 58)),
    );

    it('links a territory whose SUBJECTO is another territory that year', () => {
      const result = split([
        border({ NAME: 'Gold Coast', SUBJECTO: 'United Kingdom' }),
        empire,
      ]);
      const overlord = result.index.territories[1];
      const ukWash = result.polygons.features[1].properties.c;
      expect(result.polygons.features[0].properties).toEqual({
        c: expect.any(Number),
        dep: 1,
        ov: overlord.id,
        oc: ukWash,
      });
      expect(result.index.territories[0]).toMatchObject({
        dep: 1,
        ov: overlord.id,
        oc: ukWash,
      });
      expect(result.polygons.features[1].properties).not.toHaveProperty('dep');
      expect(result.counts.dependencies).toBe(1);
      expect(() => validateSplitYear(1914, result)).not.toThrow();
    });

    it('falls back to PARTOF when SUBJECTO is the territory itself or absent', () => {
      const result = split([
        border({
          NAME: 'Wales',
          SUBJECTO: 'Wales',
          PARTOF: 'United Kingdom',
        }),
        empire,
      ]);
      expect(result.index.territories[0]).toMatchObject({ dep: 1, ov: 1 });
    });

    it('falls back to PARTOF when SUBJECTO names no territory that year', () => {
      const result = split([
        border({
          NAME: 'Malta',
          SUBJECTO: 'Britain',
          PARTOF: 'United Kingdom',
        }),
        empire,
      ]);
      expect(result.index.territories[0]).toMatchObject({ dep: 1, ov: 1 });
    });

    it('leaves dep unset when the overlord is not a feature that year', () => {
      const result = split([
        border({ NAME: 'Russian Empire', SUBJECTO: 'Russia' }),
      ]);
      expect(result.index.territories[0]).not.toHaveProperty('dep');
      expect(result.polygons.features[0].properties).not.toHaveProperty('ov');
      expect(result.counts.dependencies).toBe(0);
    });

    it('rejects a dependency that disagrees between polygons and index', () => {
      const result = split([
        border({ NAME: 'Gold Coast', SUBJECTO: 'United Kingdom' }),
        empire,
      ]);
      result.polygons.features[0].properties.ov = 0;
      expect(() => validateSplitYear(1914, result)).toThrow(/dependency/);
    });
  });

  describe('overlord aliases', () => {
    const ukName = 'United Kingdom of Great Britain and Ireland';
    const uk = border({ NAME: ukName }, polygon(box(-5, 50, 1, 58)));
    const raj = border(
      { NAME: 'British Raj', SUBJECTO: 'United Kingdom' },
      polygon(box(70, 10, 80, 30)),
    );
    const aliases = new Map([['United Kingdom', ukName]]);
    const build = (features: unknown[], yearAliases = aliases) =>
      buildSplitYear(
        1914,
        buildPayload(1914, collection(features), collection([])),
        noClasses,
        yearAliases,
      );

    it('links a dependency through a reviewed alias and keeps the source SUBJECTO', () => {
      const result = build([raj, uk]);
      expect(result.index.territories[0]).toMatchObject({
        NAME: 'British Raj',
        SUBJECTO: 'United Kingdom',
        dep: 1,
        ov: 1,
      });
      expect(result.counts.dependencies).toBe(1);
      expect(() => validateSplitYear(1914, result, aliases)).not.toThrow();
      expect(() => validateSplitYear(1914, result)).toThrow(
        /outside SUBJECTO, PARTOF and aliases/,
      );
      expect(build([raj, uk], new Map()).counts.dependencies).toBe(0);
    });

    it('rejects an alias that shadows a territory, misses its target, or is unused', () => {
      const shortUk = border(
        { NAME: 'United Kingdom' },
        polygon(box(-5, 50, 1, 58)),
      );
      expect(() => build([raj, uk, shortUk])).toThrow(
        /names a territory of that year/,
      );
      expect(() => build([raj])).toThrow(/is not a territory of that year/);
      expect(() => build([uk])).toThrow(/resolves no dependency/);
      // PARTOF already names the overlord, so the alias changes nothing.
      const direct = border(
        { NAME: 'Hong Kong', SUBJECTO: 'United Kingdom', PARTOF: ukName },
        polygon(box(114, 22, 115, 23)),
      );
      expect(() => build([direct, uk])).toThrow(/resolves no dependency/);
    });
  });

  describe('overlord washes', () => {
    const ukName = 'United Kingdom of Great Britain and Ireland';
    const colony = (name: string, overlord: string, x: number) =>
      border(
        { NAME: name, SUBJECTO: overlord },
        polygon(box(x, -10, x + 1, -9)),
      );
    const year = () =>
      split([
        border({ NAME: ukName }, polygon(box(-5, 50, 1, 58))),
        border({ NAME: 'France' }, polygon(box(-4, 43, 7, 50))),
        border({ NAME: 'France' }, polygon(box(55, -21, 56, -20))),
        colony('Gold Coast', ukName, 0),
        colony('Nigeria', ukName, 2),
        colony('Senegal', 'France', 4),
      ]);
    const wash = (result: any, name: string) =>
      result.index.territories.find((t: any) => t.NAME === name);

    it('starts from the shared legacy wash of the United Kingdom and France', () => {
      const payload = buildPayload(
        1914,
        collection([border({ NAME: ukName }), border({ NAME: 'France' })]),
        collection([]),
      );
      const [uk, france] = payload.data.borders.features.map((f: any) =>
        washIndex(f.properties.COLOR),
      );
      expect(uk).toBe(france);
    });

    it('keeps the overlord with most dependencies and moves the other', () => {
      const result = year();
      const ukWash = result.polygons.features[0].properties.c;
      const franceWash = result.polygons.features[1].properties.c;
      expect(franceWash).toBe((ukWash + 1) % ATLAS_WASH_COUNT);
      // Every polygon of a re-washed overlord takes the new wash.
      expect(result.polygons.features[2].properties.c).toBe(franceWash);
      expect(wash(result, 'Gold Coast').oc).toBe(ukWash);
      expect(wash(result, 'Senegal').oc).toBe(franceWash);
      expect(result.counts.rewashedOverlords).toBe(1);
      expect(() => validateSplitYear(1914, result)).not.toThrow();
    });

    it('rejects two overlords sharing a wash', () => {
      const result = year();
      const ukWash = result.polygons.features[0].properties.c;
      [1, 2].forEach((index) => {
        result.polygons.features[index].properties.c = ukWash;
      });
      result.polygons.features[5].properties.oc = ukWash;
      wash(result, 'Senegal').oc = ukWash;
      expect(() => validateSplitYear(1914, result)).toThrow(
        /two overlords sharing a wash/,
      );
    });

    it('moves only displaced overlords, to washes no overlord holds', () => {
      const overlord = (name: string, c: number, area: number) => ({
        name,
        c,
        largest: area,
      });
      const a = overlord('A', 1, 0);
      const b = overlord('B', 1, 1);
      const c = overlord('C', 2, 2);
      const labels = [30, 20, 10].map((AREA) => ({ properties: { AREA } }));
      const dependents = [...Array(3).fill(a), ...Array(2).fill(b), c].map(
        (target) => ({ overlord: target }),
      );
      expect(separateOverlordWashes([a, b, c, ...dependents], labels)).toBe(1);
      expect([a.c, b.c, c.c]).toEqual([1, 3, 2]);
    });
  });

  describe('archaeological sites', () => {
    const classes = validatePlaceClasses(
      classesFile([site('Göbekli Tepe'), site('Kaneš', { from: 500 })]),
    );

    it('marks classified places as sites and everything else as cities', () => {
      const result = split(
        [border({ NAME: 'Testland' })],
        [
          place('Göbekli Tepe', -9600),
          place('Kaneš', -2254),
          place('Rome', -753),
        ],
        classes,
        1492,
      );
      expect(
        result.labels.features
          .filter((f: { properties: { p?: string } }) => f.properties.p)
          .map((f: { properties: { p: string; k: string } }) => [
            f.properties.p,
            f.properties.k,
          ]),
      ).toEqual([
        ['Göbekli Tepe', 'site'],
        ['Kaneš', 'site'],
        ['Rome', 'city'],
      ]);
      expect(result.counts.sites).toBe(2);
    });

    it('applies `from` by map year', () => {
      const kanes = classes.get('Kaneš');
      expect(placeKind(kanes, 400)).toBe('city');
      expect(placeKind(kanes, 500)).toBe('site');
      expect(placeKind(classes.get('Göbekli Tepe'), -9600)).toBe('site');
      expect(placeKind(undefined, 2000)).toBe('city');
    });

    it('rejects an invalid classification file', () => {
      expect(() => validatePlaceClasses({ schemaVersion: 2 })).toThrow(
        /schema/,
      );
      expect(() =>
        validatePlaceClasses(classesFile([site('A'), site('A')])),
      ).toThrow(/duplicates/);
      expect(() =>
        validatePlaceClasses(classesFile([site('A', { source: 'http://x' })])),
      ).toThrow(/https/);
      expect(() =>
        validatePlaceClasses(classesFile([site('A', { class: 'ruin' })])),
      ).toThrow(/unknown class/);
      expect(() =>
        validatePlaceClasses(classesFile([site('A', { note: ' ' })])),
      ).toThrow(/review note/);
      expect(() =>
        validatePlaceClasses(classesFile([site('A', { from: 1.5 })])),
      ).toThrow(/non-integer/);
      expect(() => validatePlaceClasses(classesFile([site(' A')]))).toThrow(
        /untrimmed/,
      );
    });

    it('requires exactly one dated upstream place and a meaningful `from` on refresh', () => {
      const upstream = collection([
        place('Kaneš', -2254),
        place('Ur', -5000, -500),
        place('Twin', 0),
        place('Twin', 10),
        { ...place('Undated', 0), properties: { name: 'Undated' } },
      ]);
      const check = (entry: unknown) =>
        validatePlaceClassesAgainstPlaces(upstream, classesFile([entry]));
      expect(() => check(site('Kaneš', { from: 500 }))).not.toThrow();
      expect(() => check(site('Missing'))).toThrow(/matches 0 dated places/);
      expect(() => check(site('Twin'))).toThrow(/matches 2 dated places/);
      expect(() => check(site('Undated'))).toThrow(/matches 0/);
      expect(() => check(site('Kaneš', { from: -2254 }))).toThrow(/omit it/);
      expect(() => check(site('Ur', { from: 0 }))).toThrow(
        /after inhabitedUntil/,
      );
    });

    it('requires every entry to be published, unambiguous, and effective offline', () => {
      const payload = (places: unknown[]) =>
        buildPayload(100, collection([]), collection(places));
      const byName = (entry: unknown) =>
        validatePlaceClasses(classesFile([entry]));
      const years = (places: unknown[]) => new Map([[100, payload(places)]]);
      expect(() =>
        validatePlaceClassesAgainstPayloads(
          years([place('Kaneš', -2254)]),
          byName(site('Kaneš')),
        ),
      ).not.toThrow();
      expect(() =>
        validatePlaceClassesAgainstPayloads(years([]), byName(site('Kaneš'))),
      ).toThrow(/no published place/);
      expect(() =>
        validatePlaceClassesAgainstPayloads(
          years([place('Kaneš', -2254), place('Kaneš', -2000)]),
          byName(site('Kaneš')),
        ),
      ).toThrow(/ambiguous/);
      expect(() =>
        validatePlaceClassesAgainstPayloads(
          years([place('Kaneš', -2254)]),
          byName(site('Kaneš', { from: 500 })),
        ),
      ).toThrow(/never applies/);
    });
  });

  describe('validation', () => {
    const valid = () =>
      split(
        [
          border({ NAME: 'Testland' }),
          border({ NAME: 'Other' }, polygon(box(3, 3, 4, 4))),
        ],
        [place('Town', 0)],
      );

    it('accepts a freshly built year', () => {
      expect(() => validateSplitYear(1914, valid())).not.toThrow();
    });

    it.each([
      [
        'clockwise exteriors',
        (year: ReturnType<typeof valid>) => {
          year.polygons.features[0].geometry.coordinates[0].reverse();
        },
        /RFC 7946/,
      ],
      [
        'extra polygon properties',
        (year: ReturnType<typeof valid>) => {
          year.polygons.features[0].properties.NAME = 'Testland';
        },
        /unexpected properties/,
      ],
      [
        'wash indexes out of range',
        (year: ReturnType<typeof valid>) => {
          year.polygons.features[0].properties.c = 12;
        },
        /invalid c/,
      ],
      [
        'unknown ids',
        (year: ReturnType<typeof valid>) => {
          year.polygons.features[0].id = 9;
        },
        /unknown id/,
      ],
      [
        'blank index names',
        (year: ReturnType<typeof valid>) => {
          year.index.territories[0].NAME = '   ';
        },
        /blank or untrimmed/,
      ],
      [
        'labels that disagree with the index',
        (year: ReturnType<typeof valid>) => {
          year.labels.features[0].properties.n = 'Elsewhere';
        },
        /differs from the index/,
      ],
      [
        'blank place names',
        (year: ReturnType<typeof valid>) => {
          year.labels.features[2].properties.p = ' ';
        },
        /blank place name/,
      ],
      [
        'unknown place kinds',
        (year: ReturnType<typeof valid>) => {
          year.labels.features[2].properties.k = 'ruin';
        },
        /unknown kind/,
      ],
      [
        'label points outside the bbox',
        (year: ReturnType<typeof valid>) => {
          year.index.territories[0].label = [50, 50];
        },
        /outside its bbox/,
      ],
      [
        'territories without polygons',
        (year: ReturnType<typeof valid>) => {
          year.polygons.features.pop();
        },
        /without polygons/,
      ],
      [
        'a wrong year',
        (year: ReturnType<typeof valid>) => {
          year.index.year = 1920;
        },
        /wrong schema or year/,
      ],
    ])('rejects %s', (_, mutate, message) => {
      const year = valid();
      mutate(year);
      expect(() => validateSplitYear(1914, year)).toThrow(message);
    });
  });
});

describe('split assets', () => {
  const placeClassesText = JSON.stringify(classesFile([site('Town')]));
  const assets = {
    '-500': { url: '/data/historical/bc500.x.json' },
    '1914': { url: '/data/historical/1914.y.json' },
  };
  const payloads: Record<string, unknown> = {
    '/data/historical/bc500.x.json': buildPayload(
      -500,
      collection([border({ NAME: 'Testland' })]),
      collection([place('Town', -1000)]),
    ),
    '/data/historical/1914.y.json': buildPayload(
      1914,
      collection([border({ NAME: 'Other' })]),
      collection([place('Town', -1000)]),
    ),
  };
  const build = () =>
    buildSplitAssets({
      assets,
      placeClassesText,
      readPayload: (asset: { url: string }) => ({
        payload: payloads[asset.url],
        sha256: 'a'.repeat(64),
      }),
    });

  it('content-hashes three files per year and records them in a manifest', () => {
    const { files, manifest } = build();
    expect(files.map((file: { name: string }) => file.name)).toEqual([
      expect.stringMatching(/^bc500\.polygons\.[a-f0-9]{16}\.json$/),
      expect.stringMatching(/^bc500\.labels\.[a-f0-9]{16}\.json$/),
      expect.stringMatching(/^bc500\.index\.[a-f0-9]{16}\.json$/),
      expect.stringMatching(/^1914\.polygons\./),
      expect.stringMatching(/^1914\.labels\./),
      expect.stringMatching(/^1914\.index\./),
    ]);
    files.forEach(({ name, json }: { name: string; json: string }) => {
      const [year, kind] = name.split('.');
      expect(name).toBe(
        splitFileName(year === 'bc500' ? -500 : 1914, kind, json),
      );
    });
    expect(manifest.years['-500'].polygons).toEqual({
      url: `/data/historical/${files[0].name}`,
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      bytes: Buffer.byteLength(files[0].json),
    });
    expect(manifest.years['-500'].source).toEqual({
      url: '/data/historical/bc500.x.json',
      sha256: 'a'.repeat(64),
    });
    expect(manifest.inputs.placeClasses.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.inputs).not.toHaveProperty('nameOverrides');
    expect(manifest.years['1914'].counts.sites).toBe(1);
  });

  it('records the name-override input and rejects aliases for unpublished years', () => {
    const overridesFile = (years: number[]) =>
      JSON.stringify({
        schemaVersion: 1,
        borders: [],
        places: [],
        overlordAliases: [
          {
            years,
            from: 'Elsewhere',
            to: 'Other',
            source: 'https://en.wikipedia.org/wiki/Example',
            note: 'Reviewed.',
          },
        ],
      });
    const withOverrides = (text: string) =>
      buildSplitAssets({
        assets,
        placeClassesText,
        nameOverridesText: text,
        readPayload: (asset: { url: string }) => ({
          payload: payloads[asset.url],
          sha256: 'a'.repeat(64),
        }),
      });
    expect(() => withOverrides(overridesFile([1492]))).toThrow(
      /unpublished year 1492/,
    );
    // An alias in a published year must resolve a dependency.
    expect(() => withOverrides(overridesFile([1914]))).toThrow(
      /is not a territory|resolves no dependency/,
    );
    const empty = JSON.stringify({
      schemaVersion: 1,
      borders: [],
      places: [],
      overlordAliases: [],
    });
    expect(withOverrides(empty).manifest.inputs.nameOverrides).toEqual({
      file: 'data/historical-name-overrides.json',
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it('is deterministic, so validation can rebuild it byte for byte', () => {
    expect(build().manifestJson).toBe(build().manifestJson);
    expect(build().files).toEqual(build().files);
  });
});

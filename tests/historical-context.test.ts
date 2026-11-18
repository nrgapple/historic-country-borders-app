import { describe, expect, it } from 'vitest';

const {
  appYearToAstronomical,
  astronomicalToAppYear,
  claimWindow,
  decide,
  evaluateCandidate,
  lifespan,
  officeHolderClaims,
  parseWikidataTime,
  selectClaims,
  trimEntity,
  untimedCapitalPlausible,
} = require('../scripts/lib/wikidata');
const {
  buildContextFiles,
  computeChanges,
  contextFileName,
  entityFacts,
  peopleIndex,
  summarizeYear,
  validateContextManifest,
  validateMapping,
  validateSnapshot,
  validateYearContext,
} = require('../scripts/lib/historical-context');

const time = (value: string, precision = 9) => ({
  time: value,
  precision,
  timezone: 0,
  before: 0,
  after: 0,
  calendarmodel: 'http://www.wikidata.org/entity/Q1985727',
});

const timeSnak = (property: string, value: string, precision = 9) => ({
  snaktype: 'value',
  property,
  datavalue: { type: 'time', value: time(value, precision) },
});

const itemSnak = (property: string, id: string) => ({
  snaktype: 'value',
  property,
  datavalue: { type: 'wikibase-entityid', value: { id } },
});

interface ClaimOptions {
  rank?: string;
  start?: string | null;
  end?: string | null;
  startPrecision?: number;
  endPrecision?: number;
  endSnak?: Record<string, unknown>;
}

const itemClaim = (
  property: string,
  id: string,
  {
    rank = 'normal',
    start,
    end,
    startPrecision = 9,
    endPrecision = 9,
    endSnak,
  }: ClaimOptions = {},
) => {
  const qualifiers: Record<string, unknown[]> = {};
  if (start) qualifiers.P580 = [timeSnak('P580', start, startPrecision)];
  if (end) qualifiers.P582 = [timeSnak('P582', end, endPrecision)];
  if (endSnak) qualifiers.P582 = [endSnak];
  return {
    rank,
    mainsnak: itemSnak(property, id),
    ...(Object.keys(qualifiers).length ? { qualifiers } : {}),
  };
};

const dateClaim = (
  property: string,
  value: string,
  rank = 'normal',
  precision = 9,
) => ({ rank, mainsnak: timeSnak(property, value, precision) });

// Trimmed to the shape the pipeline stores, after the real Ottoman Empire item.
const ottoman = {
  id: 'Q12560',
  lastrevid: 2569206612,
  retrievedAt: '2026-11-17T00:00:00.000Z',
  labels: { en: { language: 'en', value: 'Ottoman Empire' } },
  aliases: { en: [{ language: 'en', value: 'Turkish Empire' }] },
  sitelinks: { enwiki: { title: 'Ottoman Empire' } },
  claims: {
    P31: [itemClaim('P31', 'Q48349')],
    P571: [
      dateClaim('P571', '+1302-07-27T00:00:00Z', 'deprecated', 11),
      dateClaim('P571', '+1299-07-29T00:00:00Z', 'preferred', 11),
      dateClaim('P571', '+1300-00-00T00:00:00Z'),
    ],
    P576: [dateClaim('P576', '+1922-11-17T00:00:00Z', 'normal', 11)],
    P36: [
      itemClaim('P36', 'Q40738', {
        start: '+1329-00-00T00:00:00Z',
        end: '+1365-00-00T00:00:00Z',
      }),
      itemClaim('P36', 'Q43387', {
        start: '+1365-00-00T00:00:00Z',
        end: '+1453-00-00T00:00:00Z',
      }),
      itemClaim('P36', 'Q16869', {
        start: '+1453-00-00T00:00:00Z',
        end: '+1922-00-00T00:00:00Z',
      }),
      itemClaim('P36', 'Q406'),
    ],
    P35: [
      itemClaim('P35', 'Q194300', {
        start: '+1481-00-00T00:00:00Z',
        end: '+1512-00-00T00:00:00Z',
      }),
      itemClaim('P35', 'Q999', {
        rank: 'deprecated',
        start: '+1480-00-00T00:00:00Z',
        end: '+1500-00-00T00:00:00Z',
      }),
    ],
  },
};

const referenced = {
  Q40738: { label: 'Bursa' },
  Q43387: { label: 'Edirne' },
  Q16869: { label: 'Constantinople' },
  Q406: { label: 'Istanbul' },
  Q194300: { label: 'Bayezid II', died: time('+1512-05-26T00:00:00Z', 11) },
  Q999: { label: 'Deprecated ruler' },
};
const people = peopleIndex(referenced);

describe('Wikidata time translation', () => {
  it('passes JSON historical years through unchanged, including BC', () => {
    expect(parseWikidataTime(time('+1492-10-12T00:00:00Z', 11))).toMatchObject({
      year: 1492,
      earliest: 1492,
      latest: 1492,
      approximate: false,
    });
    // Wikibase JSON: -0044 is 44 BC and -0001 is 1 BC, as in the app.
    expect(parseWikidataTime(time('-0044-03-15T00:00:00Z', 11))?.year).toBe(
      -44,
    );
    expect(parseWikidataTime(time('-0001-00-00T00:00:00Z'))?.year).toBe(-1);
  });

  it('rejects year 0, malformed values, and precision coarser than a millennium', () => {
    expect(parseWikidataTime(time('+0000-00-00T00:00:00Z'))).toBeNull();
    expect(parseWikidataTime(time('1492-01-01', 11))).toBeNull();
    expect(parseWikidataTime(time('-13798000000-00-00T00:00:00Z', 3))).toBe(
      null,
    );
    expect(parseWikidataTime({ time: '+1492-00-00T00:00:00Z' })).toBeNull();
    expect(parseWikidataTime(undefined)).toBeNull();
  });

  it('widens coarse precision to every reasonable reading', () => {
    expect(parseWikidataTime(time('+1290-00-00T00:00:00Z', 8))).toMatchObject({
      earliest: 1290,
      latest: 1299,
      approximate: true,
    });
    // "1300, century precision" may mean the 13th century or the 1300s.
    expect(parseWikidataTime(time('+1300-00-00T00:00:00Z', 7))).toMatchObject({
      earliest: 1201,
      latest: 1399,
    });
    expect(parseWikidataTime(time('-0500-00-00T00:00:00Z', 7))).toMatchObject({
      year: -500,
      earliest: -599,
      latest: -401,
    });
    expect(parseWikidataTime(time('-3000-00-00T00:00:00Z', 6))).toMatchObject({
      earliest: -3999,
      latest: -2001,
    });
  });

  it('converts astronomical (SPARQL/RDF) years without a year 0', () => {
    expect(astronomicalToAppYear(0)).toBe(-1);
    expect(astronomicalToAppYear(-43)).toBe(-44);
    expect(astronomicalToAppYear(1)).toBe(1);
    expect(appYearToAstronomical(-1)).toBe(0);
    expect(appYearToAstronomical(-44)).toBe(-43);
    expect(() => appYearToAstronomical(0)).toThrow();
  });
});

describe('claim selection', () => {
  it('reads qualifiers and marks unknown or repeated bounds uncertain', () => {
    expect(claimWindow(itemClaim('P35', 'Q1'))).toMatchObject({
      timed: false,
      uncertain: false,
    });
    expect(
      claimWindow(
        itemClaim('P35', 'Q1', {
          start: '+1900-00-00T00:00:00Z',
          endSnak: { snaktype: 'somevalue', property: 'P582' },
        }),
      ).uncertain,
    ).toBe(true);
    const open = claimWindow(
      itemClaim('P35', 'Q1', {
        start: '+1900-00-00T00:00:00Z',
        endSnak: { snaktype: 'novalue', property: 'P582' },
      }),
    );
    expect(open).toMatchObject({ timed: true, uncertain: false, end: null });
  });

  it('chooses the capital valid in the year and ignores the untimed one', () => {
    const at = (year: number) =>
      selectClaims(ottoman, 'P36', year, { allowUntimed: true }).map(
        (claim: { id: string }) => claim.id,
      );
    expect(at(1400)).toEqual(['Q43387']);
    expect(at(1492)).toEqual(['Q16869']);
    // Both capitals were valid during the 1453 transition year.
    expect(at(1453)).toEqual(['Q43387', 'Q16869']);
  });

  it('falls back to a single untimed capital only when nothing timed applies', () => {
    const entity = {
      claims: {
        P36: [
          itemClaim('P36', 'Q90'),
          itemClaim('P36', 'Q2', {
            start: '+1940-00-00T00:00:00Z',
            end: '+1944-00-00T00:00:00Z',
          }),
        ],
      },
    };
    const ids = (year: number) =>
      selectClaims(entity, 'P36', year, { allowUntimed: true }).map(
        (claim: { id: string }) => claim.id,
      );
    expect(ids(1914)).toEqual(['Q90']);
    expect(ids(1942)).toEqual(['Q2']);
    expect(selectClaims(entity, 'P36', 1914)).toEqual([]);

    const twoUntimed = {
      claims: { P36: [itemClaim('P36', 'Q90'), itemClaim('P36', 'Q91')] },
    };
    expect(
      selectClaims(twoUntimed, 'P36', 1914, { allowUntimed: true }),
    ).toEqual([]);
    const preferred = {
      claims: {
        P36: [
          itemClaim('P36', 'Q90'),
          itemClaim('P36', 'Q91', { rank: 'preferred' }),
        ],
      },
    };
    expect(
      selectClaims(preferred, 'P36', 1914, { allowUntimed: true })[0].id,
    ).toBe('Q91');
  });

  it('drops deprecated claims and prefers preferred among valid ones', () => {
    expect(
      selectClaims(ottoman, 'P35', 1492, { people }).map(
        (claim: { id: string }) => claim.id,
      ),
    ).toEqual(['Q194300']);
    const entity = {
      claims: {
        P35: [
          itemClaim('P35', 'Q1', {
            start: '+1900-00-00T00:00:00Z',
            end: '+1920-00-00T00:00:00Z',
          }),
          itemClaim('P35', 'Q2', {
            rank: 'preferred',
            start: '+1910-00-00T00:00:00Z',
            end: '+1915-00-00T00:00:00Z',
          }),
          // Preferred but not valid in 1905, so it must not hide Q1.
          itemClaim('P35', 'Q3', {
            rank: 'preferred',
            start: '+2000-00-00T00:00:00Z',
          }),
        ],
      },
    };
    const ids = (year: number) =>
      selectClaims(entity, 'P35', year, { people: {} }).map(
        (claim: { id: string }) => claim.id,
      );
    expect(ids(1912)).toEqual(['Q2']);
    expect(ids(1905)).toEqual(['Q1']);
  });

  it('requires definite containment when a bound is coarse', () => {
    const entity = {
      claims: {
        P35: [
          itemClaim('P35', 'Q1', {
            start: '+1300-00-00T00:00:00Z',
            startPrecision: 7,
            end: '+1450-00-00T00:00:00Z',
          }),
        ],
      },
    };
    const valid = (year: number) =>
      selectClaims(entity, 'P35', year, { people: {} }).length > 0;
    expect(valid(1300)).toBe(false);
    expect(valid(1399)).toBe(true);
    expect(valid(1451)).toBe(false);
  });

  it('ends open terms at death or after sixty years and requires a start for people', () => {
    const entity = {
      claims: {
        P35: [
          itemClaim('P35', 'Q1', { start: '+1900-00-00T00:00:00Z' }),
          itemClaim('P35', 'Q2', { start: '+1700-00-00T00:00:00Z' }),
          itemClaim('P35', 'Q3', { end: '+1950-00-00T00:00:00Z' }),
        ],
      },
    };
    const dead = peopleIndex({
      Q1: { label: 'One', died: time('+1910-00-00T00:00:00Z') },
    });
    const ids = (year: number) =>
      selectClaims(entity, 'P35', year, { people: dead }).map(
        (claim: { id: string }) => claim.id,
      );
    expect(ids(1905)).toEqual(['Q1']);
    expect(ids(1914)).toEqual([]);
    expect(ids(1750)).toEqual(['Q2']);
    expect(ids(1800)).toEqual([]);
  });

  it('trusts an undated capital only where it plausibly applied', () => {
    const hungary = { id: 'Q28', claims: {} };
    const openSpan = { start: { year: 1000, earliest: 1000 }, end: null };
    const budapest = {
      claims: {
        P571: [dateClaim('P571', '+1873-11-17T00:00:00Z', 'normal', 11)],
      },
    };
    expect(untimedCapitalPlausible(hungary, openSpan, budapest, 1200)).toBe(
      false,
    );
    expect(untimedCapitalPlausible(hungary, openSpan, budapest, 1880)).toBe(
      true,
    );
    // Open-ended states: only from 1800, even with no founding date.
    expect(untimedCapitalPlausible(hungary, openSpan, {}, 1700)).toBe(false);
    expect(untimedCapitalPlausible(hungary, openSpan, undefined, 1914)).toBe(
      true,
    );
    // Bounded historical polities keep their undated capital.
    const bounded = {
      start: { year: -814 },
      end: { year: -146, latest: -146 },
    };
    expect(untimedCapitalPlausible({ id: 'Q1' }, bounded, {}, -300)).toBe(true);
    // The capital's own dated "capital of" statement must cover the year.
    const rabat = {
      claims: {
        P1376: [
          itemClaim('P1376', 'Q1028', { start: '+1912-00-00T00:00:00Z' }),
          itemClaim('P1376', 'Q999', { start: '+1800-00-00T00:00:00Z' }),
        ],
      },
    };
    const morocco = { id: 'Q1028', claims: {} };
    expect(untimedCapitalPlausible(morocco, openSpan, rabat, 1900)).toBe(false);
    expect(untimedCapitalPlausible(morocco, openSpan, rabat, 1914)).toBe(true);
  });

  it('uses best-rank inception and dissolution for the lifespan', () => {
    const span = lifespan(ottoman);
    expect(span.start).toMatchObject({ year: 1299, approximate: false });
    expect(span.end).toMatchObject({ year: 1922 });
    const disputed = lifespan({
      claims: {
        P571: [
          dateClaim('P571', '-0753-00-00T00:00:00Z'),
          dateClaim('P571', '-0750-00-00T00:00:00Z'),
        ],
      },
    });
    expect(disputed.start).toMatchObject({
      year: -753,
      earliest: -753,
      latest: -750,
      approximate: true,
    });
    expect(disputed.end).toBeNull();
  });
});

describe('reconciliation decisions', () => {
  const classes = {
    Q48349: { claims: { P279: [itemClaim('P279', 'Q7275')] } },
    Q41710: { claims: {} },
    Q5: { claims: {} },
  };
  const appearance = { first: 1400, last: 1914 };

  it('accepts a dated polity with an exact name', () => {
    const result = evaluateCandidate(
      ottoman,
      'Ottoman Empire',
      appearance,
      classes,
      'title',
    );
    expect(result).toMatchObject({ pass: true, dated: true, strongName: true });
    expect(result.evidence).toContain('type: empire, state');
  });

  it('rejects non-polities, partial names, and incompatible dates', () => {
    const person = {
      id: 'Q1',
      labels: { en: { value: 'Ottoman Empire' } },
      claims: { P31: [itemClaim('P31', 'Q5')] },
    };
    expect(
      evaluateCandidate(person, 'Ottoman Empire', appearance, classes, null)
        .reasons,
    ).toContain('not an instance of a state, polity, or historical country');

    const people = {
      ...ottoman,
      id: 'Q2',
      claims: {
        P31: [itemClaim('P31', 'Q48349'), itemClaim('P31', 'Q41710')],
      },
    };
    expect(
      evaluateCandidate(people, 'Ottoman Empire', appearance, classes, null)
        .reasons,
    ).toContain('instance of ethnic group');

    expect(
      evaluateCandidate(ottoman, 'Ottoman', appearance, classes, null).reasons,
    ).toContain('name is only a partial match');

    const late = evaluateCandidate(
      ottoman,
      'Ottoman Empire',
      { first: 1000, last: 1200, years: [1000, 1100, 1200] },
      classes,
      null,
    );
    expect(late.pass).toBe(false);
    expect(late.reasons[0]).toMatch(/lifespan 1299–1922 does not overlap/);

    // A long-lived name may overlap a successor state for only part of its
    // span; publication limits facts to the entity's lifespan.
    const partial = evaluateCandidate(
      ottoman,
      'Ottoman Empire',
      { first: 1000, last: 1914, years: [1000, 1200, 1492, 1914] },
      classes,
      null,
    );
    expect(partial.pass).toBe(true);
    expect(partial.evidence).toContain(
      'lifespan 1299–1922 overlaps 2 of 4 map years',
    );
  });

  it('is conservative when several or undated candidates pass', () => {
    const pass = (qid: string, extra = {}) => ({
      qid,
      label: qid,
      pass: true,
      dated: true,
      strongName: false,
      evidence: [],
      ...extra,
    });
    expect(decide([pass('Q1')])).toMatchObject({
      status: 'matched',
      qid: 'Q1',
    });
    expect(decide([pass('Q1', { dated: false })]).status).toBe('ambiguous');
    expect(
      decide([pass('Q1', { dated: false, strongName: true })]).status,
    ).toBe('matched');
    expect(decide([pass('Q1'), pass('Q2')])).toMatchObject({
      status: 'ambiguous',
      candidates: [{ qid: 'Q1' }, { qid: 'Q2' }],
    });
    expect(
      decide([pass('Q1'), pass('Q2', { strongName: true })]),
    ).toMatchObject({ status: 'matched', qid: 'Q2' });
    expect(decide([{ ...pass('Q1'), pass: false }]).status).toBe('none');
  });

  it('trims entity JSON to the properties the pipeline reads', () => {
    const trimmed = trimEntity({
      ...ottoman,
      labels: { en: { value: 'Ottoman Empire' }, fr: { value: 'Empire' } },
      claims: { ...ottoman.claims, P18: [itemClaim('P18', 'Q1')] },
    });
    expect(Object.keys(trimmed.labels)).toEqual(['en']);
    expect(trimmed.claims.P18).toBeUndefined();
    expect(trimmed.claims.P36).toHaveLength(4);
  });
});

const square = (x: number, size = 1) => ({
  type: 'Polygon',
  coordinates: [
    [
      [x, 0],
      [x + size, 0],
      [x + size, size],
      [x, size],
      [x, 0],
    ],
  ],
});

const payload = (
  features: Array<{ name: string; size?: number; subjectTo?: string }>,
) => ({
  data: {
    borders: {
      type: 'FeatureCollection',
      features: features.map(({ name, size = 1, subjectTo }, index) => ({
        type: 'Feature',
        geometry: square(index * 3, size),
        properties: {
          NAME: name,
          ...(subjectTo ? { SUBJECTO: subjectTo } : {}),
        },
      })),
    },
    labels: { type: 'FeatureCollection', features: [] },
  },
  places: { type: 'FeatureCollection', features: [] },
});

describe('changes between published years', () => {
  it('lists appeared, disappeared, and re-ruled names by area', () => {
    const before = summarizeYear(
      payload([
        { name: 'Russian Empire', size: 2 },
        { name: 'Poland', subjectTo: 'Russian Empire' },
        { name: 'Saharan Pastoral Nomads' },
        { name: 'Finland', subjectTo: 'Russian Empire' },
      ]),
    );
    const after = summarizeYear(
      payload([
        { name: 'USSR', size: 2 },
        { name: 'Poland' },
        { name: 'Estonia' },
        { name: 'Saharan pastoral nomads' },
        { name: 'Finland', subjectTo: 'Sweden' },
      ]),
    );
    expect(computeChanges(1914, before, after)).toEqual({
      previousYear: 1914,
      appeared: ['USSR', 'Estonia'],
      disappeared: ['Russian Empire'],
      changed: [
        {
          name: 'Finland',
          field: 'subjectTo',
          from: 'Russian Empire',
          to: 'Sweden',
        },
        {
          name: 'Poland',
          field: 'subjectTo',
          from: 'Russian Empire',
          to: null,
        },
      ],
    });
  });
});

describe('renamed territories', () => {
  it('compares names by reconciled QID when one is known', () => {
    const before = summarizeYear(
      payload([{ name: 'United States of America' }]),
    );
    const after = summarizeYear(payload([{ name: 'United States' }]));
    const keyOf = (name: string) =>
      name.startsWith('United States') ? 'Q30' : name;
    expect(computeChanges(1900, before, after, keyOf)).toMatchObject({
      appeared: [],
      disappeared: [],
    });
    expect(computeChanges(1900, before, after).appeared).toEqual([
      'United States',
    ]);
  });
});

describe('published context files', () => {
  const summaries = new Map([
    [1400, summarizeYear(payload([{ name: 'Ottoman Empire' }]))],
    [
      1492,
      summarizeYear(
        payload([{ name: 'Ottoman Empire' }, { name: 'Unmatched' }]),
      ),
    ],
    [1950, summarizeYear(payload([{ name: 'Ottoman Empire' }]))],
  ]);
  const mapping = {
    schemaVersion: 1,
    entities: {
      'Ottoman Empire': {
        status: 'matched',
        qid: 'Q12560',
        evidence: ['fixture'],
      },
      Unmatched: { status: 'none', qid: null, evidence: [] },
    },
  };
  const snapshot = {
    schemaVersion: 1,
    retrievedAt: '2026-11-17T00:00:00.000Z',
    entities: { Q12560: ottoman },
    referenced,
  };

  it('publishes only facts valid in each year', () => {
    expect(entityFacts(ottoman, 1492, referenced, people)).toEqual({
      qid: 'Q12560',
      wikipedia: 'Ottoman Empire',
      existed: { start: 1299, end: 1922 },
      capital: [
        { qid: 'Q16869', label: 'Constantinople', start: 1453, end: 1922 },
      ],
      headOfState: [
        { qid: 'Q194300', label: 'Bayezid II', start: 1481, end: 1512 },
      ],
    });
    expect(entityFacts(ottoman, 1950, referenced, people)).toBeNull();
  });

  it('omits a fact with more holders than it can show', () => {
    const council = {
      id: 'Q39',
      claims: {
        P35: ['Q1', 'Q2', 'Q3', 'Q4'].map((id) =>
          itemClaim('P35', id, {
            start: '+1910-00-00T00:00:00Z',
            end: '+1920-00-00T00:00:00Z',
          }),
        ),
      },
    };
    const labels = Object.fromEntries(
      ['Q1', 'Q2', 'Q3', 'Q4'].map((id) => [id, { label: id }]),
    );
    expect(entityFacts(council, 1914, labels, {})).toBeNull();
    // Two holders spanning the whole year are concurrent (co-rulers).
    const pair = {
      ...council,
      claims: { P35: council.claims.P35.slice(0, 2) },
    };
    expect(entityFacts(pair, 1914, labels, {})).toBeNull();
    // Successive holders within one year are a handover and are kept.
    const handover = {
      ...council,
      claims: {
        P35: [
          itemClaim('P35', 'Q1', {
            start: '+1913-00-00T00:00:00Z',
            end: '+1914-00-00T00:00:00Z',
          }),
          itemClaim('P35', 'Q2', {
            start: '+1914-00-00T00:00:00Z',
            end: '+1914-00-00T00:00:00Z',
          }),
          itemClaim('P35', 'Q3', {
            start: '+1914-00-00T00:00:00Z',
            end: '+1915-00-00T00:00:00Z',
          }),
        ],
      },
    };
    expect(entityFacts(handover, 1914, labels, {}).headOfState).toHaveLength(3);
  });

  it('falls back to dated holders of the head-of-state office', () => {
    const { P35: _P35, ...claims } = ottoman.claims;
    const withoutP35 = {
      ...ottoman,
      claims: { ...claims, P1906: [itemClaim('P1906', 'Q15315411')] },
    };
    const holder = (
      id: string,
      start: string,
      end: string,
      rank = 'normal',
    ) => ({
      id,
      claims: {
        P39: [
          itemClaim('P39', 'Q15315411', { rank, start, end }),
          itemClaim('P39', 'Q42', { start: '+1400-00-00T00:00:00Z' }),
        ],
      },
    });
    const offices = {
      Q15315411: officeHolderClaims('Q15315411', [
        holder('Q194300', '+1481-00-00T00:00:00Z', '+1512-00-00T00:00:00Z'),
        holder('Q34474', '+1451-00-00T00:00:00Z', '+1481-00-00T00:00:00Z'),
        holder(
          'Q999',
          '+1481-00-00T00:00:00Z',
          '+1512-00-00T00:00:00Z',
          'deprecated',
        ),
      ]),
    };
    // The deprecated term and the unrelated office are dropped.
    expect(offices.Q15315411).toHaveLength(2);
    const facts = entityFacts(
      withoutP35,
      1492,
      { ...referenced, Q34474: { label: 'Mehmed II' } },
      people,
      offices,
    );
    expect(facts.headOfState).toEqual([
      { qid: 'Q194300', label: 'Bayezid II', start: 1481, end: 1512 },
    ]);
    expect(facts.headOfStateOffice).toBe('Q15315411');
    expect(
      entityFacts(withoutP35, 1492, referenced, people, {}).headOfState,
    ).toBeUndefined();
    // A direct P35 statement wins over the office.
    expect(
      entityFacts(
        {
          ...ottoman,
          claims: { ...ottoman.claims, P1906: withoutP35.claims.P1906 },
        },
        1492,
        referenced,
        people,
        offices,
      ).headOfStateOffice,
    ).toBeUndefined();
  });

  it('builds deterministic, valid files with a manifest', () => {
    const files = buildContextFiles(summaries, mapping, snapshot);
    expect(files.map(({ year }: { year: number }) => year)).toEqual([
      1400, 1492, 1950,
    ]);
    const contexts = files.map(
      ({ year, json }: { year: number; json: string }) =>
        validateYearContext(JSON.parse(json), year),
    );
    expect(contexts[0].changes).toBeNull();
    expect(contexts[1].changes.appeared).toEqual(['Unmatched']);
    expect(contexts[1].places['Ottoman Empire'].capital[0].label).toBe(
      'Constantinople',
    );
    expect(contexts[1].places.Unmatched).toBeUndefined();
    expect(contexts[2].places).toEqual({});
    expect(buildContextFiles(summaries, mapping, snapshot)).toEqual(files);

    const years = Object.fromEntries(
      files.map(({ year, json }: { year: number; json: string }) => [
        String(year),
        `/data/context/${contextFileName(year, json)}`,
      ]),
    );
    expect(() =>
      validateContextManifest({ schemaVersion: 1, years }, [1400, 1492, 1950]),
    ).not.toThrow();
    expect(() =>
      validateContextManifest({ schemaVersion: 1, years }, [1400, 1492]),
    ).toThrow('years do not match');
    expect(() =>
      validateContextManifest(
        { schemaVersion: 1, years: { ...years, 1400: '/data/context/x.json' } },
        [1400, 1492, 1950],
      ),
    ).toThrow('non-immutable');
    expect(contextFileName(-500, '{}')).toMatch(/^bc500\.[a-f0-9]{16}\.json$/);
  });

  it('rejects malformed context files', () => {
    const [, file] = buildContextFiles(summaries, mapping, snapshot);
    const context = JSON.parse(file.json);
    expect(() => validateYearContext(context, 1400)).toThrow('wrong year');
    const badQid = structuredClone(context);
    badQid.places['Ottoman Empire'].qid = 'P31';
    expect(() => validateYearContext(badQid, 1492)).toThrow('invalid QID');
    const reversed = structuredClone(context);
    reversed.places['Ottoman Empire'].headOfState[0].start = 1600;
    expect(() => validateYearContext(reversed, 1492)).toThrow(
      'ends before it starts',
    );
    const noSource = { ...context, source: {} };
    expect(() => validateYearContext(noSource, 1492)).toThrow('attribution');
  });

  it('validates the mapping and snapshot', () => {
    const names = ['Ottoman Empire', 'Unmatched'];
    expect(() => validateMapping(mapping, names)).not.toThrow();
    expect(() => validateMapping(mapping, ['Ottoman Empire'])).toThrow(
      'names do not match',
    );
    expect(() =>
      validateMapping(
        {
          ...mapping,
          entities: {
            ...mapping.entities,
            Unmatched: { status: 'ambiguous', qid: null, evidence: [] },
          },
        },
        names,
      ),
    ).toThrow('without candidates');
    expect(() =>
      validateMapping(
        {
          ...mapping,
          entities: {
            ...mapping.entities,
            Unmatched: { status: 'matched', qid: 'bad', evidence: [] },
          },
        },
        names,
      ),
    ).toThrow('valid QID');
    expect(() => validateSnapshot(snapshot, mapping)).not.toThrow();
    expect(() =>
      validateSnapshot({ ...snapshot, entities: {} }, mapping),
    ).toThrow('missing matched entity');
    expect(() =>
      validateSnapshot(
        {
          ...snapshot,
          entities: { Q12560: { ...ottoman, lastrevid: undefined } },
        },
        mapping,
      ),
    ).toThrow('pinned revision');
  });
});

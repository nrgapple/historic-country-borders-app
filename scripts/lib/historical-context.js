/**
 * Builds and validates the per-year context files (Wikidata facts plus
 * "what changed" summaries computed from our own border payloads).
 *
 * Pure and offline: the refresh script feeds it fetched data, and the
 * validator feeds it the committed snapshot to prove the published files are
 * reproducible byte for byte.
 */
const area = require('@turf/area').default;
const { sha256, sourceYear } = require('./historical-data');
const {
  PROPERTY,
  isQid,
  lifespan,
  lifespanContains,
  normalizeName,
  parseWikidataTime,
  selectClaims,
  untimedCapitalPlausible,
} = require('./wikidata');

const CONTEXT_SCHEMA_VERSION = 1;
const MAX_VALUES_PER_FACT = 3;
const CONTEXT_URL_PATTERN = /^\/data\/context\/[a-z0-9]+\.[a-f0-9]{16}\.json$/;
const STATUSES = new Set(['matched', 'ambiguous', 'none']);
const WIKIDATA_SOURCE = {
  name: 'Wikidata',
  url: 'https://www.wikidata.org/',
  license: 'CC0-1.0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
};

const text = (value) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/**
 * Summarises one year's payload by territory NAME: total area (m²) across
 * every feature with that name, and SUBJECTO/PARTOF of its largest feature.
 */
function summarizeYear(payload) {
  const summary = new Map();
  payload.data.borders.features.forEach((feature) => {
    const name = text(feature.properties?.NAME);
    if (!name) return;
    const featureArea = area(feature);
    const entry = summary.get(name) || {
      area: 0,
      largest: -1,
      subjectTo: null,
      partOf: null,
    };
    entry.area += featureArea;
    if (featureArea > entry.largest) {
      entry.largest = featureArea;
      const controller = (value) => {
        const valueText = text(value);
        return valueText && valueText !== name ? valueText : null;
      };
      entry.subjectTo = controller(feature.properties.SUBJECTO);
      entry.partOf = controller(feature.properties.PARTOF);
    }
    summary.set(name, entry);
  });
  return summary;
}

/** Per-name appearance years, occurrence counts, and summed area. */
function collectTerritories(summaries) {
  const territories = new Map();
  [...summaries.keys()]
    .sort((a, b) => a - b)
    .forEach((year) => {
      summaries.get(year).forEach((entry, name) => {
        const territory = territories.get(name) || { years: [], area: 0 };
        territory.years.push(year);
        territory.area += entry.area;
        territories.set(name, territory);
      });
    });
  return territories;
}

const byAreaThenName = (summary) => (a, b) =>
  summary.get(b).area - summary.get(a).area || a.localeCompare(b);

/**
 * Compares two years of our own data. Names are compared after light
 * normalisation (case, punctuation, accents), or by `keyOf` (the reconciled
 * QID), so a respelling or renaming in the source ("United States of America"
 * → "United States") is not reported as one territory vanishing and another
 * appearing.
 */
function computeChanges(
  previousYear,
  previous,
  current,
  keyOf = normalizeName,
) {
  const previousKeys = new Set([...previous.keys()].map(keyOf));
  const currentKeys = new Set([...current.keys()].map(keyOf));
  const appeared = [...current.keys()]
    .filter((name) => !previousKeys.has(keyOf(name)))
    .sort(byAreaThenName(current));
  const disappeared = [...previous.keys()]
    .filter((name) => !currentKeys.has(keyOf(name)))
    .sort(byAreaThenName(previous));
  const changed = [...current.keys()]
    .filter((name) => previous.has(name))
    .sort(byAreaThenName(current))
    .flatMap((name) => {
      const before = previous.get(name);
      const after = current.get(name);
      if (before.subjectTo !== after.subjectTo)
        return [
          {
            name,
            field: 'subjectTo',
            from: before.subjectTo,
            to: after.subjectTo,
          },
        ];
      if (before.partOf !== after.partOf)
        return [
          { name, field: 'partOf', from: before.partOf, to: after.partOf },
        ];
      return [];
    });
  return { previousYear, appeared, disappeared, changed };
}

/** Parsed death dates of referenced people, keyed by QID. */
function peopleIndex(referenced) {
  return Object.fromEntries(
    Object.entries(referenced).map(([id, entry]) => [
      id,
      { died: entry.died ? parseWikidataTime(entry.died) : null },
    ]),
  );
}

function factValue(claim, referenced) {
  const label = text(referenced[claim.id]?.label);
  if (!label) return null;
  return {
    qid: claim.id,
    label,
    ...(claim.start ? { start: claim.start.year } : {}),
    ...(claim.start?.approximate ? { startApprox: true } : {}),
    ...(claim.end ? { end: claim.end.year } : {}),
    ...(claim.end?.approximate ? { endApprox: true } : {}),
  };
}

/**
 * Facts about one entity that hold in `year`, or null when the year is
 * outside the entity's known lifespan or nothing is known.
 */
function entityFacts(entity, year, referenced, deaths, offices = {}) {
  const span = lifespan(entity);
  if (!lifespanContains(span, year)) return null;
  // More holders than fit, or two holders whose terms both span the whole
  // year (a collegial body such as the Swiss Federal Council, co-rulers),
  // cannot be summarised honestly as one office holder: omit the fact.
  // Successive holders within a year (handovers) are kept.
  const holdersOf = (claims) =>
    claims.filter(
      (claim) =>
        claim.start &&
        claim.start.latest < year &&
        (!claim.end || claim.end.earliest > year),
    ).length > 1
      ? []
      : values(claims);
  const values = (claims) => {
    const list = claims
      .map((claim) => factValue(claim, referenced))
      .filter(Boolean);
    return list.length > MAX_VALUES_PER_FACT ? [] : list;
  };

  const facts = { qid: entity.id };
  if (span.start || span.end) {
    facts.existed = {
      ...(span.start ? { start: span.start.year } : {}),
      ...(span.start?.approximate ? { startApprox: true } : {}),
      ...(span.end ? { end: span.end.year } : {}),
      ...(span.end?.approximate ? { endApprox: true } : {}),
    };
  }
  const capital = values(
    selectClaims(entity, PROPERTY.capital, year, { allowUntimed: true }).filter(
      (claim) =>
        !claim.untimed ||
        untimedCapitalPlausible(entity, span, referenced[claim.id], year),
    ),
  );
  let headOfState = holdersOf(
    selectClaims(entity, PROPERTY.headOfState, year, { people: deaths }),
  );
  let headOfStateOffice = null;
  if (!headOfState.length) {
    // Fall back to holders of the office held by the head of state (P1906),
    // judged by the same rank and validity rules as P35.
    for (const office of selectClaims(
      entity,
      PROPERTY.headOfStateOffice,
      year,
      { allowUntimed: true },
    )) {
      const holders = holdersOf(
        selectClaims(
          { claims: { [PROPERTY.headOfState]: offices[office.id] || [] } },
          PROPERTY.headOfState,
          year,
          { people: deaths },
        ),
      );
      if (holders.length) {
        headOfState = holders;
        headOfStateOffice = office.id;
        break;
      }
    }
  }
  const headOfGovernment = holdersOf(
    selectClaims(entity, PROPERTY.headOfGovernment, year, { people: deaths }),
  );
  if (capital.length) facts.capital = capital;
  if (headOfState.length) facts.headOfState = headOfState;
  if (headOfStateOffice) facts.headOfStateOffice = headOfStateOffice;
  if (headOfGovernment.length) facts.headOfGovernment = headOfGovernment;
  const wiki = text(entity.sitelinks?.enwiki?.title);
  if (wiki) facts.wikipedia = wiki;
  return Object.keys(facts).some((key) =>
    ['existed', 'capital', 'headOfState', 'headOfGovernment'].includes(key),
  )
    ? facts
    : null;
}

/**
 * Builds every year's context file from year summaries, the reconciliation
 * mapping, and the facts snapshot. Returns `[{ year, json }]`.
 */
function buildContextFiles(summaries, mapping, snapshot) {
  const years = [...summaries.keys()].sort((a, b) => a - b);
  const people = peopleIndex(snapshot.referenced);
  const keyOf = (name) => {
    const record = mapping.entities[name];
    return record?.status === 'matched' ? record.qid : normalizeName(name);
  };
  return years.map((year, index) => {
    const summary = summaries.get(year);
    const previousYear = index > 0 ? years[index - 1] : null;
    const places = {};
    [...summary.keys()].sort().forEach((name) => {
      const record = mapping.entities[name];
      if (record?.status !== 'matched') return;
      const entity = snapshot.entities[record.qid];
      if (!entity) return;
      const facts = entityFacts(
        entity,
        year,
        snapshot.referenced,
        people,
        snapshot.offices,
      );
      if (facts) places[name] = facts;
    });
    const context = {
      schemaVersion: CONTEXT_SCHEMA_VERSION,
      year,
      source: { ...WIKIDATA_SOURCE, retrievedAt: snapshot.retrievedAt },
      places,
      changes:
        previousYear === null
          ? null
          : computeChanges(
              previousYear,
              summaries.get(previousYear),
              summary,
              keyOf,
            ),
    };
    return { year, json: `${JSON.stringify(context)}\n` };
  });
}

const contextFileName = (year, json) =>
  `${sourceYear(year)}.${sha256(json).slice(0, 16)}.json`;

function fail(context, message) {
  throw new Error(`${context}: ${message}`);
}

const isYear = (value) => Number.isInteger(value) && value !== 0;
const isOptionalYear = (value) => value === undefined || isYear(value);

function validateFactValues(values, context) {
  if (!Array.isArray(values) || !values.length) fail(context, 'is empty');
  if (values.length > MAX_VALUES_PER_FACT) fail(context, 'has too many values');
  values.forEach((value, index) => {
    const where = `${context}[${index}]`;
    if (!isQid(value?.qid)) fail(where, 'has an invalid QID');
    if (!text(value.label) || value.label.length > 200)
      fail(where, 'has an invalid label');
    if (!isOptionalYear(value.start) || !isOptionalYear(value.end))
      fail(where, 'has an invalid year');
    if (value.start !== undefined && value.end !== undefined)
      if (value.start > value.end) fail(where, 'ends before it starts');
  });
}

/** Validates the shape of a published per-year context file. */
function validateYearContext(context, expectedYear) {
  const where = `context ${expectedYear}`;
  if (context?.schemaVersion !== CONTEXT_SCHEMA_VERSION)
    fail(where, 'has an unsupported schema');
  if (context.year !== expectedYear) fail(where, 'has the wrong year');
  if (context.source?.license !== 'CC0-1.0' || !context.source?.retrievedAt)
    fail(where, 'is missing source attribution');
  if (!context.places || typeof context.places !== 'object')
    fail(where, 'has no places');
  Object.entries(context.places).forEach(([name, facts]) => {
    const placeWhere = `${where} ${name}`;
    if (!isQid(facts?.qid)) fail(placeWhere, 'has an invalid QID');
    if (facts.existed) {
      const { start, end } = facts.existed;
      if (!isOptionalYear(start) || !isOptionalYear(end))
        fail(placeWhere, 'has an invalid lifespan');
      if (start !== undefined && end !== undefined && start > end)
        fail(placeWhere, 'ends before it starts');
    }
    if (facts.headOfStateOffice !== undefined) {
      if (!isQid(facts.headOfStateOffice) || !facts.headOfState)
        fail(placeWhere, 'has an invalid head-of-state office');
    }
    ['capital', 'headOfState', 'headOfGovernment'].forEach((key) => {
      if (facts[key] !== undefined)
        validateFactValues(facts[key], `${placeWhere} ${key}`);
    });
  });
  if (context.changes !== null) {
    const { changes } = context;
    if (!isYear(changes?.previousYear) || changes.previousYear >= expectedYear)
      fail(where, 'has an invalid previous year');
    ['appeared', 'disappeared'].forEach((key) => {
      if (
        !Array.isArray(changes[key]) ||
        changes[key].some((name) => !text(name))
      )
        fail(where, `has invalid ${key} names`);
    });
    if (
      !Array.isArray(changes.changed) ||
      changes.changed.some(
        (change) =>
          !text(change?.name) ||
          !['subjectTo', 'partOf'].includes(change.field) ||
          (change.from !== null && !text(change.from)) ||
          (change.to !== null && !text(change.to)) ||
          change.from === change.to,
      )
    )
      fail(where, 'has invalid changed entries');
  }
  return context;
}

/** Validates the bundled year → URL manifest against the route years. */
function validateContextManifest(manifest, years) {
  if (manifest?.schemaVersion !== CONTEXT_SCHEMA_VERSION)
    fail('context manifest', 'has an unsupported schema');
  const entries = manifest.years;
  if (!entries || typeof entries !== 'object')
    fail('context manifest', 'has no years');
  const expected = years.map(String).sort();
  const actual = Object.keys(entries).sort();
  if (
    expected.length !== actual.length ||
    expected.some((year, index) => year !== actual[index])
  )
    fail('context manifest', 'years do not match the route years');
  Object.entries(entries).forEach(([year, url]) => {
    if (typeof url !== 'string' || !CONTEXT_URL_PATTERN.test(url))
      fail('context manifest', `${year} has a non-immutable URL`);
    if (!url.includes(`/${sourceYear(Number(year))}.`))
      fail('context manifest', `${year} URL names another year`);
  });
  return manifest;
}

/** Validates the committed reconciliation mapping. */
function validateMapping(mapping, territoryNames) {
  if (mapping?.schemaVersion !== 1)
    fail('entity mapping', 'has an unsupported schema');
  const entities = mapping.entities || {};
  const names = Object.keys(entities);
  const expected = new Set(territoryNames);
  if (names.length !== expected.size || names.some((n) => !expected.has(n)))
    fail('entity mapping', 'names do not match the published territories');
  names.forEach((name) => {
    const record = entities[name];
    const where = `entity mapping ${name}`;
    if (!STATUSES.has(record?.status)) fail(where, 'has an invalid status');
    if (record.status === 'matched' && !isQid(record.qid))
      fail(where, 'is matched without a valid QID');
    if (record.status !== 'matched' && record.qid !== null)
      fail(where, 'has a QID but is not matched');
    if (record.status === 'ambiguous') {
      if (!Array.isArray(record.candidates) || record.candidates.length < 1)
        fail(where, 'is ambiguous without candidates');
      record.candidates.forEach((candidate) => {
        if (!isQid(candidate?.qid)) fail(where, 'has an invalid candidate');
      });
    }
    if (!Array.isArray(record.evidence)) fail(where, 'has no evidence');
  });
  return mapping;
}

/** Validates the committed facts snapshot against the mapping. */
function validateSnapshot(snapshot, mapping) {
  if (snapshot?.schemaVersion !== 1)
    fail('facts snapshot', 'has an unsupported schema');
  if (Number.isNaN(Date.parse(snapshot.retrievedAt)))
    fail('facts snapshot', 'has no retrieval time');
  const matched = new Set(
    Object.values(mapping.entities)
      .filter((record) => record.status === 'matched')
      .map((record) => record.qid),
  );
  Object.entries(snapshot.entities || {}).forEach(([qid, entity]) => {
    const where = `facts snapshot ${qid}`;
    if (!isQid(qid) || entity.id !== qid) fail(where, 'has an invalid id');
    if (!matched.has(qid)) fail(where, 'is not a matched entity');
    if (!Number.isInteger(entity.lastrevid) || entity.lastrevid <= 0)
      fail(where, 'has no pinned revision');
    if (Number.isNaN(Date.parse(entity.retrievedAt)))
      fail(where, 'has no retrieval time');
  });
  matched.forEach((qid) => {
    if (!snapshot.entities?.[qid])
      fail('facts snapshot', `is missing matched entity ${qid}`);
  });
  Object.entries(snapshot.offices || {}).forEach(([qid, claims]) => {
    if (!isQid(qid) || !Array.isArray(claims))
      fail('facts snapshot', `has invalid office ${qid}`);
    claims.forEach((claim) => {
      if (!isQid(claim?.mainsnak?.datavalue?.value?.id))
        fail('facts snapshot', `office ${qid} has an invalid holder`);
    });
  });
  Object.entries(snapshot.referenced || {}).forEach(([qid, entry]) => {
    if (!isQid(qid)) fail('facts snapshot', `has invalid reference ${qid}`);
    if (entry.label !== null && !text(entry.label))
      fail('facts snapshot', `reference ${qid} has an invalid label`);
  });
  return snapshot;
}

module.exports = {
  CONTEXT_SCHEMA_VERSION,
  MAX_VALUES_PER_FACT,
  WIKIDATA_SOURCE,
  buildContextFiles,
  collectTerritories,
  computeChanges,
  contextFileName,
  entityFacts,
  peopleIndex,
  summarizeYear,
  validateContextManifest,
  validateMapping,
  validateSnapshot,
  validateYearContext,
};

/**
 * Reads the committed historical payloads and summarises each year. Local
 * files only; used by the refresh, reconciliation, and offline validation.
 */
function loadYearSummaries(root) {
  const fs = require('fs');
  const path = require('path');
  const assets = JSON.parse(
    fs.readFileSync(path.join(root, 'data', 'historical-assets.json'), 'utf8'),
  ).assets;
  const summaries = new Map();
  Object.entries(assets).forEach(([year, asset]) => {
    const payload = JSON.parse(
      fs.readFileSync(path.join(root, 'public', asset.url), 'utf8'),
    );
    summaries.set(Number(year), summarizeYear(payload));
  });
  return summaries;
}

module.exports.loadYearSummaries = loadYearSummaries;

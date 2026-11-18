/**
 * Pure helpers for interpreting Wikidata entity JSON.
 *
 * Everything here is deterministic and offline so the refresh, the offline
 * validator, and the unit tests share one interpretation of dates, ranks, and
 * qualifiers. Network access lives in `wikidata-client.js`.
 *
 * Year encoding. The Wikibase JSON API (wbgetentities, Special:EntityData)
 * writes years with a sign and historical numbering: "-0044-03-15" is 44 BC
 * and "-0001" is 1 BC; there is no year 0. That matches this app's encoding
 * (-1 is 1 BC), so a JSON year passes through unchanged. Wikidata's RDF and
 * SPARQL output use XSD 1.1 astronomical numbering instead (0 is 1 BC, -1 is
 * 2 BC); `astronomicalToAppYear` converts those values if a SPARQL source is
 * ever added. A JSON value of year 0 is malformed at year precision and is
 * rejected rather than guessed.
 */

const QID_PATTERN = /^Q[1-9]\d{0,11}$/;

const PROPERTY = {
  instanceOf: 'P31',
  subclassOf: 'P279',
  capital: 'P36',
  headOfState: 'P35',
  headOfGovernment: 'P6',
  inception: 'P571',
  dissolution: 'P576',
  startTime: 'P580',
  endTime: 'P582',
  dateOfDeath: 'P570',
  headOfStateOffice: 'P1906',
  positionHeld: 'P39',
  capitalOf: 'P1376',
  coordinateLocation: 'P625',
};

/** Properties kept when entity JSON is trimmed for the local cache. */
const KEPT_PROPERTIES = Object.values(PROPERTY);
/** Bump when KEPT_PROPERTIES changes so cached trimmed entities refetch. */
const TRIM_VERSION = 4;

/**
 * Classes a reconciled territory must reach through P31/P279*. Polity-like
 * classes only: an ethnic group, culture, dynasty, or region is not enough.
 */
const POLITY_ROOTS = {
  Q7275: 'state',
  Q3024240: 'historical country',
  Q6256: 'country',
  Q48349: 'empire',
  Q417175: 'kingdom',
  Q1063239: 'polity',
  Q331644: 'khanate',
  Q1642488: 'chiefdom',
  Q133156: 'colony',
  Q164142: 'protectorate',
  Q161243: 'dependent territory',
};

/**
 * Classes that disqualify a candidate even if another P31 reaches a polity
 * root. Peoples and cultures share names with territories in the source
 * maps (for example "Apache"), but their facts are not a state's facts.
 */
const EXCLUDED_CLASSES = {
  Q41710: 'ethnic group',
  Q133311: 'tribe',
  Q4167410: 'Wikimedia disambiguation page',
  Q13406463: 'Wikimedia list article',
  Q465299: 'archaeological culture',
};

const isQid = (value) => typeof value === 'string' && QID_PATTERN.test(value);

/** Converts an XSD 1.1 (astronomical) year, where 0 is 1 BC, to app years. */
function astronomicalToAppYear(year) {
  if (!Number.isInteger(year)) throw new Error('Year must be an integer');
  return year <= 0 ? year - 1 : year;
}

/** Converts an app year (no year 0) to an astronomical year. */
function appYearToAstronomical(year) {
  if (!Number.isInteger(year) || year === 0)
    throw new Error('App years are non-zero integers');
  return year < 0 ? year + 1 : year;
}

const TIME_PATTERN = /^([+-])(\d{1,16})-(\d{2})-(\d{2})T/;
const PRECISION = { year: 9, decade: 8, century: 7, millennium: 6 };

/**
 * Parses a Wikibase time value into app years.
 *
 * Returns `{ year, precision, earliest, latest, approximate }` or null when the
 * value is malformed or coarser than a millennium. `earliest`/`latest` bound
 * every reasonable reading of a coarse value: Wikidata editors enter "13th
 * century" both as 1300 (ordinal) and as 1201, so a century value covers both
 * the ordinal century ending at that year and the hundred-year block starting
 * at it. Callers decide whether to use the permissive or definite bound.
 */
function parseWikidataTime(value) {
  if (!value || typeof value.time !== 'string') return null;
  const precision = value.precision;
  if (!Number.isInteger(precision) || precision > 14) return null;
  if (precision < PRECISION.millennium) return null;
  const match = TIME_PATTERN.exec(value.time);
  if (!match) return null;
  const magnitude = Number(match[2]);
  if (!Number.isSafeInteger(magnitude)) return null;
  const sign = match[1] === '-' ? -1 : 1;

  if (precision >= PRECISION.year) {
    if (magnitude === 0) return null;
    const year = sign * magnitude;
    return {
      year,
      precision,
      earliest: year,
      latest: year,
      approximate: false,
    };
  }
  if (magnitude === 0) return null;

  const unit = 10 ** (PRECISION.year - precision);
  const block = Math.floor(magnitude / unit) * unit;
  let low = block;
  let high = block + unit - 1;
  if (precision !== PRECISION.decade) {
    const ordinal = Math.ceil(magnitude / unit);
    low = Math.min(low, (ordinal - 1) * unit + 1);
    high = Math.max(high, ordinal * unit);
  }
  low = Math.max(low, 1);
  const year = sign * magnitude;
  return sign > 0
    ? { year, precision, earliest: low, latest: high, approximate: true }
    : { year, precision, earliest: -high, latest: -low, approximate: true };
}

const snakItemId = (snak) => {
  if (snak?.snaktype !== 'value') return null;
  const id = snak.datavalue?.value?.id;
  return isQid(id) ? id : null;
};

const claimsFor = (entity, property) =>
  Array.isArray(entity?.claims?.[property]) ? entity.claims[property] : [];

const usableClaims = (entity, property) =>
  claimsFor(entity, property).filter(
    (claim) =>
      claim &&
      (claim.rank === 'preferred' || claim.rank === 'normal') &&
      claim.mainsnak?.property === property,
  );

/** Keeps only preferred claims when any exist; otherwise normal ones. */
const bestRank = (claims) => {
  const preferred = claims.filter((claim) => claim.rank === 'preferred');
  return preferred.length ? preferred : claims;
};

/**
 * Reads a claim's P580/P582 qualifiers.
 *
 * A malformed, coarse (beyond a millennium), "unknown value", or repeated
 * bound marks the window uncertain, and uncertain windows are never treated
 * as valid. "No value" for an end means the term has not ended.
 */
function claimWindow(claim) {
  const read = (property) => {
    const snaks = claim?.qualifiers?.[property];
    if (!Array.isArray(snaks) || snaks.length === 0) return { present: false };
    if (snaks.length > 1) return { present: true, uncertain: true };
    const [snak] = snaks;
    if (snak.snaktype === 'novalue') return { present: true, open: true };
    if (snak.snaktype !== 'value') return { present: true, uncertain: true };
    const time = parseWikidataTime(snak.datavalue?.value);
    return time ? { present: true, time } : { present: true, uncertain: true };
  };
  const start = read(PROPERTY.startTime);
  const end = read(PROPERTY.endTime);
  return {
    timed: start.present || end.present,
    uncertain: Boolean(start.uncertain || end.uncertain),
    start: start.time || null,
    end: end.time || null,
  };
}

/**
 * True only when the claim is definitely valid throughout `year`: the year is
 * on or after the latest reading of the start and on or before the earliest
 * reading of the end.
 */
function windowContains(window, year) {
  if (window.uncertain) return false;
  if (window.start && year < window.start.latest) return false;
  if (window.end && year > window.end.earliest) return false;
  return true;
}

/** Longest a term without an end qualifier is assumed to last. */
const MAX_OPEN_TERM_YEARS = 60;

/**
 * Selects the item-valued claims of `property` valid in `year`.
 *
 * - Deprecated claims are dropped; preferred claims win over normal ones among
 *   the claims valid in the year (preferred often marks only the current
 *   value, so rank is applied after the time filter, not before).
 * - With `allowUntimed`, a single best-rank claim without time qualifiers is
 *   used when no timed claim covers the year (a capital that never moved).
 * - With `people`, every claim needs a start; an open-ended term ends at the
 *   holder's death or after MAX_OPEN_TERM_YEARS.
 *
 * Returns `[{ id, start, end }]` sorted by start.
 */
function selectClaims(
  entity,
  property,
  year,
  { allowUntimed = false, people = null } = {},
) {
  const claims = usableClaims(entity, property)
    .map((claim) => ({
      claim,
      id: snakItemId(claim.mainsnak),
      window: claimWindow(claim),
    }))
    .filter(({ id }) => id);

  let valid = claims.filter(({ window }) => {
    if (!window.timed || !windowContains(window, year)) return false;
    if (!people) return true;
    if (!window.start) return false;
    return true;
  });

  if (people) {
    valid = valid.filter(({ id, window }) => {
      if (window.end) return true;
      const death = people[id]?.died;
      if (death) return year <= death.earliest;
      return year - window.start.latest <= MAX_OPEN_TERM_YEARS;
    });
  }

  if (!valid.length && allowUntimed && !people) {
    const untimed = bestRank(
      claims.filter(({ window }) => !window.timed).map(({ claim }) => claim),
    );
    if (untimed.length === 1) {
      valid = claims.filter(({ claim }) => claim === untimed[0]);
    }
  }

  const ranked = bestRank(valid.map(({ claim }) => claim));
  const seen = new Set();
  return valid
    .filter(({ claim }) => ranked.includes(claim))
    .filter(({ id }) => (seen.has(id) ? false : seen.add(id)))
    .map(({ id, window }) => ({
      id,
      start: window.start,
      end: window.end,
      untimed: !window.timed,
    }))
    .sort(
      (a, b) =>
        (a.start?.earliest ?? -Infinity) - (b.start?.earliest ?? -Infinity),
    );
}

/** Earliest/latest reading across the best-rank values of a date property. */
function dateProperty(entity, property) {
  const times = bestRank(usableClaims(entity, property))
    .filter((claim) => claim.mainsnak.snaktype === 'value')
    .map((claim) => parseWikidataTime(claim.mainsnak.datavalue?.value))
    .filter(Boolean);
  if (!times.length) return null;
  const chosen = times.reduce((first, time) =>
    time.earliest < first.earliest ? time : first,
  );
  const disagree = times.some((time) => time.year !== chosen.year);
  return {
    year: chosen.year,
    earliest: Math.min(...times.map((time) => time.earliest)),
    latest: Math.max(...times.map((time) => time.latest)),
    approximate: chosen.approximate || disagree,
  };
}

/** Inception (P571, falling back to P580) and dissolution (P576 / P582). */
function lifespan(entity) {
  return {
    start:
      dateProperty(entity, PROPERTY.inception) ||
      dateProperty(entity, PROPERTY.startTime),
    end:
      dateProperty(entity, PROPERTY.dissolution) ||
      dateProperty(entity, PROPERTY.endTime),
  };
}

/** True when the year could fall inside the entity's known lifespan. */
function lifespanContains(span, year) {
  if (span.start && year < span.start.earliest) return false;
  if (span.end && year > span.end.latest) return false;
  return true;
}

const itemValues = (entity, property) =>
  usableClaims(entity, property)
    .map((claim) => snakItemId(claim.mainsnak))
    .filter(Boolean);

/**
 * Resolves the polity roots reachable from a class through P279, using an
 * in-memory map of class entities. Returns a Map of class id → Set of roots.
 */
function classRoots(classId, classes, memo = new Map(), stack = new Set()) {
  if (memo.has(classId)) return memo.get(classId);
  const roots = new Set();
  if (POLITY_ROOTS[classId]) roots.add(classId);
  if (EXCLUDED_CLASSES[classId]) roots.add(`!${classId}`);
  if (!stack.has(classId)) {
    stack.add(classId);
    itemValues(classes[classId], PROPERTY.subclassOf).forEach((parent) =>
      classRoots(parent, classes, memo, stack).forEach((root) =>
        roots.add(root),
      ),
    );
    stack.delete(classId);
  }
  memo.set(classId, roots);
  return roots;
}

const normalizeName = (value) =>
  String(value)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^the /, '')
    .trim();

const englishLabel = (entity) => entity?.labels?.en?.value || null;

const englishNames = (entity) => [
  englishLabel(entity),
  ...(entity?.aliases?.en || []).map((alias) => alias.value),
];

/**
 * Checks one candidate entity for a territory name.
 *
 * `appearance` is `{ first, last, years }` in app years. `titleMatch` is 'title' for
 * an English Wikipedia article with exactly that title, 'redirect' when the
 * title redirects to the candidate's article, or null.
 */
function evaluateCandidate(entity, name, appearance, classes, titleMatch) {
  const qid = entity.id;
  const reasons = [];
  const evidence = [];
  const memo = new Map();

  const nameKey = normalizeName(name);
  const nameMatch = englishNames(entity)
    .filter(Boolean)
    .some((value) => normalizeName(value) === nameKey);
  if (titleMatch === 'title') evidence.push('English Wikipedia title');
  if (titleMatch === 'redirect')
    evidence.push('English Wikipedia redirect to this article');
  if (nameMatch) evidence.push('exact English label or alias');
  if (!nameMatch && !titleMatch) reasons.push('name is only a partial match');

  const types = itemValues(entity, PROPERTY.instanceOf);
  const roots = new Set();
  const excluded = new Set();
  types.forEach((type) =>
    classRoots(type, classes, memo).forEach((root) =>
      root.startsWith('!') ? excluded.add(root.slice(1)) : roots.add(root),
    ),
  );
  if (excluded.size) {
    reasons.push(
      `instance of ${[...excluded].map((id) => EXCLUDED_CLASSES[id]).join(', ')}`,
    );
  } else if (!roots.size) {
    reasons.push('not an instance of a state, polity, or historical country');
  } else {
    evidence.push(
      `type: ${[...roots]
        .map((id) => POLITY_ROOTS[id])
        .sort()
        .join(', ')}`,
    );
  }

  // A NAME can stand for successive polities ("Egypt" from 4000 BC to 2010),
  // so the candidate must overlap the map years, not cover all of them.
  // Publication then shows facts only for years inside its lifespan.
  const span = lifespan(entity);
  const years = appearance.years || [appearance.first, appearance.last];
  const covered = years.filter((year) => lifespanContains(span, year));
  const range = `${span.start ? span.start.year : '?'}–${span.end ? span.end.year : '?'}`;
  if (span.start || span.end) {
    if (!covered.length)
      reasons.push(
        `lifespan ${range} does not overlap the map years (${appearance.first}…${appearance.last})`,
      );
    else
      evidence.push(
        `lifespan ${range} overlaps ${covered.length} of ${years.length} map years`,
      );
  }
  if (span.start && span.end && span.start.year > span.end.year)
    reasons.push('inception is after dissolution');

  return {
    qid,
    label: englishLabel(entity),
    pass: reasons.length === 0,
    dated: Boolean(span.start || span.end),
    strongName: titleMatch === 'title' && nameMatch,
    nameMatch,
    titleMatch,
    reasons,
    evidence,
  };
}

/**
 * Conservative decision for one territory name.
 *
 * - matched: exactly one candidate passes the name, type, and date checks
 *   (an undated candidate also needs an exact Wikipedia title and label), or
 *   several pass and exactly one has both an exact Wikipedia title and label;
 * - ambiguous: candidates pass but none is decisive;
 * - none: no candidate passes.
 */
function decide(evaluations) {
  const passing = evaluations.filter((candidate) => candidate.pass);
  const summary = (candidate) => ({
    qid: candidate.qid,
    label: candidate.label,
    evidence: candidate.evidence,
  });
  if (passing.length === 1) {
    const [only] = passing;
    if (only.dated || only.strongName)
      return { status: 'matched', qid: only.qid, chosen: only };
    return {
      status: 'ambiguous',
      qid: null,
      reason: 'only candidate has no inception or dissolution date',
      candidates: passing.map(summary),
    };
  }
  if (passing.length > 1) {
    const strong = passing.filter(
      (candidate) => candidate.strongName && candidate.dated,
    );
    if (strong.length === 1)
      return { status: 'matched', qid: strong[0].qid, chosen: strong[0] };
    return {
      status: 'ambiguous',
      qid: null,
      reason: 'several candidates pass the checks',
      candidates: passing.map(summary),
    };
  }
  return { status: 'none', qid: null };
}

/**
 * Reduces wbgetentities JSON to the fields this pipeline reads. Claims keep
 * rank, main value, and time qualifiers only.
 */
function trimEntity(entity) {
  if (!entity || !isQid(entity.id)) throw new Error('Entity has no valid id');
  const trimSnak = (snak) => ({
    snaktype: snak.snaktype,
    property: snak.property,
    ...(snak.datavalue ? { datavalue: snak.datavalue } : {}),
  });
  const claims = {};
  KEPT_PROPERTIES.forEach((property) => {
    const list = entity.claims?.[property];
    if (!Array.isArray(list) || !list.length) return;
    claims[property] = list.map((claim) => {
      const qualifiers = {};
      [PROPERTY.startTime, PROPERTY.endTime].forEach((qualifier) => {
        if (claim.qualifiers?.[qualifier])
          qualifiers[qualifier] = claim.qualifiers[qualifier].map(trimSnak);
      });
      return {
        rank: claim.rank,
        mainsnak: trimSnak(claim.mainsnak),
        ...(Object.keys(qualifiers).length ? { qualifiers } : {}),
      };
    });
  });
  return {
    trimVersion: TRIM_VERSION,
    id: entity.id,
    lastrevid: entity.lastrevid,
    modified: entity.modified,
    labels: entity.labels?.en ? { en: entity.labels.en } : {},
    aliases: entity.aliases?.en ? { en: entity.aliases.en } : {},
    sitelinks: entity.sitelinks?.enwiki
      ? { enwiki: { title: entity.sitelinks.enwiki.title } }
      : {},
    claims,
  };
}

const EARTH = 'http://www.wikidata.org/entity/Q2';
const COORDINATE_DECIMALS = 5;
/** Best-rank points closer than this are one place recorded twice. */
const COORDINATE_SPREAD_KM = 10;

function haversineKm([lon1, lat1], [lon2, lat2]) {
  const radians = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * radians) / 2) ** 2 +
    Math.cos(lat1 * radians) *
      Math.cos(lat2 * radians) *
      Math.sin(((lon2 - lon1) * radians) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * The Earth coordinate location (P625) of an entity, as
 * `{ coordinates: [lon, lat] }` rounded to five decimals, or `{ issue }`:
 * "missing" when it has none, "ambiguous" when best-rank values lie more than
 * COORDINATE_SPREAD_KM apart (Wikidata often records a city twice at
 * slightly different points; the first statement is used then). Deprecated
 * statements, other globes, and out-of-range values are ignored.
 */
function earthCoordinates(entity) {
  const usable = (entity?.claims?.[PROPERTY.coordinateLocation] || []).filter(
    (claim) => {
      const value = claim.mainsnak?.datavalue?.value;
      return (
        claim.rank !== 'deprecated' &&
        claim.mainsnak?.snaktype === 'value' &&
        value &&
        (value.globe === undefined || value.globe === EARTH) &&
        Number.isFinite(value.latitude) &&
        Number.isFinite(value.longitude) &&
        Math.abs(value.latitude) <= 90 &&
        Math.abs(value.longitude) <= 180
      );
    },
  );
  const preferred = usable.filter((claim) => claim.rank === 'preferred');
  const round = (value) => Number(value.toFixed(COORDINATE_DECIMALS));
  const points = (preferred.length ? preferred : usable).map((claim) => {
    const { latitude, longitude } = claim.mainsnak.datavalue.value;
    return [round(longitude), round(latitude)];
  });
  if (!points.length) return { issue: 'missing' };
  if (
    points.some((point) => haversineKm(points[0], point) > COORDINATE_SPREAD_KM)
  )
    return { issue: 'ambiguous' };
  return { coordinates: points[0] };
}

/** Year from which an open-ended state's undated capital is trusted. */
const UNTIMED_CAPITAL_FROM = 1800;

/**
 * Guards a capital statement without time qualifiers, which usually records
 * the present-day capital (Hungary → Budapest), against earlier years:
 *
 * - for an entity without a dissolution date, only from UNTIMED_CAPITAL_FROM;
 * - never before the capital itself was founded (its P571); and
 * - when the capital's own "capital of" (P1376) statements for this entity
 *   carry dates, only within one of them.
 *
 * `capital` is the referenced capital's snapshot entry (`{ claims }`).
 */
function untimedCapitalPlausible(entity, span, capital, year) {
  if (!span.end && year < UNTIMED_CAPITAL_FROM) return false;
  const founded = dateProperty(capital, PROPERTY.inception);
  if (founded && year < founded.latest) return false;
  const windows = usableClaims(capital, PROPERTY.capitalOf)
    .filter((claim) => snakItemId(claim.mainsnak) === entity.id)
    .map(claimWindow)
    .filter((window) => window.timed);
  if (windows.length && !windows.some((window) => windowContains(window, year)))
    return false;
  return true;
}

/**
 * Turns the P39 (position held) statements of an office's holders into
 * claim-shaped records whose value is the holder, so `selectClaims` can pick
 * the holder valid in a year exactly as it does for P35.
 */
function officeHolderClaims(officeId, holders) {
  return holders.flatMap((holder) =>
    usableClaims(holder, PROPERTY.positionHeld)
      .filter((claim) => snakItemId(claim.mainsnak) === officeId)
      .map((claim) => ({
        rank: claim.rank,
        mainsnak: {
          snaktype: 'value',
          property: PROPERTY.headOfState,
          datavalue: { value: { id: holder.id } },
        },
        ...(claim.qualifiers ? { qualifiers: claim.qualifiers } : {}),
      })),
  );
}

module.exports = {
  UNTIMED_CAPITAL_FROM,
  dateProperty,
  untimedCapitalPlausible,
  EXCLUDED_CLASSES,
  TRIM_VERSION,
  COORDINATE_SPREAD_KM,
  earthCoordinates,
  haversineKm,
  officeHolderClaims,
  MAX_OPEN_TERM_YEARS,
  POLITY_ROOTS,
  PROPERTY,
  appYearToAstronomical,
  astronomicalToAppYear,
  bestRank,
  claimWindow,
  classRoots,
  decide,
  englishLabel,
  evaluateCandidate,
  isQid,
  itemValues,
  lifespan,
  lifespanContains,
  normalizeName,
  parseWikidataTime,
  selectClaims,
  trimEntity,
  windowContains,
};

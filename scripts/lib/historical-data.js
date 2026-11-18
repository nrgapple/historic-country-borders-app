const crypto = require('crypto');
const area = require('@turf/area').default;
const polylabel = require('polylabel');

const ATLAS_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#FFA07A',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E9',
  '#F8C471',
  '#82E0AA',
  '#F1C40F',
  '#E74C3C',
  '#3498DB',
  '#2ECC71',
  '#9B59B6',
  '#E67E22',
  '#1ABC9C',
  '#34495E',
  '#F39C12',
  '#D35400',
  '#27AE60',
  '#2980B9',
  '#8E44AD',
  '#16A085',
  '#F4D03F',
  '#58D68D',
  '#5DADE2',
  '#AF7AC5',
  '#F8D7DA',
  '#D5DBDB',
];

// Upstream borders are hand-drawn historical approximations with
// kilometre-level accuracy. Five decimal places (about 1.1 m at the equator)
// keep far more precision than the source supports while removing transfer,
// parse, and memory cost from ~15-digit coordinates.
const COORDINATE_PRECISION = 5;
const MIN_RING_POSITIONS = 4;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sourceYear(year) {
  return year < 0 ? `bc${Math.abs(year)}` : String(year);
}

function textbookColor(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  }
  return ATLAS_COLORS[Math.abs(hash) % ATLAS_COLORS.length];
}

function assertPosition(position, context) {
  if (
    !Array.isArray(position) ||
    position.length < 2 ||
    !Number.isFinite(position[0]) ||
    !Number.isFinite(position[1]) ||
    position[0] < -180 ||
    position[0] > 180 ||
    position[1] < -90 ||
    position[1] > 90
  ) {
    throw new Error(`${context} contains an invalid coordinate`);
  }
}

function assertRing(ring, context) {
  if (!Array.isArray(ring) || ring.length < 4) {
    throw new Error(`${context} contains an invalid linear ring`);
  }
  ring.forEach((position) => assertPosition(position, context));
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    throw new Error(`${context} contains an open linear ring`);
  }
}

function roundCoordinate(value) {
  return Number(value.toFixed(COORDINATE_PRECISION));
}

function roundPosition(position) {
  return position.map(roundCoordinate);
}

function samePosition(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

// Rounds a closed ring and drops consecutive duplicate positions. Rounding
// never changes the first/last equality of a closed ring, so the result stays
// closed. If the ring would collapse below a valid linear ring, the original
// unrounded ring is kept for that ring only and reported as a fallback.
function publishRing(ring) {
  const rounded = [];
  ring.forEach((position) => {
    const next = roundPosition(position);
    if (!rounded.length || !samePosition(rounded[rounded.length - 1], next)) {
      rounded.push(next);
    }
  });
  if (rounded.length < MIN_RING_POSITIONS) {
    return { ring, fallback: true };
  }
  return { ring: rounded, fallback: false };
}

function publishPolygons(polygons) {
  let fallbackRings = 0;
  const coordinates = polygons.map((polygon) =>
    polygon.map((ring) => {
      const published = publishRing(ring);
      if (published.fallback) fallbackRings += 1;
      return published.ring;
    }),
  );
  return { coordinates, fallbackRings };
}

function publishGeometry(geometry, context) {
  const { coordinates } = publishPolygons(polygonParts(geometry, context));
  return {
    ...geometry,
    coordinates: geometry.type === 'Polygon' ? coordinates[0] : coordinates,
  };
}

function countFallbackRings(payload) {
  return payload.data.borders.features.reduce(
    (total, feature) =>
      total +
      publishPolygons(
        feature.geometry.type === 'Polygon'
          ? [feature.geometry.coordinates]
          : feature.geometry.coordinates,
      ).fallbackRings,
    0,
  );
}

function polygonParts(geometry, context) {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) {
    throw new Error(`${context} must be Polygon or MultiPolygon`);
  }
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  if (!Array.isArray(polygons) || polygons.length === 0) {
    throw new Error(`${context} has no polygons`);
  }
  polygons.forEach((polygon) => {
    if (!Array.isArray(polygon) || polygon.length === 0) {
      throw new Error(`${context} has an empty polygon`);
    }
    polygon.forEach((ring) => assertRing(ring, context));
  });
  return polygons;
}

function assertFeatureCollection(collection, context) {
  if (
    !collection ||
    collection.type !== 'FeatureCollection' ||
    !Array.isArray(collection.features)
  ) {
    throw new Error(`${context} is not a FeatureCollection`);
  }
}

function validateBorderSource(
  collection,
  context = 'Historical border source',
) {
  assertFeatureCollection(collection, context);
  collection.features.forEach((feature, index) => {
    if (!feature || feature.type !== 'Feature') {
      throw new Error(`${context} feature ${index} is invalid`);
    }
    polygonParts(feature.geometry, `${context} feature ${index}`);
    if (
      !feature.properties ||
      (feature.properties.NAME !== null &&
        feature.properties.NAME !== undefined &&
        typeof feature.properties.NAME !== 'string')
    ) {
      throw new Error(`${context} feature ${index} has an invalid NAME`);
    }
  });
  return collection;
}

function validatePlacesSource(collection) {
  assertFeatureCollection(collection, 'Historical places source');
  collection.features.forEach((feature, index) => {
    if (
      !feature ||
      feature.type !== 'Feature' ||
      feature.geometry?.type !== 'Point'
    ) {
      throw new Error(
        `Historical places feature ${index} must be a Point feature`,
      );
    }
    assertPosition(
      feature.geometry.coordinates,
      `Historical places feature ${index}`,
    );
    const since = feature.properties?.inhabitedSince;
    const until = feature.properties?.inhabitedUntil;
    if (
      (since !== null && since !== undefined && !Number.isFinite(since)) ||
      (until !== null && until !== undefined && !Number.isFinite(until))
    ) {
      throw new Error(`Historical places feature ${index} has invalid dates`);
    }
  });
  return collection;
}

/** A string with visible content: not empty and not only whitespace. */
function isBlank(value) {
  return typeof value === 'string' && value.trim() === '';
}

/** Trimmed text, or null for a missing, non-string, or blank value. */
function cleanText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Published text is Unicode NFC, so the browser and font subsetter see one
 * spelling of each name (upstream stores a few 1492 names decomposed, for
 * example "Gwich'in Nành" with a + U+0300).
 */
function publishText(value) {
  return typeof value === 'string' ? value.normalize('NFC') : value;
}

// Upstream records carry many always-null keys (about 130 per place). They
// add transfer and parse cost without information, so they are not published.
// Blank strings ("" or only spaces) carry no information either.
function compactProperties(properties) {
  return Object.fromEntries(
    Object.entries(properties || {})
      .filter(
        ([, value]) => value !== null && value !== undefined && !isBlank(value),
      )
      .map(([key, value]) => [key, publishText(value)]),
  );
}

// UTF-8 read as Latin-1 or Windows-1252: a lead byte Â–Å shown as a letter,
// followed by a continuation byte shown as U+0080–U+00BF or a CP1252 symbol
// ("CochimÃ­" for "Cochimí"), or the "â€" prefix of curly quotes and dashes.
// A real Ã followed by a letter ("Ãwa", the Avá-Canoeiro self-name) is fine.
const MOJIBAKE = /[Â-Å][\u0080-¿ŒœŠšŸŽžƒˆ˜–—‘-„†-•…‰‹›€™]|â€/;
// A character lost to a "?" fallback inside a word ("M?ori"). A name that
// is only "?" (an unknown people in 200 BC) is upstream's own notation.
const LOST_CHARACTER = /\p{L}\?\p{L}/u;

/**
 * Text defects the refresh must never publish: non-NFC text and U+FFFD
 * anywhere; for names, also mojibake and lost-character "?". Each published
 * occurrence was fixed by a reviewed override (data/historical-name-overrides.json).
 */
function textDefect(value, { name = false } = {}) {
  if (typeof value !== 'string') return null;
  if (value.includes('�')) return 'contains U+FFFD';
  if (value.normalize('NFC') !== value) return 'is not NFC';
  if (name && MOJIBAKE.test(value)) return 'looks mis-decoded (mojibake)';
  if (name && LOST_CHARACTER.test(value))
    return 'has a character replaced by "?"';
  return null;
}

const BORDER_NAME_FIELDS = ['NAME', 'ABBREVN', 'SUBJECTO', 'PARTOF'];
const PLACE_NAME_FIELDS = ['name'];
const NAME_OVERRIDES_SCHEMA_VERSION = 1;
/** A record may be dropped only when it is a sliver below this area. */
const SLIVER_MAX_KM2 = 1;

function assertTextFields(properties, context) {
  Object.entries(properties || {}).forEach(([key, value]) => {
    const defect = textDefect(value, {
      name: BORDER_NAME_FIELDS.includes(key) || PLACE_NAME_FIELDS.includes(key),
    });
    if (defect) throw new Error(`${context} ${key} ${defect}`);
  });
}

const isCleanName = (value) =>
  typeof value === 'string' &&
  cleanText(value) === value &&
  !textDefect(value, { name: true });

/**
 * Validates data/historical-name-overrides.json and indexes it:
 *
 * - `borders`: per-year record overrides. `match` selects exactly one source
 *   border record by exact source values; `set` replaces name fields, or
 *   `drop: "sliver"` removes a sub-km² record whose name another record of
 *   that year publishes.
 * - `places`: `match` selects exactly one source place; `set` renames it.
 * - `overlordAliases`: in the listed years, a SUBJECTO/PARTOF value that is
 *   not a territory resolves to the named territory for split dependencies.
 *
 * Every entry needs an https source and a review note.
 */
function validateNameOverrides(file) {
  if (!file || file.schemaVersion !== NAME_OVERRIDES_SCHEMA_VERSION)
    throw new Error('Name overrides have an unsupported schema');
  ['borders', 'places', 'overlordAliases'].forEach((key) => {
    if (!Array.isArray(file[key]))
      throw new Error(`Name overrides have no ${key} list`);
  });
  const reviewed = (entry, context) => {
    if (!entry || typeof entry !== 'object')
      throw new Error(`${context} is invalid`);
    if (
      typeof entry.source !== 'string' ||
      !entry.source.startsWith('https://')
    )
      throw new Error(`${context} needs an https source`);
    if (typeof entry.note !== 'string' || !entry.note.trim())
      throw new Error(`${context} needs a review note`);
  };
  const yearsOf = (entry, context) => {
    if (
      !Array.isArray(entry.years) ||
      entry.years.length === 0 ||
      !entry.years.every(Number.isInteger) ||
      new Set(entry.years).size !== entry.years.length
    )
      throw new Error(`${context} needs distinct integer years`);
    return entry.years;
  };
  const fieldsOf = (object, fields, context, what) => {
    if (
      !object ||
      typeof object !== 'object' ||
      Object.keys(object).length === 0 ||
      Object.keys(object).some((key) => !fields.includes(key))
    )
      throw new Error(`${context} ${what} must use only ${fields.join(', ')}`);
  };

  const borders = new Map();
  file.borders.forEach((entry, index) => {
    const context = `Border name override ${index}`;
    reviewed(entry, context);
    fieldsOf(entry.match, BORDER_NAME_FIELDS, context, 'match');
    Object.values(entry.match).forEach((value) => {
      if (typeof value !== 'string')
        throw new Error(`${context} match values must be strings`);
    });
    if ((entry.set === undefined) === (entry.drop === undefined))
      throw new Error(`${context} needs exactly one of set and drop`);
    if (entry.drop !== undefined && entry.drop !== 'sliver')
      throw new Error(`${context} may only drop a "sliver"`);
    if (entry.set !== undefined) {
      fieldsOf(entry.set, BORDER_NAME_FIELDS, context, 'set');
      Object.values(entry.set).forEach((value) => {
        if (!isCleanName(value))
          throw new Error(`${context} sets a blank or defective name`);
      });
    }
    yearsOf(entry, context).forEach((year) => {
      if (!borders.has(year)) borders.set(year, []);
      borders.get(year).push({ ...entry, context });
    });
  });

  const places = file.places.map((entry, index) => {
    const context = `Place name override ${index}`;
    reviewed(entry, context);
    fieldsOf(entry.match, PLACE_NAME_FIELDS, context, 'match');
    fieldsOf(entry.set, PLACE_NAME_FIELDS, context, 'set');
    if (typeof entry.match.name !== 'string' || !isCleanName(entry.set.name))
      throw new Error(`${context} is invalid`);
    return { ...entry, context };
  });

  const overlordAliases = new Map();
  file.overlordAliases.forEach((entry, index) => {
    const context = `Overlord alias ${index}`;
    reviewed(entry, context);
    if (!isCleanName(entry.from) || !isCleanName(entry.to))
      throw new Error(`${context} needs clean from and to names`);
    if (entry.from === entry.to)
      throw new Error(`${context} aliases a name to itself`);
    yearsOf(entry, context).forEach((year) => {
      if (!overlordAliases.has(year)) overlordAliases.set(year, new Map());
      const aliases = overlordAliases.get(year);
      if (aliases.has(entry.from))
        throw new Error(`${context} repeats ${entry.from} in ${year}`);
      aliases.set(entry.from, entry.to);
    });
  });

  return { borders, places, overlordAliases };
}

const matchesRecord = (properties, match) =>
  Object.entries(match).every(([key, value]) => properties?.[key] === value);

const sameFields = (properties, set) =>
  Object.entries(set).every(([key, value]) => properties?.[key] === value);

/**
 * Applies one year's reviewed border overrides to a validated source
 * collection. Each entry must match exactly one source record by its exact
 * source values, no record may be matched twice, a `set` must change
 * something, and a dropped sliver must be under 1 km² with its name still
 * published by another record. A renamed or fixed upstream record therefore
 * fails the refresh instead of silently changing the published map.
 */
function applyBorderOverrides(year, collection, overrides) {
  const entries = overrides?.borders.get(year) || [];
  if (!entries.length) return collection;
  const byFeature = new Map();
  entries.forEach((entry) => {
    const hits = [];
    collection.features.forEach((feature, index) => {
      if (matchesRecord(feature.properties, entry.match)) hits.push(index);
    });
    if (hits.length !== 1)
      throw new Error(
        `${entry.context} matches ${hits.length} records in ${year}; expected exactly one`,
      );
    if (byFeature.has(hits[0]))
      throw new Error(
        `${entry.context} and ${byFeature.get(hits[0]).context} match the same record in ${year}`,
      );
    const { properties } = collection.features[hits[0]];
    if (entry.set && sameFields(properties, entry.set))
      throw new Error(`${entry.context} changes nothing in ${year}`);
    byFeature.set(hits[0], entry);
  });

  const features = [];
  const dropped = [];
  collection.features.forEach((feature, index) => {
    const entry = byFeature.get(index);
    if (entry?.drop) {
      const km2 = area(feature) / 1e6;
      if (!(km2 < SLIVER_MAX_KM2))
        throw new Error(
          `${entry.context} would drop ${km2.toFixed(1)} km² in ${year}; only slivers under ${SLIVER_MAX_KM2} km² may be dropped`,
        );
      dropped.push({ entry, name: cleanText(feature.properties.NAME) });
      return;
    }
    features.push(
      entry
        ? { ...feature, properties: { ...feature.properties, ...entry.set } }
        : feature,
    );
  });
  dropped.forEach(({ entry, name }) => {
    if (
      !name ||
      !features.some((feature) => cleanText(feature.properties?.NAME) === name)
    )
      throw new Error(
        `${entry.context} drops ${name || 'an unnamed record'} in ${year}, but no other record publishes that name`,
      );
  });
  return { ...collection, features };
}

/**
 * Applies reviewed place renames. Each must match exactly one source place
 * and change it.
 */
function applyPlaceNameOverrides(places, overrides) {
  const entries = overrides?.places || [];
  const byFeature = new Map();
  entries.forEach((entry) => {
    const hits = [];
    places.features.forEach((feature, index) => {
      if (matchesRecord(feature.properties, entry.match)) hits.push(index);
    });
    if (hits.length !== 1)
      throw new Error(
        `${entry.context} matches ${hits.length} places; expected exactly one`,
      );
    if (byFeature.has(hits[0]))
      throw new Error(`${entry.context} matches an already renamed place`);
    if (sameFields(places.features[hits[0]].properties, entry.set))
      throw new Error(`${entry.context} changes nothing`);
    byFeature.set(hits[0], entry);
  });
  return {
    ...places,
    features: places.features.map((feature, index) =>
      byFeature.has(index)
        ? {
            ...feature,
            properties: {
              ...feature.properties,
              ...byFeature.get(index).set,
            },
          }
        : feature,
    ),
  };
}

function processBorders(collection) {
  validateBorderSource(collection);
  const borders = [];
  const labels = [];

  collection.features
    .filter(
      ({ properties }) =>
        typeof properties.NAME === 'string' &&
        properties.NAME !== 'unclaimed' &&
        properties.NAME !== 'Antarctica',
    )
    .forEach((feature, index) => {
      const sourceName = feature.properties.NAME;
      // A NAME of only whitespace is a source defect on a real territory
      // (for example Netherlands in 1815). The border is kept so the map has
      // no hole, but it is published without a NAME and its label point has
      // no text; see docs/HISTORICAL_DATA.md "Blank names".
      const name = cleanText(publishText(sourceName));
      // Colors keep their historical inputs (untrimmed, as stored) so
      // published palettes are stable. A reviewed override is part of that
      // input, so a corrected record hashes like the same name elsewhere.
      const color = textbookColor(
        String(feature.properties.SUBJECTO || sourceName),
      );
      const context = `Historical border feature ${index}`;
      // Area and label placement use the source geometry so zero-area source
      // anomalies are reported exactly as upstream publishes them.
      const candidates = polygonParts(feature.geometry, context).map(
        (coordinates) => {
          const polygon = {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates },
          };
          return {
            coordinates: roundPosition(polylabel(coordinates)),
            area: area(polygon),
          };
        },
      );
      const label = candidates.reduce(
        (largest, candidate) =>
          !largest || candidate.area > largest.area ? candidate : largest,
        null,
      );

      borders.push({
        type: 'Feature',
        geometry: publishGeometry(feature.geometry, context),
        properties: {
          ...compactProperties(feature.properties),
          ...(name ? { NAME: name } : {}),
          COLOR: color,
        },
      });
      labels.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: label.coordinates },
        // Labels need only text and a size priority; details live on borders.
        properties: { ...(name ? { NAME: name } : {}), AREA: label.area },
      });
    });

  return {
    labels: { type: 'FeatureCollection', features: labels },
    borders: { type: 'FeatureCollection', features: borders },
  };
}

/**
 * Applies reviewed end dates to dated upstream places. Every override must
 * match exactly one dated place, so a renamed or removed upstream record fails
 * the refresh instead of silently dropping the correction.
 */
function applyPlaceOverrides(places, overrideFile) {
  if (!overrideFile || overrideFile.schemaVersion !== 1) {
    throw new Error('Place overrides have an unsupported schema');
  }
  const byName = new Map();
  overrideFile.overrides.forEach((override, index) => {
    if (
      typeof override.name !== 'string' ||
      !Number.isInteger(override.inhabitedUntil) ||
      typeof override.source !== 'string' ||
      !override.source.startsWith('https://')
    ) {
      throw new Error(`Place override ${index} is invalid`);
    }
    if (byName.has(override.name)) {
      throw new Error(`Place override for ${override.name} is duplicated`);
    }
    byName.set(override.name, override);
  });

  const matched = new Set();
  const features = places.features.map((feature) => {
    const properties = feature.properties || {};
    const override = byName.get(properties.name);
    if (!override || !Number.isFinite(properties.inhabitedSince))
      return feature;
    if (matched.has(override.name)) {
      throw new Error(`Place override for ${override.name} is ambiguous`);
    }
    if (override.inhabitedUntil < properties.inhabitedSince) {
      throw new Error(
        `Place override for ${override.name} ends before it starts`,
      );
    }
    matched.add(override.name);
    return {
      ...feature,
      properties: { ...properties, inhabitedUntil: override.inhabitedUntil },
    };
  });

  const missing = [...byName.keys()].filter((name) => !matched.has(name));
  if (missing.length) {
    throw new Error(
      `Place overrides match no dated place: ${missing.join(', ')}`,
    );
  }
  return { ...places, features };
}

function placesForYear(year, places) {
  validatePlacesSource(places);
  return {
    type: 'FeatureCollection',
    features: places.features
      .filter(({ properties }) => {
        const since = properties.inhabitedSince;
        const until = properties.inhabitedUntil;
        return (
          Number.isFinite(since) &&
          year >= since &&
          (!Number.isFinite(until) || year <= until)
        );
      })
      .map((feature) => ({
        ...feature,
        properties: compactProperties(feature.properties),
        geometry: {
          ...feature.geometry,
          coordinates: roundPosition(feature.geometry.coordinates),
        },
      })),
  };
}

/**
 * `nameOverrides` is the validated name-override index; its border entries
 * for `year` are applied to the source before processing. Place renames are
 * applied once to the whole places file (applyPlaceNameOverrides).
 */
function buildPayload(year, borders, places, nameOverrides) {
  validateBorderSource(borders);
  return {
    data: processBorders(applyBorderOverrides(year, borders, nameOverrides)),
    places: placesForYear(year, places),
  };
}

function validatePayload(payload, context = 'Historical payload') {
  if (!payload || typeof payload !== 'object')
    throw new Error(`${context} is invalid`);
  assertFeatureCollection(payload.data?.labels, `${context} labels`);
  assertFeatureCollection(payload.data?.borders, `${context} borders`);
  assertFeatureCollection(payload.places, `${context} places`);
  if (
    payload.data.labels.features.length !== payload.data.borders.features.length
  ) {
    throw new Error(`${context} labels and borders differ in length`);
  }
  payload.data.borders.features.forEach((feature, index) => {
    const borderContext = `${context} border ${index}`;
    assertPublishedName(feature.properties?.NAME, borderContext);
    assertTextFields(feature.properties, borderContext);
    if (
      payload.data.labels.features[index]?.properties?.NAME !==
      feature.properties?.NAME
    ) {
      throw new Error(`${borderContext} and its label have different names`);
    }
    polygonParts(feature.geometry, borderContext).forEach((polygon) =>
      polygon.forEach((ring) => {
        // Publishing is idempotent: a rounded ring republishes unchanged, and
        // a fallback ring still collapses and is retained as-is.
        const published = publishRing(ring).ring;
        if (
          published.length !== ring.length ||
          published.some((position, i) => !samePosition(position, ring[i]))
        ) {
          throw new Error(
            `${borderContext} has unrounded or duplicate coordinates`,
          );
        }
      }),
    );
  });
  const assertRoundedPoint = (feature, pointContext) => {
    if (feature?.geometry?.type !== 'Point')
      throw new Error(`${pointContext} is not a Point`);
    const position = feature.geometry.coordinates;
    assertPosition(position, pointContext);
    if (!samePosition(roundPosition(position), position))
      throw new Error(`${pointContext} has unrounded coordinates`);
  };
  payload.data.labels.features.forEach((feature, index) =>
    assertRoundedPoint(feature, `${context} label ${index}`),
  );
  payload.places.features.forEach((feature, index) => {
    assertRoundedPoint(feature, `${context} place ${index}`);
    if (!cleanText(feature.properties?.name))
      throw new Error(`${context} place ${index} has a blank name`);
    assertTextFields(feature.properties, `${context} place ${index}`);
  });
  return payload;
}

/**
 * A published NAME is either absent (a blank source name) or visible,
 * already-trimmed text. Blank and padded names are rejected.
 */
function assertPublishedName(name, context) {
  if (name === undefined) return;
  if (typeof name !== 'string' || cleanText(name) !== name) {
    throw new Error(`${context} has a blank or untrimmed NAME`);
  }
}

module.exports = {
  ATLAS_COLORS,
  BORDER_NAME_FIELDS,
  COORDINATE_PRECISION,
  SLIVER_MAX_KM2,
  applyBorderOverrides,
  applyPlaceNameOverrides,
  assertPublishedName,
  cleanText,
  publishText,
  textDefect,
  validateNameOverrides,
  polygonParts,
  roundPosition,
  applyPlaceOverrides,
  buildPayload,
  countFallbackRings,
  processBorders,
  placesForYear,
  publishRing,
  sha256,
  sourceYear,
  validateBorderSource,
  validatePayload,
  validatePlacesSource,
};

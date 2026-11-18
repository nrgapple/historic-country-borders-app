/**
 * Split per-year historical files for the app's map worker.
 *
 * Each year's combined payload (`{ data: { borders, labels }, places }`, still
 * used by the production app) is split into three content-hashed files:
 *
 * - polygons: `{ id, properties: { c, dep?, ov?, oc? } }` border features,
 *   rewound to RFC 7946, for MapLibre's GeoJSON worker;
 * - labels: territory label points `{ id, n, a }` and places `{ p, k }`;
 * - index: territory facts `{ id, NAME, PARTOF, SUBJECTO, BORDERPRECISION,
 *   bbox, label, ... }` for the finder, panel and prerendered lists.
 *
 * Everything here is a pure, deterministic function of the committed combined
 * payloads, `data/historical-place-classes.json` and the overlord aliases in
 * `data/historical-name-overrides.json`, so `yarn data:validate` rebuilds the
 * files offline and requires byte-for-byte equality.
 * See docs/HISTORICAL_DATA.md "Split year files".
 */
const {
  ATLAS_COLORS,
  assertPublishedName,
  cleanText,
  polygonParts,
  roundPosition,
  sha256,
  sourceYear,
  validateNameOverrides,
} = require('./historical-data');

const SPLIT_SCHEMA_VERSION = 1;
const PLACE_CLASSES_SCHEMA_VERSION = 1;
/**
 * Direction A ("Classic atlas") paints 12 hand-tinted washes. The approved
 * mock maps legacy color slot i to wash i % 12 (`HB.colorMatch` in
 * design/living-atlas/shared/atlas.js); `c` publishes that wash directly.
 */
const ATLAS_WASH_COUNT = 12;
const SITE_CLASS = 'archaeological-site';
const PLACE_KINDS = ['city', 'site'];
const SPLIT_KINDS = ['polygons', 'labels', 'index'];
const BBOX_DECIMALS = 2;
const SQUARE_METRES_PER_KM2 = 1e6;

const fail = (context, message) => {
  throw new Error(`${context} ${message}`);
};

function washIndex(color) {
  const slot = ATLAS_COLORS.indexOf(String(color).toUpperCase());
  if (slot < 0) throw new Error(`Unknown atlas color ${color}`);
  return slot % ATLAS_WASH_COUNT;
}

/** Twice the planar signed area in lon/lat; positive is counter-clockwise. */
function ringSignedArea(ring) {
  let total = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    total += x1 * y2 - x2 * y1;
  }
  return total;
}

/**
 * RFC 7946 §3.1.6: exterior rings counter-clockwise, holes clockwise. Line
 * offsets (edge bands, selection bands) rely on this to draw inside a border.
 * A zero-area ring has no orientation and is left as it is.
 */
function rewindPolygon(polygon) {
  return polygon.map((ring, index) => {
    const signed = ringSignedArea(ring);
    const wrong = index === 0 ? signed < 0 : signed > 0;
    return wrong ? ring.slice().reverse() : ring;
  });
}

function rewindGeometry(geometry) {
  return geometry.type === 'Polygon'
    ? { type: 'Polygon', coordinates: rewindPolygon(geometry.coordinates) }
    : {
        type: 'MultiPolygon',
        coordinates: geometry.coordinates.map(rewindPolygon),
      };
}

function isRfc7946Wound(geometry) {
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.every((polygon) =>
    polygon.every((ring, index) => {
      const signed = ringSignedArea(ring);
      return index === 0 ? signed >= 0 : signed <= 0;
    }),
  );
}

const floorTo = (value, decimals) =>
  Math.floor(value * 10 ** decimals) / 10 ** decimals;
const ceilTo = (value, decimals) =>
  Math.ceil(value * 10 ** decimals) / 10 ** decimals;

/**
 * Smallest [west, south, east, north] box around the exterior rings, rounded
 * outward to two decimals so it always contains the geometry. A territory
 * that straddles the antimeridian (the Russian Empire in 1914) gets
 * west > east, as RFC 7946 §5.2 specifies, instead of a world-wide box.
 */
function territoryBbox(geometries) {
  let south = 90;
  let north = -90;
  const intervals = [];
  geometries.forEach((geometry) => {
    const polygons =
      geometry.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry.coordinates;
    polygons.forEach((polygon) => {
      let west = 180;
      let east = -180;
      polygon[0].forEach(([lon, lat]) => {
        west = Math.min(west, lon);
        east = Math.max(east, lon);
        south = Math.min(south, lat);
        north = Math.max(north, lat);
      });
      intervals.push([west, east]);
    });
  });
  intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  intervals.forEach(([west, east]) => {
    const last = merged[merged.length - 1];
    if (last && west <= last[1]) last[1] = Math.max(last[1], east);
    else merged.push([west, east]);
  });
  // The gap that wraps through ±180° is the default; a wider gap elsewhere
  // means the shape is narrower when drawn across the antimeridian.
  let west = merged[0][0];
  let east = merged[merged.length - 1][1];
  let widestGap = merged[0][0] + 360 - east;
  for (let index = 0; index < merged.length - 1; index += 1) {
    const gap = merged[index + 1][0] - merged[index][1];
    if (gap > widestGap) {
      widestGap = gap;
      west = merged[index + 1][0];
      east = merged[index][1];
    }
  }
  return [
    Math.max(-180, floorTo(west, BBOX_DECIMALS)),
    Math.max(-90, floorTo(south, BBOX_DECIMALS)),
    Math.min(180, ceilTo(east, BBOX_DECIMALS)),
    Math.min(90, ceilTo(north, BBOX_DECIMALS)),
  ];
}

/** True when a point lies inside a bbox from territoryBbox. */
function bboxContains([west, south, east, north], [lon, lat]) {
  const inLongitude =
    west <= east ? lon >= west && lon <= east : lon >= west || lon <= east;
  return inLongitude && lat >= south && lat <= north;
}

/**
 * Validates the reviewed place-class file and returns name → entry. Each
 * entry names one upstream place and, optionally, the year (`from`) from
 * which it is drawn as an archaeological site; without `from` it is a site
 * in every year it is published.
 */
function validatePlaceClasses(file) {
  if (!file || file.schemaVersion !== PLACE_CLASSES_SCHEMA_VERSION)
    throw new Error('Place classes have an unsupported schema');
  if (!file.classes || typeof file.classes[SITE_CLASS] !== 'string')
    throw new Error(`Place classes do not define ${SITE_CLASS}`);
  if (!Array.isArray(file.places))
    throw new Error('Place classes have no places list');
  const byName = new Map();
  file.places.forEach((entry, index) => {
    const context = `Place class ${index}`;
    if (!entry || cleanText(entry.name) !== entry.name)
      fail(context, 'has a blank or untrimmed name');
    if (typeof file.classes[entry.class] !== 'string')
      fail(context, `has an unknown class ${entry.class}`);
    if (
      typeof entry.source !== 'string' ||
      !entry.source.startsWith('https://')
    )
      fail(context, 'needs an https source');
    if (typeof entry.note !== 'string' || !entry.note.trim())
      fail(context, 'needs a review note');
    if (entry.from !== undefined && !Number.isInteger(entry.from))
      fail(context, 'has a non-integer from year');
    if (byName.has(entry.name))
      fail(context, `duplicates the entry for ${entry.name}`);
    byName.set(entry.name, entry);
  });
  return byName;
}

/** 'site' when the reviewed class applies in this map year, else 'city'. */
function placeKind(entry, year) {
  return entry?.class === SITE_CLASS &&
    (entry.from === undefined || year >= entry.from)
    ? 'site'
    : 'city';
}

/**
 * Refresh-time check against the full upstream places file: every entry must
 * match exactly one dated place, and `from` must fall inside its published
 * range, so a renamed upstream record or a no-op entry fails the refresh.
 */
function validatePlaceClassesAgainstPlaces(places, file) {
  const byName = validatePlaceClasses(file);
  byName.forEach((entry, name) => {
    const matches = places.features.filter(
      (feature) =>
        cleanText(feature.properties?.name) === name &&
        Number.isFinite(feature.properties?.inhabitedSince),
    );
    if (matches.length !== 1)
      throw new Error(
        `Place class for ${name} matches ${matches.length} dated places`,
      );
    const { inhabitedSince, inhabitedUntil } = matches[0].properties;
    if (entry.from !== undefined) {
      if (entry.from <= inhabitedSince)
        throw new Error(
          `Place class for ${name}: from ${entry.from} is not after inhabitedSince ${inhabitedSince}; omit it`,
        );
      if (Number.isFinite(inhabitedUntil) && entry.from > inhabitedUntil)
        throw new Error(
          `Place class for ${name}: from ${entry.from} is after inhabitedUntil ${inhabitedUntil}`,
        );
    }
  });
  return byName;
}

/**
 * Offline check against the published payloads: every entry is published in
 * at least one year, never twice in one year, and is a site in some year.
 */
function validatePlaceClassesAgainstPayloads(payloads, byName) {
  const effective = new Set();
  const seen = new Set();
  payloads.forEach((payload, year) => {
    const names = new Map();
    payload.places.features.forEach((feature) => {
      const name = cleanText(feature.properties.name);
      names.set(name, (names.get(name) || 0) + 1);
    });
    byName.forEach((entry, name) => {
      const count = names.get(name) || 0;
      if (count > 1)
        throw new Error(`Place class for ${name} is ambiguous in ${year}`);
      if (count === 1) {
        seen.add(name);
        if (placeKind(entry, year) === 'site') effective.add(name);
      }
    });
  });
  byName.forEach((_, name) => {
    if (!seen.has(name))
      throw new Error(`Place class for ${name} matches no published place`);
    if (!effective.has(name))
      throw new Error(`Place class for ${name} never applies to a map year`);
  });
}

/**
 * Resolves a SUBJECTO/PARTOF value to a territory name in this year: the
 * value itself when it is a territory, else its reviewed overlord alias.
 */
function resolveOverlordName(value, byName, aliases) {
  if (!value) return null;
  if (byName.has(value)) return value;
  const alias = aliases.get(value);
  return alias && byName.has(alias) ? alias : null;
}

/**
 * Overlords keep distinct washes so their dependencies' `oc` tints tell the
 * empires apart (the United Kingdom and France share a legacy color in
 * 1914). Overlords are ranked by dependency count, then largest-part area,
 * then name. First, in rank order, each overlord keeps its own wash if no
 * higher-ranked overlord already kept it. Then each displaced overlord, in
 * rank order, takes the next wash upwards (mod 12) that no overlord holds.
 * Only displaced overlords change, and they never displace another. With
 * more than 12 overlords the rest keep their own wash. Returns the number
 * re-washed.
 */
function separateOverlordWashes(territories, labels) {
  const dependents = new Map();
  territories.forEach((territory) => {
    if (territory.overlord)
      dependents.set(
        territory.overlord,
        (dependents.get(territory.overlord) || 0) + 1,
      );
  });
  const area = (territory) => labels[territory.largest].properties.AREA;
  const ranked = [...dependents.keys()].sort(
    (a, b) =>
      dependents.get(b) - dependents.get(a) ||
      area(b) - area(a) ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  );
  const taken = new Set();
  const displaced = ranked.filter((territory) => {
    if (taken.has(territory.c)) return true;
    taken.add(territory.c);
    return false;
  });
  let rewashed = 0;
  displaced.forEach((territory) => {
    for (let step = 1; step < ATLAS_WASH_COUNT; step += 1) {
      const wash = (territory.c + step) % ATLAS_WASH_COUNT;
      if (!taken.has(wash)) {
        territory.c = wash;
        territory.rewashed = true;
        taken.add(wash);
        rewashed += 1;
        return;
      }
    }
  });
  return rewashed;
}

/**
 * Splits one combined payload. Territory ids are dense integers in order of
 * first appearance; every feature that shares a name shares its id, so
 * MapLibre feature-state selects a whole territory at once. `aliases` maps
 * this year's reviewed overlord aliases (from → territory name).
 */
function buildSplitYear(year, payload, placeClasses, aliases = new Map()) {
  const borders = payload.data.borders.features;
  const labels = payload.data.labels.features;
  if (borders.length !== labels.length)
    throw new Error(`${year}: borders and labels differ in length`);

  const territories = [];
  const byName = new Map();
  const featureTerritory = borders.map((feature, index) => {
    const properties = feature.properties;
    let name = properties.NAME;
    let fromAbbreviation = false;
    if (name === undefined) {
      // Blank source NAME: use the source's own abbreviated name when it has
      // one (Cardial Ware culture in 5000 BC); otherwise leave it unnamed.
      name = cleanText(properties.ABBREVN);
      fromAbbreviation = Boolean(name);
    }
    if (!name) return null;
    let territory = byName.get(name);
    if (!territory) {
      territory = {
        id: territories.length,
        name,
        features: [],
        allFromAbbreviation: true,
      };
      territories.push(territory);
      byName.set(name, territory);
    }
    territory.features.push(index);
    territory.allFromAbbreviation &&= fromAbbreviation;
    return territory;
  });

  // Facts come from the feature with the largest polygon, as the context
  // pipeline's summaries do.
  territories.forEach((territory) => {
    territory.largest = territory.features.reduce((best, index) =>
      labels[index].properties.AREA > labels[best].properties.AREA
        ? index
        : best,
    );
    territory.c = washIndex(borders[territory.largest].properties.COLOR);
  });

  const findOverlord = (territory, withAliases) => {
    const properties = borders[territory.largest].properties;
    for (const value of [properties.SUBJECTO, properties.PARTOF].map(
      cleanText,
    )) {
      const resolved = resolveOverlordName(
        value,
        byName,
        withAliases ? aliases : new Map(),
      );
      if (resolved && resolved !== territory.name)
        return { name: resolved, via: resolved === value ? null : value };
    }
    return null;
  };
  // An alias counts as used only when it changes a territory's overlord.
  const aliasUse = new Set();
  territories.forEach((territory) => {
    const found = findOverlord(territory, true);
    if (!found) return;
    territory.overlord = byName.get(found.name);
    if (found.via && findOverlord(territory, false)?.name !== found.name)
      aliasUse.add(found.via);
  });
  aliases.forEach((to, from) => {
    if (byName.has(from))
      throw new Error(
        `${year}: overlord alias ${from} names a territory of that year`,
      );
    if (!byName.has(to))
      throw new Error(
        `${year}: overlord alias target ${to} is not a territory of that year`,
      );
    if (!aliasUse.has(from))
      throw new Error(
        `${year}: overlord alias ${from} resolves no dependency; remove it`,
      );
  });
  const rewashedOverlords = separateOverlordWashes(territories, labels);

  const dependency = (territory) =>
    territory?.overlord
      ? { dep: 1, ov: territory.overlord.id, oc: territory.overlord.c }
      : {};

  const polygonFeatures = borders.map((feature, index) => {
    const territory = featureTerritory[index];
    return {
      type: 'Feature',
      ...(territory ? { id: territory.id } : {}),
      properties: {
        // A re-washed overlord is drawn entirely in its new wash.
        c: territory?.rewashed
          ? territory.c
          : washIndex(feature.properties.COLOR),
        ...dependency(territory),
      },
      geometry: rewindGeometry(feature.geometry),
    };
  });

  const territoryLabels = [];
  borders.forEach((_, index) => {
    const territory = featureTerritory[index];
    if (!territory) return;
    territoryLabels.push({
      type: 'Feature',
      id: territory.id,
      properties: {
        n: territory.name,
        a: Math.round(labels[index].properties.AREA / SQUARE_METRES_PER_KM2),
      },
      geometry: labels[index].geometry,
    });
  });

  let sites = 0;
  const placeLabels = payload.places.features.map((feature) => {
    const name = cleanText(feature.properties.name);
    const kind = placeKind(placeClasses.get(name), year);
    if (kind === 'site') sites += 1;
    return {
      type: 'Feature',
      properties: { p: name, k: kind },
      geometry: feature.geometry,
    };
  });

  const index = {
    schemaVersion: SPLIT_SCHEMA_VERSION,
    year,
    territories: territories.map((territory) => {
      const properties = borders[territory.largest].properties;
      const precision = Number(properties.BORDERPRECISION);
      const optional = (key, value) => (value ? { [key]: value } : {});
      return {
        id: territory.id,
        NAME: territory.name,
        ...(territory.allFromAbbreviation ? { nameFrom: 'ABBREVN' } : {}),
        ...optional('PARTOF', cleanText(properties.PARTOF)),
        ...optional('SUBJECTO', cleanText(properties.SUBJECTO)),
        ...(Number.isFinite(precision) ? { BORDERPRECISION: precision } : {}),
        bbox: territoryBbox(
          territory.features.map(
            (featureIndex) => borders[featureIndex].geometry,
          ),
        ),
        label: labels[territory.largest].geometry.coordinates,
        ...dependency(territory),
      };
    }),
  };

  const counts = {
    territories: territories.length,
    polygons: polygonFeatures.length,
    unnamedPolygons: featureTerritory.filter((territory) => !territory).length,
    namedFromAbbreviation: borders.filter(
      (feature, featureIndex) =>
        feature.properties.NAME === undefined && featureTerritory[featureIndex],
    ).length,
    dependencies: territories.filter((territory) => territory.overlord).length,
    rewashedOverlords,
    territoryLabels: territoryLabels.length,
    places: placeLabels.length,
    sites,
  };

  return {
    polygons: { type: 'FeatureCollection', features: polygonFeatures },
    labels: {
      type: 'FeatureCollection',
      features: [...territoryLabels, ...placeLabels],
    },
    index,
    counts,
  };
}

const serialize = (value) => `${JSON.stringify(value)}\n`;

function splitFileName(year, kind, json) {
  return `${sourceYear(year)}.${kind}.${sha256(json).slice(0, 16)}.json`;
}

const isInteger = (value, min, max) =>
  Number.isInteger(value) && value >= min && value <= max;

const isPosition = (position) =>
  Array.isArray(position) &&
  position.length === 2 &&
  position[0] >= -180 &&
  position[0] <= 180 &&
  position[1] >= -90 &&
  position[1] <= 90 &&
  roundPosition(position).every((value, i) => value === position[i]);

/**
 * Structural validation of one year's split files, independent of the
 * rebuild comparison: winding, ids, wash range, names, dependencies, place
 * kinds, bboxes and label points.
 */
function validateSplitYear(
  year,
  { polygons, labels, index },
  aliases = new Map(),
) {
  const context = `Split year ${year}`;
  if (index?.schemaVersion !== SPLIT_SCHEMA_VERSION || index.year !== year)
    fail(context, 'index has the wrong schema or year');
  if (
    polygons?.type !== 'FeatureCollection' ||
    !Array.isArray(polygons.features)
  )
    fail(context, 'polygons are not a FeatureCollection');
  if (labels?.type !== 'FeatureCollection' || !Array.isArray(labels.features))
    fail(context, 'labels are not a FeatureCollection');
  const territories = index.territories;
  if (!Array.isArray(territories)) fail(context, 'index has no territories');

  const names = new Set();
  territories.forEach((territory, id) => {
    const where = `${context} territory ${id}`;
    if (territory.id !== id) fail(where, 'has a non-sequential id');
    if (typeof territory.NAME !== 'string')
      fail(where, 'has a blank or untrimmed NAME');
    assertPublishedName(territory.NAME, where);
    if (names.has(territory.NAME)) fail(where, 'repeats a NAME');
    names.add(territory.NAME);
    ['PARTOF', 'SUBJECTO'].forEach((key) => {
      if (key in territory)
        assertPublishedName(territory[key], `${where} ${key}`);
    });
    const { bbox } = territory;
    if (
      !Array.isArray(bbox) ||
      bbox.length !== 4 ||
      !bbox.every(Number.isFinite) ||
      bbox[1] > bbox[3] ||
      bbox[0] < -180 ||
      bbox[2] > 180 ||
      bbox[1] < -90 ||
      bbox[3] > 90
    )
      fail(where, 'has an invalid bbox');
    if (!isPosition(territory.label)) fail(where, 'has an invalid label point');
    if (!bboxContains(bbox, territory.label))
      fail(where, 'has a label point outside its bbox');
    if ('dep' in territory) {
      if (
        territory.dep !== 1 ||
        !isInteger(territory.ov, 0, territories.length - 1) ||
        territory.ov === id ||
        !isInteger(territory.oc, 0, ATLAS_WASH_COUNT - 1)
      )
        fail(where, 'has an invalid dependency');
      const overlord = territories[territory.ov].NAME;
      if (
        ![territory.SUBJECTO, territory.PARTOF].some(
          (value) => value === overlord || aliases.get(value) === overlord,
        )
      )
        fail(where, 'names an overlord outside SUBJECTO, PARTOF and aliases');
    } else if ('ov' in territory || 'oc' in territory) {
      fail(where, 'has overlord fields without dep');
    }
  });

  const territoryWash = new Map();
  const covered = new Set();
  polygons.features.forEach((feature, featureIndex) => {
    const where = `${context} polygon ${featureIndex}`;
    polygonParts(feature.geometry, where);
    if (!isRfc7946Wound(feature.geometry))
      fail(where, 'is not wound to RFC 7946');
    const { c, dep, ov, oc, ...rest } = feature.properties || {};
    if (Object.keys(rest).length) fail(where, 'has unexpected properties');
    if (!isInteger(c, 0, ATLAS_WASH_COUNT - 1)) fail(where, 'has an invalid c');
    if (feature.id === undefined) {
      if (dep !== undefined) fail(where, 'is unnamed but has a dependency');
      return;
    }
    if (!isInteger(feature.id, 0, territories.length - 1))
      fail(where, 'has an unknown id');
    covered.add(feature.id);
    const territory = territories[feature.id];
    if (dep !== territory.dep || ov !== territory.ov || oc !== territory.oc)
      fail(where, 'disagrees with the index about its dependency');
    if (!territoryWash.has(feature.id))
      territoryWash.set(feature.id, new Set());
    territoryWash.get(feature.id).add(c);
  });
  if (covered.size !== territories.length)
    fail(context, 'has territories without polygons');
  territories.forEach((territory) => {
    if ('oc' in territory && !territoryWash.get(territory.ov).has(territory.oc))
      fail(
        context,
        `territory ${territory.id} has an overlord wash its overlord never uses`,
      );
  });
  const overlordWash = new Map();
  territories.forEach((territory) => {
    if ('ov' in territory) overlordWash.set(territory.ov, territory.oc);
  });
  if (
    overlordWash.size <= ATLAS_WASH_COUNT &&
    new Set(overlordWash.values()).size !== overlordWash.size
  )
    fail(context, 'has two overlords sharing a wash');

  const labelled = new Set();
  labels.features.forEach((feature, featureIndex) => {
    const where = `${context} label ${featureIndex}`;
    if (
      feature.geometry?.type !== 'Point' ||
      !isPosition(feature.geometry.coordinates)
    )
      fail(where, 'is not a rounded Point');
    const properties = feature.properties || {};
    if ('n' in properties) {
      if (!isInteger(feature.id, 0, territories.length - 1))
        fail(where, 'has an unknown id');
      if (properties.n !== territories[feature.id].NAME)
        fail(where, 'has a name that differs from the index');
      if (!isInteger(properties.a, 0, Number.MAX_SAFE_INTEGER))
        fail(where, 'has an invalid area');
      labelled.add(feature.id);
    } else {
      if (
        typeof properties.p !== 'string' ||
        cleanText(properties.p) !== properties.p
      )
        fail(where, 'has a blank place name');
      if (!PLACE_KINDS.includes(properties.k))
        fail(where, 'has an unknown kind');
    }
  });
  if (labelled.size !== territories.length)
    fail(context, 'has territories without a label');
}

/**
 * Builds every year's split files from the committed combined payloads.
 * `readPayload(asset)` returns the parsed payload and its bytes' hash.
 */
function buildSplitAssets({
  assets,
  readPayload,
  placeClassesText,
  nameOverridesText,
}) {
  const placeClasses = validatePlaceClasses(JSON.parse(placeClassesText));
  const overlordAliases = nameOverridesText
    ? validateNameOverrides(JSON.parse(nameOverridesText)).overlordAliases
    : new Map();
  const years = Object.keys(assets)
    .map(Number)
    .sort((a, b) => a - b);
  overlordAliases.forEach((_, year) => {
    if (!years.includes(year))
      throw new Error(`Overlord aliases name an unpublished year ${year}`);
  });
  const payloads = new Map();
  years.forEach((year) =>
    payloads.set(year, readPayload(assets[String(year)])),
  );
  validatePlaceClassesAgainstPayloads(
    new Map([...payloads].map(([year, { payload }]) => [year, payload])),
    placeClasses,
  );

  const files = [];
  const manifestYears = {};
  years.forEach((year) => {
    const { payload, sha256: sourceSha } = payloads.get(year);
    const aliases = overlordAliases.get(year) || new Map();
    const split = buildSplitYear(year, payload, placeClasses, aliases);
    validateSplitYear(year, split, aliases);
    const entry = {
      source: { url: assets[String(year)].url, sha256: sourceSha },
    };
    SPLIT_KINDS.forEach((kind) => {
      const json = serialize(split[kind]);
      const name = splitFileName(year, kind, json);
      files.push({ name, json });
      entry[kind] = {
        url: `/data/historical/${name}`,
        sha256: sha256(json),
        bytes: Buffer.byteLength(json),
      };
    });
    entry.counts = split.counts;
    manifestYears[String(year)] = entry;
  });

  const manifest = {
    schemaVersion: SPLIT_SCHEMA_VERSION,
    washCount: ATLAS_WASH_COUNT,
    inputs: {
      assets: 'data/historical-assets.json',
      placeClasses: {
        file: 'data/historical-place-classes.json',
        sha256: sha256(placeClassesText),
      },
      ...(nameOverridesText
        ? {
            nameOverrides: {
              file: 'data/historical-name-overrides.json',
              sha256: sha256(nameOverridesText),
            },
          }
        : {}),
    },
    years: manifestYears,
  };
  return {
    files,
    manifest,
    manifestJson: `${JSON.stringify(manifest, null, 2)}\n`,
  };
}

/** Loads the committed inputs from a repository root and builds. */
function buildSplitAssetsFromRoot(root) {
  const fs = require('fs');
  const path = require('path');
  const assets = JSON.parse(
    fs.readFileSync(path.join(root, 'data', 'historical-assets.json'), 'utf8'),
  ).assets;
  return buildSplitAssets({
    assets,
    placeClassesText: fs.readFileSync(
      path.join(root, 'data', 'historical-place-classes.json'),
      'utf8',
    ),
    nameOverridesText: fs.readFileSync(
      path.join(root, 'data', 'historical-name-overrides.json'),
      'utf8',
    ),
    readPayload: (asset) => {
      const content = fs.readFileSync(path.join(root, 'public', asset.url));
      return { payload: JSON.parse(content), sha256: sha256(content) };
    },
  });
}

module.exports = {
  ATLAS_WASH_COUNT,
  SITE_CLASS,
  SPLIT_KINDS,
  SPLIT_SCHEMA_VERSION,
  bboxContains,
  buildSplitAssets,
  buildSplitAssetsFromRoot,
  buildSplitYear,
  isRfc7946Wound,
  placeKind,
  resolveOverlordName,
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
};

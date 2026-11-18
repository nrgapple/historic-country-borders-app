/**
 * Per-year capital points for the remaster map, built offline from:
 *
 * - the per-year context files (capitals already filtered to statements
 *   definitely valid in that year; see docs/HISTORICAL_CONTEXT.md);
 * - the Wikidata coordinates (P625) pinned in the facts snapshot; and
 * - the split polygons and index (territory ids and geometry).
 *
 * A capital is published only when its point lies inside its territory or
 * within MAX_DISTANCE_KM of the territory's border. Everything else is listed
 * as a rejection for review. Output is deterministic, so validation rebuilds
 * it and requires byte-for-byte equality.
 */
const { sha256, sourceYear } = require('./historical-data');

const CAPITALS_SCHEMA_VERSION = 1;
const MAX_DISTANCE_KM = 50;
const EARTH_RADIUS_KM = 6371.0088;
const RADIANS = Math.PI / 180;

const polygonsOf = (geometry) =>
  geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

/** Even-odd ray casting in lon/lat; holes are handled by the parity. */
function insidePolygon([lon, lat], polygon) {
  let inside = false;
  polygon.forEach((ring) => {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (
        yi > lat !== yj > lat &&
        lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
      )
        inside = !inside;
    }
  });
  return inside;
}

/** Longitude difference wrapped into [-180, 180). */
const deltaLongitude = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;

/**
 * Distance in km from a point to the nearest border segment, using an
 * equirectangular projection centred on the point. Accurate to well under 1%
 * at the 50 km scale that matters here; farther values are only reported.
 */
function distanceToRingsKm([lon, lat], polygons) {
  const scaleX = Math.cos(lat * RADIANS) * RADIANS * EARTH_RADIUS_KM;
  const scaleY = RADIANS * EARTH_RADIUS_KM;
  let best = Infinity;
  polygons.forEach((polygon) =>
    polygon.forEach((ring) => {
      for (let index = 0; index < ring.length - 1; index += 1) {
        const ax = deltaLongitude(ring[index][0], lon) * scaleX;
        const ay = (ring[index][1] - lat) * scaleY;
        const bx = deltaLongitude(ring[index + 1][0], lon) * scaleX;
        const by = (ring[index + 1][1] - lat) * scaleY;
        const dx = bx - ax;
        const dy = by - ay;
        const lengthSquared = dx * dx + dy * dy;
        const t =
          lengthSquared > 0
            ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared))
            : 0;
        best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
      }
    }),
  );
  return best;
}

/** 0 when the point is inside any of the geometries, else km to the border. */
function distanceToTerritoryKm(point, geometries) {
  const polygons = geometries.flatMap(polygonsOf);
  if (polygons.some((polygon) => insidePolygon(point, polygon))) return 0;
  return distanceToRingsKm(point, polygons);
}

function capitalsFileName(year, json) {
  return `${sourceYear(year)}.capitals.${sha256(json).slice(0, 16)}.json`;
}

/**
 * Builds one year's capital points. `context` is the parsed context file,
 * `split` is `{ index, polygons }`, and `referenced` is the snapshot's
 * referenced-item table. Returns the FeatureCollection and its rejections.
 */
function buildCapitalsYear(year, context, split, referenced) {
  const byName = new Map(
    split.index.territories.map((territory) => [territory.NAME, territory]),
  );
  const geometries = new Map();
  split.polygons.features.forEach((feature) => {
    if (feature.id === undefined) return;
    if (!geometries.has(feature.id)) geometries.set(feature.id, []);
    geometries.get(feature.id).push(feature.geometry);
  });

  const features = [];
  const rejected = [];
  const published = new Set();
  Object.keys(context.places)
    .sort()
    .forEach((name) => {
      const capitals = context.places[name].capital || [];
      capitals.forEach(({ qid, label }) => {
        const reject = (reason, extra = {}) =>
          rejected.push({ year, name, qid, label, reason, ...extra });
        const territory = byName.get(name);
        if (!territory) return reject('territory not in the split index');
        const entry = referenced[qid];
        if (!entry || !('coordinates' in entry || 'coordinateIssue' in entry))
          return reject('coordinates not fetched');
        if (entry.coordinateIssue)
          return reject(`coordinates ${entry.coordinateIssue}`);
        if (typeof label !== 'string' || !label.trim())
          return reject('capital has no label');
        const distanceKm = distanceToTerritoryKm(
          entry.coordinates,
          geometries.get(territory.id),
        );
        if (distanceKm > MAX_DISTANCE_KM)
          return reject('outside territory', {
            distanceKm: Math.round(distanceKm),
          });
        const key = `${territory.id}:${qid}`;
        if (published.has(key)) return undefined;
        published.add(key);
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: entry.coordinates },
          properties: { name: label, t: territory.id, qid },
        });
        return undefined;
      });
    });
  return { collection: { type: 'FeatureCollection', features }, rejected };
}

/**
 * Builds all years. `contextFiles` is `[{ year, json }]` (the context build
 * output), `splitYears` maps year → `{ index, polygons }`.
 */
function buildCapitalFiles(contextFiles, splitYears, snapshot) {
  const files = [];
  const years = {};
  const rejected = [];
  contextFiles.forEach(({ year, json }) => {
    const split = splitYears.get(year);
    if (!split) throw new Error(`Capitals: no split files for ${year}`);
    const result = buildCapitalsYear(
      year,
      JSON.parse(json),
      split,
      snapshot.referenced || {},
    );
    validateCapitalsYear(year, result.collection, split.index);
    const fileJson = `${JSON.stringify(result.collection)}\n`;
    const name = capitalsFileName(year, fileJson);
    files.push({ year, name, json: fileJson });
    years[String(year)] = {
      url: `/data/context/${name}`,
      sha256: sha256(fileJson),
      bytes: Buffer.byteLength(fileJson),
      capitals: result.collection.features.length,
      rejected: result.rejected.length,
    };
    rejected.push(...result.rejected);
  });
  const manifest = {
    schemaVersion: CAPITALS_SCHEMA_VERSION,
    source: {
      name: 'Wikidata',
      license: 'CC0-1.0',
      properties: ['P36', 'P625'],
      retrievedAt: snapshot.retrievedAt,
    },
    maxDistanceKm: MAX_DISTANCE_KM,
    years,
    rejected,
  };
  return {
    files,
    manifest,
    manifestJson: `${JSON.stringify(manifest, null, 2)}\n`,
  };
}

const isQid = (value) => typeof value === 'string' && /^Q[1-9]\d*$/.test(value);

/** Structural checks on one published capitals file. */
function validateCapitalsYear(year, collection, index) {
  const where = `Capitals ${year}`;
  if (
    collection?.type !== 'FeatureCollection' ||
    !Array.isArray(collection.features)
  )
    throw new Error(`${where} is not a FeatureCollection`);
  const seen = new Set();
  collection.features.forEach((feature, position) => {
    const context = `${where} feature ${position}`;
    const [lon, lat] = feature.geometry?.coordinates || [];
    if (
      feature.geometry?.type !== 'Point' ||
      !(Math.abs(lon) <= 180) ||
      !(Math.abs(lat) <= 90)
    )
      throw new Error(`${context} is not a valid Point`);
    const { name, t, qid, ...rest } = feature.properties || {};
    if (Object.keys(rest).length)
      throw new Error(`${context} has unexpected properties`);
    if (typeof name !== 'string' || name.trim() !== name || !name)
      throw new Error(`${context} has a blank name`);
    if (!isQid(qid)) throw new Error(`${context} has an invalid QID`);
    if (!Number.isInteger(t) || !index.territories[t])
      throw new Error(`${context} has an unknown territory id`);
    const key = `${t}:${qid}`;
    if (seen.has(key)) throw new Error(`${context} is repeated`);
    seen.add(key);
  });
}

/** Capital QIDs referenced by any snapshot entity's P36 statements. */
function capitalIds(snapshot, itemValues, capitalProperty) {
  const ids = new Set();
  Object.values(snapshot.entities || {}).forEach((entity) =>
    itemValues(entity, capitalProperty).forEach((id) => ids.add(id)),
  );
  return [...ids].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

/** Reads the committed split index and polygons for every year. */
function loadSplitYears(root) {
  const fs = require('fs');
  const path = require('path');
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(root, 'data', 'historical-split-assets.json'),
      'utf8',
    ),
  );
  const read = (url) =>
    JSON.parse(fs.readFileSync(path.join(root, 'public', url), 'utf8'));
  return new Map(
    Object.entries(manifest.years).map(([year, entry]) => [
      Number(year),
      { index: read(entry.index.url), polygons: read(entry.polygons.url) },
    ]),
  );
}

module.exports = {
  CAPITALS_SCHEMA_VERSION,
  MAX_DISTANCE_KM,
  buildCapitalFiles,
  buildCapitalsYear,
  capitalIds,
  capitalsFileName,
  distanceToTerritoryKm,
  insidePolygon,
  loadSplitYears,
  validateCapitalsYear,
};

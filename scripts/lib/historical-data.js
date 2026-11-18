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
      const name = feature.properties.NAME;
      const color = textbookColor(String(feature.properties.SUBJECTO || name));
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
        properties: { ...feature.properties, NAME: name, COLOR: color },
      });
      labels.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: label.coordinates },
        properties: {
          ...feature.properties,
          NAME: name,
          COLOR: color,
          AREA: label.area,
        },
      });
    });

  return {
    labels: { type: 'FeatureCollection', features: labels },
    borders: { type: 'FeatureCollection', features: borders },
  };
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
        geometry: {
          ...feature.geometry,
          coordinates: roundPosition(feature.geometry.coordinates),
        },
      })),
  };
}

function buildPayload(year, borders, places) {
  return { data: processBorders(borders), places: placesForYear(year, places) };
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
  payload.places.features.forEach((feature, index) =>
    assertRoundedPoint(feature, `${context} place ${index}`),
  );
  return payload;
}

module.exports = {
  COORDINATE_PRECISION,
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

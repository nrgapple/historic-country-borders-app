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
      const candidates = polygonParts(
        feature.geometry,
        `Historical border feature ${index}`,
      ).map((coordinates) => {
        const polygon = {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates },
        };
        return { coordinates: polylabel(coordinates), area: area(polygon) };
      });
      const label = candidates.reduce(
        (largest, candidate) =>
          !largest || candidate.area > largest.area ? candidate : largest,
        null,
      );

      borders.push({
        type: 'Feature',
        geometry: feature.geometry,
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
    features: places.features.filter(({ properties }) => {
      const since = properties.inhabitedSince;
      const until = properties.inhabitedUntil;
      return (
        Number.isFinite(since) &&
        year >= since &&
        (!Number.isFinite(until) || year <= until)
      );
    }),
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
  payload.data.borders.features.forEach((feature, index) =>
    polygonParts(feature.geometry, `${context} border ${index}`),
  );
  payload.data.labels.features.forEach((feature, index) => {
    if (feature.geometry?.type !== 'Point')
      throw new Error(`${context} label ${index} is not a Point`);
    assertPosition(feature.geometry.coordinates, `${context} label ${index}`);
  });
  return payload;
}

module.exports = {
  buildPayload,
  processBorders,
  placesForYear,
  sha256,
  sourceYear,
  validateBorderSource,
  validatePayload,
  validatePlacesSource,
};

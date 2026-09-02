'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const turfAreaModule = require('@turf/area');
const polylabelModule = require('polylabel');

const area = turfAreaModule.default || turfAreaModule;
const polylabel = polylabelModule.default || polylabelModule;

const SCHEMA_VERSION = 1;
const EXPECTED_DISTRICT_COUNT = 500;
const REQUIRED_PROPERTIES = [
  'SCHOOL_NAM',
  'SCHOOL_DIS',
  'CTY_NAME',
  'IU_NAME',
  'IU_NUM',
  'AUN_NUM',
  'AVTS',
];
const ALLOWED_GEOMETRY_TYPES = ['Polygon', 'MultiPolygon'];
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const STALE_AFTER_MONTHS = 18;

const atlasColors = [
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

const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');

const textbookColor = (input) => {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (Math.imul(31, hash) + input.charCodeAt(index)) | 0;
  }
  return atlasColors[Math.abs(hash) % atlasColors.length];
};

const fail = (message) => {
  throw new Error(`School district data validation failed: ${message}`);
};

const validatePosition = (position, context) => {
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
    fail(`${context} contains an invalid longitude/latitude position`);
  }
};

const validateRing = (ring, context) => {
  if (!Array.isArray(ring) || ring.length < 4) {
    fail(`${context} must contain at least four positions`);
  }
  ring.forEach((position, index) =>
    validatePosition(position, `${context}[${index}]`),
  );
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    fail(`${context} is not closed`);
  }
};

const validatePolygonCoordinates = (coordinates, context) => {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    fail(`${context} has no rings`);
  }
  coordinates.forEach((ring, index) =>
    validateRing(ring, `${context}.ring[${index}]`),
  );
};

const validateGeometry = (geometry, context) => {
  if (!geometry || !ALLOWED_GEOMETRY_TYPES.includes(geometry.type)) {
    fail(`${context} must be Polygon or MultiPolygon`);
  }
  if (geometry.type === 'Polygon') {
    validatePolygonCoordinates(geometry.coordinates, context);
  } else {
    if (
      !Array.isArray(geometry.coordinates) ||
      geometry.coordinates.length === 0
    ) {
      fail(`${context} has no polygons`);
    }
    geometry.coordinates.forEach((polygon, index) =>
      validatePolygonCoordinates(polygon, `${context}.polygon[${index}]`),
    );
  }
  const measuredArea = area({ type: 'Feature', properties: {}, geometry });
  if (!Number.isFinite(measuredArea) || measuredArea <= 0) {
    fail(`${context} has no measurable area`);
  }
  return measuredArea;
};

const validateSource = (source, options = {}) => {
  const expectedCount = options.expectedCount;
  if (
    !source ||
    source.type !== 'FeatureCollection' ||
    !Array.isArray(source.features)
  ) {
    fail('source must be a GeoJSON FeatureCollection');
  }
  if (expectedCount != null && source.features.length !== expectedCount) {
    fail(
      `expected ${expectedCount} districts, found ${source.features.length}`,
    );
  }

  const geometryCounts = { Polygon: 0, MultiPolygon: 0 };
  const names = new Set();
  source.features.forEach((feature, index) => {
    if (!feature || feature.type !== 'Feature')
      fail(`feature[${index}] is invalid`);
    const properties = feature.properties;
    if (!properties || typeof properties !== 'object') {
      fail(`feature[${index}] has no properties`);
    }
    REQUIRED_PROPERTIES.forEach((property) => {
      if (
        typeof properties[property] !== 'string' ||
        properties[property].trim() === ''
      ) {
        fail(
          `feature[${index}].properties.${property} must be a non-empty string`,
        );
      }
    });
    const name = properties.SCHOOL_NAM.trim();
    if (names.has(name)) fail(`district name is duplicated: ${name}`);
    names.add(name);
    validateGeometry(feature.geometry, `feature[${index}].geometry`);
    geometryCounts[feature.geometry.type] += 1;
  });

  return {
    districtCount: source.features.length,
    geometryCounts,
    requiredProperties: REQUIRED_PROPERTIES,
  };
};

const selectLabelPolygon = (geometry) => {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  return geometry.coordinates.reduce((largest, candidate) => {
    if (!largest) return candidate;
    const candidateArea = area({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: candidate },
    });
    const largestArea = area({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: largest },
    });
    return candidateArea > largestArea ? candidate : largest;
  }, null);
};

const pointInRing = ([x, y], ring) => {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index, index += 1
  ) {
    const [currentX, currentY] = ring[index];
    const [previousX, previousY] = ring[previous];
    const crosses =
      currentY > y !== previousY > y &&
      x <
        ((previousX - currentX) * (y - currentY)) / (previousY - currentY) +
          currentX;
    if (crosses) inside = !inside;
  }
  return inside;
};

const pointInPolygon = (point, polygon) =>
  pointInRing(point, polygon[0]) &&
  polygon.slice(1).every((hole) => !pointInRing(point, hole));

const normalizedProperties = (properties, color, measuredArea) => ({
  NAME: properties.SCHOOL_NAM.trim(),
  COLOR: color,
  AREA: measuredArea,
  SCHOOL_NAM: properties.SCHOOL_NAM,
  SCHOOL_DIS: properties.SCHOOL_DIS,
  CTY_NAME: properties.CTY_NAME,
  IU_NAME: properties.IU_NAME,
  IU_NUM: properties.IU_NUM,
  AUN_NUM: properties.AUN_NUM,
  AVTS: properties.AVTS,
});

const normalizeSource = (source, provenance, options = {}) => {
  const validation = validateSource(source, options);
  const labels = [];
  const borders = [];

  source.features.forEach((feature) => {
    const measuredArea = area(feature);
    const color = textbookColor(feature.properties.SCHOOL_NAM);
    const properties = normalizedProperties(
      feature.properties,
      color,
      measuredArea,
    );
    const labelPolygon = selectLabelPolygon(feature.geometry);
    const labelCoordinates = polylabel(labelPolygon, 0.01);
    validatePosition(labelCoordinates, `${properties.NAME} label`);
    if (!pointInPolygon(labelCoordinates, labelPolygon)) {
      fail(`${properties.NAME} label is outside its district geometry`);
    }

    borders.push({
      type: 'Feature',
      geometry: feature.geometry,
      properties,
    });
    labels.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: labelCoordinates },
      properties,
    });
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    source: {
      title: provenance.title,
      publisher: provenance.publisher,
      vintage: provenance.vintage,
      sourceUrl: provenance.sourceUrl,
      metadataUrl: provenance.metadataUrl,
      accessConstraints: provenance.accessConstraints,
      license: provenance.license,
      disclaimer: provenance.disclaimer,
      retrievedAt: provenance.retrievedAt,
      sha256: provenance.sha256,
    },
    validation,
    data: {
      labels: { type: 'FeatureCollection', features: labels },
      borders: { type: 'FeatureCollection', features: borders },
    },
    places: { type: 'FeatureCollection', features: [] },
  };
};

const validateArtifact = (artifact, provenance) => {
  if (!artifact || artifact.schemaVersion !== SCHEMA_VERSION) {
    fail(`artifact schemaVersion must be ${SCHEMA_VERSION}`);
  }
  if (!artifact.source || artifact.source.sha256 !== provenance.sha256) {
    fail('artifact source checksum does not match provenance');
  }
  if (artifact.source.vintage !== provenance.vintage) {
    fail('artifact source vintage does not match provenance');
  }
  const borders = artifact.data?.borders;
  const labels = artifact.data?.labels;
  if (
    borders?.type !== 'FeatureCollection' ||
    labels?.type !== 'FeatureCollection'
  ) {
    fail('artifact must contain border and label FeatureCollections');
  }
  if (borders.features.length !== provenance.expectedDistrictCount) {
    fail(
      `artifact expected ${provenance.expectedDistrictCount} borders, found ${borders.features.length}`,
    );
  }
  if (labels.features.length !== borders.features.length) {
    fail('artifact border and label counts differ');
  }
  const geometryCounts = { Polygon: 0, MultiPolygon: 0 };
  borders.features.forEach((feature, index) => {
    REQUIRED_PROPERTIES.forEach((property) => {
      if (typeof feature.properties?.[property] !== 'string') {
        fail(`artifact border[${index}] is missing ${property}`);
      }
    });
    if (
      !Number.isFinite(feature.properties?.AREA) ||
      feature.properties.AREA <= 0
    ) {
      fail(`artifact border[${index}] has invalid AREA`);
    }
    validateGeometry(feature.geometry, `artifact border[${index}].geometry`);
    geometryCounts[feature.geometry.type] += 1;
    const label = labels.features[index];
    if (
      label?.geometry?.type !== 'Point' ||
      label.properties?.NAME !== feature.properties.NAME
    ) {
      fail(`artifact label[${index}] does not match its border`);
    }
    validatePosition(label.geometry.coordinates, `artifact label[${index}]`);
    if (
      !pointInPolygon(
        label.geometry.coordinates,
        selectLabelPolygon(feature.geometry),
      )
    ) {
      fail(`artifact label[${index}] is outside its district geometry`);
    }
  });
  if (
    JSON.stringify(geometryCounts) !== JSON.stringify(provenance.geometryCounts)
  ) {
    fail('artifact geometry mix does not match provenance');
  }
  return { districtCount: borders.features.length, geometryCounts };
};

const parseJsonBuffer = (buffer, context) => {
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    fail(`${context} is not valid JSON: ${error.message}`);
  }
};

const fetchSource = async (url, fetchImpl = fetch) => {
  let response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
  } catch (error) {
    throw new Error(`Unable to fetch PASDA source: ${error.message}`);
  }
  if (!response.ok)
    throw new Error(`Unable to fetch PASDA source: HTTP ${response.status}`);
  const declaredLength = Number(response.headers?.get?.('content-length'));
  if (declaredLength > MAX_SOURCE_BYTES) fail('upstream source exceeds 25 MiB');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_SOURCE_BYTES) fail('upstream source exceeds 25 MiB');
  return buffer;
};

const writeJsonAtomic = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value)}\n`);
  fs.renameSync(temporaryPath, filePath);
};

module.exports = {
  ALLOWED_GEOMETRY_TYPES,
  EXPECTED_DISTRICT_COUNT,
  MAX_SOURCE_BYTES,
  REQUIRED_PROPERTIES,
  SCHEMA_VERSION,
  STALE_AFTER_MONTHS,
  fetchSource,
  normalizeSource,
  parseJsonBuffer,
  sha256,
  validateArtifact,
  validateSource,
  writeJsonAtomic,
};

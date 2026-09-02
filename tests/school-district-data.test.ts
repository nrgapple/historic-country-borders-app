import fs from 'fs';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';

const {
  normalizeSource,
  sha256,
  validateArtifact,
  validateSource,
} = require('../scripts/lib/school-district-data');
const {
  refreshSchoolDistricts,
} = require('../scripts/refresh-school-districts');

const fixturePath = path.join(
  process.cwd(),
  'tests/fixtures/pa-school-districts-source.fixture.geojson',
);
const fixtureBuffer = fs.readFileSync(fixturePath);
const fixture = JSON.parse(fixtureBuffer.toString('utf8'));
const provenance = {
  ...JSON.parse(
    fs.readFileSync('data/pa-school-districts-source.json', 'utf8'),
  ),
  sha256: sha256(fixtureBuffer),
  expectedDistrictCount: 2,
  geometryCounts: { Polygon: 1, MultiPolygon: 1 },
};

describe('school district data pipeline', () => {
  it('pins a representative Polygon and MultiPolygon fixture', () => {
    expect(sha256(fixtureBuffer)).toBe(
      'c05a49de86956e31de43f631c59a44b23a72df0fdbabf4150eefa95a3fa8bfe9',
    );
    expect(validateSource(fixture, { expectedCount: 2 })).toMatchObject({
      districtCount: 2,
      geometryCounts: { Polygon: 1, MultiPolygon: 1 },
    });
  });

  it('normalizes valid borders, areas, and label points deterministically', () => {
    const first = normalizeSource(fixture, provenance, { expectedCount: 2 });
    const second = normalizeSource(fixture, provenance, { expectedCount: 2 });

    expect(first).toEqual(second);
    expect(validateArtifact(first, provenance)).toEqual({
      districtCount: 2,
      geometryCounts: { Polygon: 1, MultiPolygon: 1 },
    });
    expect(first.data.borders.features[1].geometry.type).toBe('MultiPolygon');
    expect(first.data.borders.features[0].properties.AREA).toBeGreaterThan(0);
    expect(
      first.data.labels.features.map((label: any) => label.geometry.type),
    ).toEqual(['Point', 'Point']);
  });

  it('rejects empty, malformed, and unsupported source records explicitly', () => {
    expect(() =>
      validateSource(
        { type: 'FeatureCollection', features: [] },
        { expectedCount: 1 },
      ),
    ).toThrow('expected 1 districts, found 0');

    const missingProperty = structuredClone(fixture);
    delete missingProperty.features[0].properties.SCHOOL_NAM;
    expect(() => validateSource(missingProperty)).toThrow(
      'properties.SCHOOL_NAM must be a non-empty string',
    );

    const malformedGeometry = structuredClone(fixture);
    malformedGeometry.features[0].geometry.coordinates[0].pop();
    expect(() => validateSource(malformedGeometry)).toThrow('is not closed');

    const point = structuredClone(fixture);
    point.features[0].geometry = { type: 'Point', coordinates: [-77, 41] };
    expect(() => validateSource(point)).toThrow(
      'must be Polygon or MultiPolygon',
    );
  });

  it('reports upstream unavailability without replacing durable data', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(refreshSchoolDistricts({ fetchImpl })).rejects.toThrow(
      'Unable to fetch PASDA source: network down',
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

'use strict';

const fs = require('fs');
const path = require('path');
const {
  EXPECTED_DISTRICT_COUNT,
  fetchSource,
  normalizeSource,
  parseJsonBuffer,
  sha256,
  validateArtifact,
  validateSource,
  writeJsonAtomic,
} = require('./lib/school-district-data');

const root = path.resolve(__dirname, '..');
const provenancePath = path.join(root, 'data/pa-school-districts-source.json');
const artifactPath = path.join(root, 'public/data/pa-school-districts.json');
const reportPath = path.join(root, 'data/pa-school-districts-validation.json');

const refreshSchoolDistricts = async ({
  fetchImpl = fetch,
  now = new Date(),
} = {}) => {
  const previousProvenance = JSON.parse(
    fs.readFileSync(provenancePath, 'utf8'),
  );
  const sourceBuffer = await fetchSource(
    previousProvenance.sourceUrl,
    fetchImpl,
  );
  const source = parseJsonBuffer(sourceBuffer, 'PASDA source');
  const sourceValidation = validateSource(source, {
    expectedCount: EXPECTED_DISTRICT_COUNT,
  });
  const provenance = {
    ...previousProvenance,
    retrievedAt: now.toISOString(),
    sha256: sha256(sourceBuffer),
    sourceBytes: sourceBuffer.length,
    expectedDistrictCount: sourceValidation.districtCount,
    requiredProperties: sourceValidation.requiredProperties,
    geometryCounts: sourceValidation.geometryCounts,
  };
  const artifact = normalizeSource(source, provenance, {
    expectedCount: EXPECTED_DISTRICT_COUNT,
  });
  const artifactValidation = validateArtifact(artifact, provenance);
  const artifactJson = `${JSON.stringify(artifact)}\n`;
  const report = {
    validatedAt: now.toISOString(),
    sourceSha256: provenance.sha256,
    sourceBytes: provenance.sourceBytes,
    artifactSha256: sha256(artifactJson),
    artifactBytes: Buffer.byteLength(artifactJson),
    ...artifactValidation,
    requiredProperties: provenance.requiredProperties,
  };

  writeJsonAtomic(artifactPath, artifact);
  writeJsonAtomic(provenancePath, provenance);
  writeJsonAtomic(reportPath, report);
  return report;
};

if (require.main === module) {
  refreshSchoolDistricts()
    .then((report) => {
      console.log(
        `Refreshed ${report.districtCount} districts (${report.artifactBytes} artifact bytes).`,
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = { refreshSchoolDistricts };

'use strict';

const fs = require('fs');
const path = require('path');
const {
  sha256,
  validateArtifact,
  validateSource,
} = require('./lib/school-district-data');

const root = path.resolve(__dirname, '..');

const validateSchoolDistrictData = () => {
  const provenance = JSON.parse(
    fs.readFileSync(
      path.join(root, 'data/pa-school-districts-source.json'),
      'utf8',
    ),
  );
  const fixtureBuffer = fs.readFileSync(
    path.join(root, provenance.fixture.path),
  );
  if (sha256(fixtureBuffer) !== provenance.fixture.sha256) {
    throw new Error(
      'Pinned school district fixture checksum does not match provenance',
    );
  }
  const fixtureValidation = validateSource(
    JSON.parse(fixtureBuffer.toString('utf8')),
    {
      expectedCount: provenance.fixture.districtCount,
    },
  );
  if (
    JSON.stringify(fixtureValidation.geometryCounts) !==
    JSON.stringify(provenance.fixture.geometryCounts)
  ) {
    throw new Error(
      'Pinned school district fixture geometry mix does not match provenance',
    );
  }

  const artifactPath = path.join(root, 'public/data/pa-school-districts.json');
  const artifactBuffer = fs.readFileSync(artifactPath);
  const artifact = JSON.parse(artifactBuffer.toString('utf8'));
  const validation = validateArtifact(artifact, provenance);
  const reportPath = path.join(
    root,
    'data/pa-school-districts-validation.json',
  );
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  if (report.artifactSha256 !== sha256(artifactBuffer)) {
    throw new Error(
      'School district artifact checksum does not match validation report',
    );
  }
  if (report.sourceSha256 !== provenance.sha256) {
    throw new Error(
      'School district source checksum does not match validation report',
    );
  }
  return validation;
};

if (require.main === module) {
  try {
    const validation = validateSchoolDistrictData();
    console.log(
      `Validated ${validation.districtCount} districts (${validation.geometryCounts.Polygon} Polygon, ${validation.geometryCounts.MultiPolygon} MultiPolygon).`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { validateSchoolDistrictData };

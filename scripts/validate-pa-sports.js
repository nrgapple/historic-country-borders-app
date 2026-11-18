'use strict';

/**
 * Offline check of the committed PIAA sports facts (yarn data:validate):
 * the extract's schema, the overrides, and that data/pa-sports.json is
 * exactly what the extract, the overrides and the PASDA districts produce.
 */

const fs = require('fs');
const path = require('path');
const {
  buildSportsArtifact,
  validateExtract,
  validateSportsArtifact,
} = require('./lib/pa-sports');

const root = path.resolve(__dirname, '..');
const read = (file) =>
  JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

const validatePaSports = () => {
  const extract = read('data/pa-sports-schools.json');
  validateExtract(extract);
  const pasda = read(
    'public/data/pa-school-districts.json',
  ).data.borders.features.map((f) => f.properties);
  const overrides = read('data/pa-sports-overrides.json').schoolDistricts;
  const committed = read('data/pa-sports.json');
  const rebuilt = buildSportsArtifact({
    extract,
    pasdaDistricts: pasda,
    overrides,
  });
  if (JSON.stringify(rebuilt) !== JSON.stringify(committed))
    throw new Error(
      'PA sports data: data/pa-sports.json is stale; run yarn data:refresh:pa-sports --join',
    );
  return validateSportsArtifact(committed, pasda);
};

if (require.main === module) {
  try {
    const r = validatePaSports();
    console.log(
      `Validated PIAA sports facts for ${r.districts} districts (${r.withFootball} with a football class, ${r.withPiaa} with a PIAA district, ${r.unmatched} public schools unmatched).`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { validatePaSports };

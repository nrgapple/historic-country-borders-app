/**
 * Offline validation of the Wikidata context pipeline (`yarn
 * data:validate:context`). Rebuilds every per-year context file from the
 * committed mapping, facts snapshot, and border payloads, and fails unless the
 * published files and bundled manifest match byte for byte.
 */
const fs = require('fs');
const path = require('path');
const {
  buildContextFiles,
  contextFileName,
  loadYearSummaries,
  validateContextManifest,
  validateMapping,
  validateSnapshot,
  validateYearContext,
} = require('./lib/historical-context');

const ROOT = path.join(__dirname, '..');
const readJson = (relative) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));

function fail(message) {
  throw new Error(`Historical context validation failed: ${message}`);
}

function main() {
  const summaries = loadYearSummaries(ROOT);
  const names = new Set();
  summaries.forEach((summary) => summary.forEach((_, name) => names.add(name)));

  const mapping = validateMapping(readJson('data/historical-entities.json'), [
    ...names,
  ]);
  const overrides = readJson('data/historical-entity-overrides.json');
  overrides.overrides.forEach((override) => {
    const record = mapping.entities[override.name];
    const expectedStatus = override.qid ? 'matched' : 'none';
    if (
      !record ||
      record.status !== expectedStatus ||
      (override.qid && record.qid !== override.qid)
    )
      fail(
        `override for ${override.name} is not applied; run yarn data:reconcile:context`,
      );
  });

  const snapshot = validateSnapshot(
    readJson('data/historical-context-facts.json'),
    mapping,
  );
  const manifest = validateContextManifest(
    readJson('data/historical-context.json'),
    readJson('data/historical-manifest.json').years,
  );

  const expected = buildContextFiles(summaries, mapping, snapshot);
  let totalBytes = 0;
  let places = 0;
  expected.forEach(({ year, json }) => {
    const url = manifest.years[String(year)];
    if (url !== `/data/context/${contextFileName(year, json)}`)
      fail(
        `${year} does not match the snapshot; run yarn data:refresh:context --offline`,
      );
    const file = path.join(ROOT, 'public', url);
    if (!fs.existsSync(file)) fail(`${year} context file is missing`);
    const content = fs.readFileSync(file, 'utf8');
    if (content !== json) fail(`${year} context file differs from a rebuild`);
    const context = validateYearContext(JSON.parse(content), year);
    totalBytes += Buffer.byteLength(content);
    places += Object.keys(context.places).length;
  });

  const published = new Set(
    Object.values(manifest.years).map((url) => path.basename(url)),
  );
  const stray = fs
    .readdirSync(path.join(ROOT, 'public', 'data', 'context'))
    .filter((file) => !published.has(file));
  if (stray.length) fail(`unreferenced context files: ${stray.join(', ')}`);

  const { summary } = mapping;
  console.log(
    `Historical context is valid (${expected.length} files, ${totalBytes} bytes, ${places} place entries; ${summary.matched}/${summary.names} names matched)`,
  );
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

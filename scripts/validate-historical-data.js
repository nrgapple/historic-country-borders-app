const fs = require('fs');
const path = require('path');
const routeManifest = require('../data/historical-manifest.json');
const assetManifest = require('../data/historical-assets.json');
const {
  countFallbackRings,
  sha256,
  validateNameOverrides,
  validatePayload,
} = require('./lib/historical-data');
const {
  SPLIT_KINDS,
  buildSplitAssetsFromRoot,
} = require('./lib/historical-split');
const { publishedHistoricalFiles } = require('./build-historical-split');

const ROOT = path.join(__dirname, '..');

function fail(message) {
  throw new Error(`Historical data validation failed: ${message}`);
}

function main() {
  if (assetManifest.schemaVersion !== 1)
    fail('unsupported asset manifest schema');
  if (assetManifest.source.commit !== routeManifest.source.commit)
    fail('source commit mismatch');
  if (!/^[a-f0-9]{40}$/.test(assetManifest.source.commit))
    fail('source is not pinned to a full commit');
  if (!/^[a-f0-9]{64}$/.test(assetManifest.source.places?.sha256 || ''))
    fail('places source hash is missing');
  const overridesPath = path.join(
    ROOT,
    'data',
    'historical-place-overrides.json',
  );
  if (
    !fs.existsSync(overridesPath) ||
    sha256(fs.readFileSync(overridesPath, 'utf8')) !==
      assetManifest.source.placeOverrides?.sha256
  ) {
    fail(
      'place overrides changed since the last refresh; run yarn data:refresh:historical',
    );
  }
  const nameOverridesPath = path.join(
    ROOT,
    'data',
    'historical-name-overrides.json',
  );
  if (
    !fs.existsSync(nameOverridesPath) ||
    sha256(fs.readFileSync(nameOverridesPath, 'utf8')) !==
      assetManifest.source.nameOverrides?.sha256
  ) {
    fail(
      'name overrides changed since the last refresh; run yarn data:refresh:historical',
    );
  }
  // Structure only: matching against source records happens on refresh.
  try {
    validateNameOverrides(
      JSON.parse(fs.readFileSync(nameOverridesPath, 'utf8')),
    );
  } catch (error) {
    fail(error.message);
  }
  const placeClassesPath = path.join(
    ROOT,
    'data',
    'historical-place-classes.json',
  );
  if (
    !fs.existsSync(placeClassesPath) ||
    sha256(fs.readFileSync(placeClassesPath, 'utf8')) !==
      assetManifest.source.placeClasses?.sha256
  ) {
    fail(
      'place classes changed since the last refresh; run yarn data:refresh:historical',
    );
  }
  if (
    assetManifest.source.license !== routeManifest.source.license ||
    assetManifest.source.licenseSha256 !== routeManifest.source.licenseSha256 ||
    assetManifest.source.licenseUrl !== routeManifest.source.licenseUrl ||
    !assetManifest.source.provenanceNote
  ) {
    fail('source license or provenance is missing');
  }

  const licensePath = path.join(
    ROOT,
    'public',
    'data',
    'historical',
    'LICENSE-GPL-3.0.txt',
  );
  if (
    !fs.existsSync(licensePath) ||
    sha256(fs.readFileSync(licensePath)) !== routeManifest.source.licenseSha256
  ) {
    fail('pinned GPL-3.0 license copy is missing or changed');
  }

  const expectedYears = routeManifest.years.map(String);
  const actualYears = Object.keys(assetManifest.assets);
  if (
    actualYears.length !== expectedYears.length ||
    expectedYears.some((year) => !actualYears.includes(year))
  ) {
    fail('asset years do not match route years');
  }

  let totalBytes = 0;
  let fallbackRings = 0;
  for (const year of expectedYears) {
    const asset = assetManifest.assets[year];
    if (
      !asset?.url?.match(/^\/data\/historical\/[a-z0-9]+\.[a-f0-9]{16}\.json$/)
    ) {
      fail(`${year} has a non-immutable asset URL`);
    }
    const destination = path.join(ROOT, 'public', asset.url);
    if (!fs.existsSync(destination)) fail(`${year} asset is missing`);
    const content = fs.readFileSync(destination);
    if (content.byteLength !== asset.bytes) fail(`${year} byte count mismatch`);
    if (sha256(content) !== asset.sha256) fail(`${year} hash mismatch`);
    if (!asset.url.includes(asset.sha256.slice(0, 16)))
      fail(`${year} URL hash mismatch`);
    if (!/^[a-f0-9]{64}$/.test(asset.source?.sha256 || ''))
      fail(`${year} source hash is missing`);
    const payload = validatePayload(JSON.parse(content), `year ${year}`);
    if (
      payload.data.borders.features.length !== asset.counts?.borders ||
      payload.data.labels.features.length !== asset.counts?.labels ||
      payload.places.features.length !== asset.counts?.places ||
      payload.data.labels.features.filter(
        (feature) => feature.properties.AREA <= 0,
      ).length !== asset.counts?.zeroAreaBorders
    ) {
      fail(`${year} feature counts mismatch`);
    }
    totalBytes += content.byteLength;
    fallbackRings += countFallbackRings(payload);
  }

  if (fallbackRings !== assetManifest.roundingFallbackRings)
    fail('rounding fallback ring count mismatch');

  const split = validateSplitFiles(expectedYears);

  const published = publishedHistoricalFiles(ROOT);
  const stray = fs
    .readdirSync(path.join(ROOT, 'public', 'data', 'historical'))
    .filter((file) => !published.has(file));
  if (stray.length) fail(`unreferenced historical files: ${stray.join(', ')}`);

  console.log(
    `Historical data is valid (${expectedYears.length} payloads, ${totalBytes} bytes, ${fallbackRings} unrounded fallback rings; ${split.files} split files, ${split.bytes} bytes, rebuilt offline)`,
  );
}

/**
 * Offline rebuild check: the split files must equal, byte for byte, what the
 * builder derives from the committed payloads and place classes. The builder
 * also validates winding, ids, names, dependencies, and place kinds.
 */
function validateSplitFiles(expectedYears) {
  const manifestPath = path.join(ROOT, 'data', 'historical-split-assets.json');
  if (!fs.existsSync(manifestPath)) fail('split asset manifest is missing');
  const committed = fs.readFileSync(manifestPath, 'utf8');
  let rebuilt;
  try {
    rebuilt = buildSplitAssetsFromRoot(ROOT);
  } catch (error) {
    fail(`split files cannot be rebuilt: ${error.message}`);
  }
  const years = Object.keys(JSON.parse(committed).years || {});
  if (
    years.length !== expectedYears.length ||
    expectedYears.some((year) => !years.includes(year))
  )
    fail('split years do not match route years');
  if (committed !== rebuilt.manifestJson)
    fail(
      'split manifest differs from an offline rebuild; run yarn data:build:historical-split',
    );
  let bytes = 0;
  rebuilt.files.forEach(({ name, json }) => {
    const file = path.join(ROOT, 'public', 'data', 'historical', name);
    if (!fs.existsSync(file)) fail(`split file ${name} is missing`);
    if (fs.readFileSync(file, 'utf8') !== json)
      fail(`split file ${name} differs from an offline rebuild`);
    bytes += Buffer.byteLength(json);
  });
  if (rebuilt.files.length !== expectedYears.length * SPLIT_KINDS.length)
    fail('split file count mismatch');
  return { files: rebuilt.files.length, bytes };
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

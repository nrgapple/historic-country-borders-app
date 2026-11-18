const fs = require('fs');
const path = require('path');
const manifest = require('../data/historical-manifest.json');
const {
  applyPlaceOverrides,
  buildPayload,
  countFallbackRings,
  sha256,
  sourceYear,
  validateBorderSource,
  validatePayload,
  validatePlacesSource,
} = require('./lib/historical-data');
const { validatePlaceClassesAgainstPlaces } = require('./lib/historical-split');
const { buildAndWrite } = require('./build-historical-split');

const ROOT = path.join(__dirname, '..');
const ASSET_DIRECTORY = path.join(ROOT, 'public', 'data', 'historical');
const ASSET_MANIFEST = path.join(ROOT, 'data', 'historical-assets.json');
const PLACE_OVERRIDES_PATH = path.join(
  ROOT,
  'data',
  'historical-place-overrides.json',
);
const PLACE_CLASSES_PATH = path.join(
  ROOT,
  'data',
  'historical-place-classes.json',
);
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const CONCURRENCY = 4;

async function fetchPinnedFile(relativePath) {
  const { repository, commit } = manifest.source;
  const url = `https://raw.githubusercontent.com/${repository}/${commit}/${relativePath}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'HistoricBorders/1.0 controlled data refresh' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new Error(`${relativePath}: upstream returned ${response.status}`);
  const declaredBytes = Number(response.headers.get('content-length'));
  if (declaredBytes > MAX_SOURCE_BYTES)
    throw new Error(`${relativePath}: source exceeds byte limit`);
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_SOURCE_BYTES)
    throw new Error(`${relativePath}: source exceeds byte limit`);
  return {
    url,
    text,
    sha256: sha256(text),
    bytes: Buffer.byteLength(text),
  };
}

async function fetchPinnedJson(fileName) {
  const source = await fetchPinnedFile(
    `${manifest.source.directory}/${fileName}`,
  );
  return { ...source, value: JSON.parse(source.text) };
}

function writeAtomically(destination, content) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, content);
  fs.renameSync(temporary, destination);
}

async function mapWithConcurrency(values, worker) {
  const results = new Array(values.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, values.length) }, async () => {
      while (next < values.length) {
        const index = next;
        next += 1;
        results[index] = await worker(values[index], index);
      }
    }),
  );
  return results;
}

async function main() {
  if (!/^[a-f0-9]{40}$/.test(manifest.source.commit)) {
    throw new Error('Historical source must be pinned to a full Git commit');
  }
  if (!Array.isArray(manifest.years) || manifest.years.length === 0) {
    throw new Error('Historical manifest has no years');
  }

  console.log(
    `Fetching pinned historical license and places at ${manifest.source.commit}...`,
  );
  const [licenseSource, placesSource] = await Promise.all([
    fetchPinnedFile('LICENSE'),
    fetchPinnedJson('places.geojson'),
  ]);
  if (licenseSource.sha256 !== manifest.source.licenseSha256) {
    throw new Error(
      'Pinned historical license hash does not match the manifest',
    );
  }
  writeAtomically(
    path.join(ASSET_DIRECTORY, 'LICENSE-GPL-3.0.txt'),
    licenseSource.text,
  );
  validatePlacesSource(placesSource.value);
  const overrideText = fs.readFileSync(PLACE_OVERRIDES_PATH, 'utf8');
  const places = applyPlaceOverrides(
    placesSource.value,
    JSON.parse(overrideText),
  );
  // Reviewed archaeological-site classes must each match exactly one dated
  // upstream place (after end-date overrides), like the overrides themselves.
  const placeClassesText = fs.readFileSync(PLACE_CLASSES_PATH, 'utf8');
  validatePlaceClassesAgainstPlaces(places, JSON.parse(placeClassesText));

  // Recorded once at manifest level: the browser bundles this manifest, so
  // per-year review-only counts would add to every route's JavaScript.
  let roundingFallbackRings = 0;
  const assets = await mapWithConcurrency(manifest.years, async (year) => {
    const fileName = `world_${sourceYear(year)}.geojson`;
    console.log(`Refreshing ${fileName}...`);
    const borderSource = await fetchPinnedJson(fileName);
    validateBorderSource(borderSource.value, fileName);
    const payload = validatePayload(
      buildPayload(year, borderSource.value, places),
      fileName,
    );
    const fallbackRings = countFallbackRings(payload);
    if (fallbackRings > 0)
      console.log(`${fileName}: kept ${fallbackRings} unrounded ring(s)`);
    roundingFallbackRings += fallbackRings;
    const json = `${JSON.stringify(payload)}\n`;
    const digest = sha256(json);
    const assetName = `${sourceYear(year)}.${digest.slice(0, 16)}.json`;
    writeAtomically(path.join(ASSET_DIRECTORY, assetName), json);
    return [
      String(year),
      {
        url: `/data/historical/${assetName}`,
        sha256: digest,
        bytes: Buffer.byteLength(json),
        source: {
          file: fileName,
          sha256: borderSource.sha256,
          bytes: borderSource.bytes,
        },
        counts: {
          borders: payload.data.borders.features.length,
          labels: payload.data.labels.features.length,
          places: payload.places.features.length,
          zeroAreaBorders: payload.data.labels.features.filter(
            (feature) => feature.properties.AREA <= 0,
          ).length,
        },
      },
    ];
  });

  const nextManifest = {
    schemaVersion: 1,
    source: {
      ...manifest.source,
      placeOverrides: {
        file: 'data/historical-place-overrides.json',
        sha256: sha256(overrideText),
      },
      placeClasses: {
        file: 'data/historical-place-classes.json',
        sha256: sha256(placeClassesText),
      },
      places: {
        file: 'places.geojson',
        sha256: placesSource.sha256,
        bytes: placesSource.bytes,
      },
    },
    refreshedAt: new Date().toISOString(),
    roundingFallbackRings,
    assets: Object.fromEntries(assets),
  };
  writeAtomically(ASSET_MANIFEST, `${JSON.stringify(nextManifest, null, 2)}\n`);

  // Derive the split per-year files from the new payloads, then remove
  // superseded files so only the published hashes ship. Previous Worker
  // versions keep their own asset copies for rollback.
  const split = buildAndWrite(ROOT);
  console.log(
    `Published ${split.files.length} split files; removed ${split.removed.length} superseded file(s)`,
  );
  console.log(
    `Kept ${roundingFallbackRings} unrounded ring(s) that would collapse when rounded`,
  );
  console.log(
    `Published ${assets.length} immutable historical payloads and ${ASSET_MANIFEST}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

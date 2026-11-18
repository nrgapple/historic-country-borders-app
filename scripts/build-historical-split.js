/**
 * Offline: rebuilds the split per-year files (polygons, labels, index) from
 * the committed combined payloads and data/historical-place-classes.json,
 * writes data/historical-split-assets.json, and removes unreferenced files.
 * `yarn data:refresh:historical` runs this after publishing new payloads; run
 * it directly (`yarn data:build:historical-split`) after editing place classes.
 */
const fs = require('fs');
const path = require('path');
const { buildSplitAssetsFromRoot } = require('./lib/historical-split');

const ROOT = path.join(__dirname, '..');
const ASSET_DIRECTORY = path.join(ROOT, 'public', 'data', 'historical');
const SPLIT_MANIFEST = path.join(ROOT, 'data', 'historical-split-assets.json');

function writeAtomically(destination, content) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, content);
  fs.renameSync(temporary, destination);
}

/** File names every committed historical manifest references. */
function publishedHistoricalFiles(root) {
  const read = (file) =>
    JSON.parse(fs.readFileSync(path.join(root, 'data', file), 'utf8'));
  const names = new Set(['LICENSE-GPL-3.0.txt']);
  Object.values(read('historical-assets.json').assets).forEach((asset) =>
    names.add(path.basename(asset.url)),
  );
  const splitPath = path.join(root, 'data', 'historical-split-assets.json');
  if (fs.existsSync(splitPath)) {
    Object.values(read('historical-split-assets.json').years).forEach((entry) =>
      ['polygons', 'labels', 'index'].forEach((kind) =>
        names.add(path.basename(entry[kind].url)),
      ),
    );
  }
  return names;
}

function removeUnpublished(root) {
  const published = publishedHistoricalFiles(root);
  const directory = path.join(root, 'public', 'data', 'historical');
  const removed = fs
    .readdirSync(directory)
    .filter((file) => !published.has(file));
  removed.forEach((file) => fs.unlinkSync(path.join(directory, file)));
  return removed;
}

function buildAndWrite(root = ROOT) {
  const { files, manifest, manifestJson } = buildSplitAssetsFromRoot(root);
  files.forEach(({ name, json }) =>
    writeAtomically(
      path.join(root, 'public', 'data', 'historical', name),
      json,
    ),
  );
  writeAtomically(
    path.join(root, 'data', 'historical-split-assets.json'),
    manifestJson,
  );
  const removed = removeUnpublished(root);
  return { files, manifest, removed };
}

module.exports = { buildAndWrite, publishedHistoricalFiles, removeUnpublished };

if (require.main === module) {
  try {
    const { files, manifest, removed } = buildAndWrite();
    const totals = Object.values(manifest.years).reduce(
      (sum, entry) => {
        sum.sites += entry.counts.sites;
        sum.dependencies += entry.counts.dependencies;
        sum.unnamed += entry.counts.unnamedPolygons;
        sum.fromAbbreviation += entry.counts.namedFromAbbreviation;
        return sum;
      },
      { sites: 0, dependencies: 0, unnamed: 0, fromAbbreviation: 0 },
    );
    console.log(
      `Wrote ${files.length} split files to ${path.relative(ROOT, ASSET_DIRECTORY)} and ${path.relative(ROOT, SPLIT_MANIFEST)}; removed ${removed.length} unreferenced file(s)`,
    );
    console.log(
      `Place-years drawn as sites: ${totals.sites}; dependencies: ${totals.dependencies}; unnamed polygons: ${totals.unnamed}; polygons named from ABBREVN: ${totals.fromAbbreviation}`,
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

// Per-year map data for the remaster, from T1's committed split files
// (docs/HISTORICAL_DATA.md "Split year files", docs/HISTORICAL_CONTEXT.md
// "Capital points"). Nothing is converted here: the files are validated and
// content-hashed by `yarn data:validate`; this step copies the ones the
// remaster serves and writes the small manifest the app bundles.
//
//   public/data/historical/<year>.{polygons,labels,index}.<hash>.json
//   public/data/context/*                     Wikidata context and capitals
//   src/data/years.json                       year -> URLs (~10 KB, bundled)
//   src/data/sources.json                     provenance for About and credits
//
// Offline and deterministic: reads only ../data and ../public/data.
import fs from 'node:fs';
import path from 'node:path';
import { APP, REPO, readJson, writeFile } from './lib.mjs';

const split = readJson(path.join(REPO, 'data/historical-split-assets.json'));
const capitals = readJson(path.join(REPO, 'data/historical-capitals.json'));
const manifestSource = readJson(
  path.join(REPO, 'data/historical-manifest.json'),
);
const contextManifest = readJson(
  path.join(REPO, 'data/historical-context.json'),
);

const years = manifestSource.years;
const missing = years.filter((year) => !split.years[String(year)]);
if (missing.length)
  throw new Error(
    `No split files for ${missing.join(', ')}: run yarn data:build:historical-split`,
  );

const out = path.join(APP, 'public/data/historical');
fs.rmSync(out, { recursive: true, force: true });
// The stand-in's former output directory, if an older checkout left it.
fs.rmSync(path.join(APP, 'public/data/years'), {
  recursive: true,
  force: true,
});

const copy = (url) => {
  const source = path.join(REPO, 'public', url);
  if (!fs.existsSync(source))
    throw new Error(`Missing ${url}: the split manifest and public/ disagree`);
  writeFile(path.join(APP, 'public', url), fs.readFileSync(source));
};

const files = {};
for (const year of years) {
  const entry = split.years[String(year)];
  for (const kind of ['polygons', 'labels', 'index']) copy(entry[kind].url);
  files[year] = {
    map: entry.polygons.url,
    labels: entry.labels.url,
    index: entry.index.url,
    context: contextManifest.years[String(year)] ?? null,
    capitals: capitals.years[String(year)]?.url ?? null,
  };
}
fs.copyFileSync(
  path.join(REPO, 'public/data/historical/LICENSE-GPL-3.0.txt'),
  path.join(out, 'LICENSE-GPL-3.0.txt'),
);

// Wikidata context and capital points are already static, hashed and validated.
const contextOut = path.join(APP, 'public/data/context');
fs.rmSync(contextOut, { recursive: true, force: true });
fs.cpSync(path.join(REPO, 'public/data/context'), contextOut, {
  recursive: true,
});

writeFile(
  path.join(APP, 'src/data/years.json'),
  JSON.stringify({ years, files }),
);
writeFile(
  path.join(APP, 'src/data/sources.json'),
  JSON.stringify({
    historical: manifestSource.source,
    context: contextManifest.source ?? null,
  }),
);
console.log(
  `data: ${years.length} years of T1 split files -> ${path.relative(APP, out)}`,
);

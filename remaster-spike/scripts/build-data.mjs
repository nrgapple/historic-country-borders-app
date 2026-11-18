// Copies T1's committed, validated split year files into the spike:
//   /data/years/<year>.polygons.<hash>.json  border polygons {id; c, dep, ov, oc}
//   /data/years/<year>.labels.<hash>.json    label points {id; n, a} and places {p, k}
//   /data/years/<year>.capitals.<hash>.json  capital points {name, t, qid}
//   /data/years/<year>.index.<hash>.json     territory facts for the finder/panel,
//       converted to the spike's compact tuple form (its throwaway UI reads it)
//   src/data/years.json  year -> URLs (bundled; ~5 KB)
// Offline and deterministic: reads only ../data and ../public/data, which
// `yarn data:validate` in the repo root checks byte for byte (docs/HISTORICAL_DATA.md).
import fs from 'node:fs';
import path from 'node:path';
import { REPO, SPIKE, hash16 } from './lib.mjs';

const split = JSON.parse(
  fs.readFileSync(path.join(REPO, 'data/historical-split-assets.json'), 'utf8'),
).years;
const capitals = JSON.parse(
  fs.readFileSync(path.join(REPO, 'data/historical-capitals.json'), 'utf8'),
).years;
const outDir = path.join(SPIKE, 'public/data/years');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const copy = (url) => {
  const name = path.basename(url);
  fs.copyFileSync(path.join(REPO, 'public', url), path.join(outDir, name));
  return `/data/years/${name}`;
};

const manifest = {};
const years = Object.keys(split)
  .map(Number)
  .sort((a, b) => a - b);
for (const year of years) {
  const y = split[year];
  const cap = capitals[year];
  if (!cap)
    throw new Error(
      `${year}: no capitals file in data/historical-capitals.json`,
    );
  // The spike's finder and panel read [name, partOf, subjectTo, precision, bbox], indexed by id.
  const index = JSON.parse(
    fs.readFileSync(path.join(REPO, 'public', y.index.url), 'utf8'),
  );
  const territories = [];
  for (const t of index.territories) {
    territories[t.id] = [
      t.NAME,
      t.PARTOF ?? null,
      t.SUBJECTO ?? null,
      t.BORDERPRECISION ?? null,
      t.bbox,
    ];
  }
  const compact = Buffer.from(JSON.stringify({ year, territories }));
  const indexName = `${year}.index.${hash16(compact)}.json`;
  fs.writeFileSync(path.join(outDir, indexName), compact);
  manifest[year] = {
    map: copy(y.polygons.url),
    labels: copy(y.labels.url),
    capitals: copy(cap.url),
    index: `/data/years/${indexName}`,
  };
}
fs.mkdirSync(path.join(SPIKE, 'src/data'), { recursive: true });
fs.writeFileSync(
  path.join(SPIKE, 'src/data/years.json'),
  JSON.stringify({ years, files: manifest }),
);
fs.copyFileSync(
  path.join(REPO, 'public/data/historical/LICENSE-GPL-3.0.txt'),
  path.join(outDir, 'LICENSE-GPL-3.0.txt'),
);
console.log(
  `copied ${years.length} years of T1 split files to ${path.relative(SPIKE, outDir)}`,
);

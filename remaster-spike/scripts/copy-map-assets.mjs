// Copies the committed T2 basemap (tiles, relief, globe land) and T3 map fonts
// (glyph PBFs, alias/projector CSS, WOFF2 files, licenses) from the repo's
// public/ into the spike's public/, at the same URLs the manifests publish.
// Offline: the repo's `yarn data:validate` checks these files byte for byte.
import fs from 'node:fs';
import path from 'node:path';
import { REPO, SPIKE } from './lib.mjs';

const basemap = JSON.parse(
  fs.readFileSync(path.join(REPO, 'data/basemap-manifest.json'), 'utf8'),
);
const fonts = JSON.parse(
  fs.readFileSync(path.join(REPO, 'data/map-fonts.json'), 'utf8'),
);

const dirs = [
  path.dirname(basemap.tiles.url.split('{z}')[0] + 'x'), // /tiles/basemap/<build>
  path.dirname(basemap.relief.url), // /basemap/<build> (relief + globe land)
  basemap.globe ? path.dirname(basemap.globe.url) : null,
  fonts.glyphs.url.split('/{fontstack}')[0], // /glyphs/<buildId>
  '/fonts', // map-aliases.css, projector.css, atlas.css, files/, licenses/
].filter(Boolean);

let files = 0;
for (const dir of [...new Set(dirs)]) {
  const from = path.join(REPO, 'public', dir);
  const to = path.join(SPIKE, 'public', dir);
  if (!fs.existsSync(from))
    throw new Error(
      `missing ${path.relative(REPO, from)}; run the repo's data refresh`,
    );
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  files += fs.readdirSync(to, { recursive: true }).length;
}
console.log(
  `copied T2/T3 map assets (${files} entries): ${[...new Set(dirs)].join(', ')}`,
);

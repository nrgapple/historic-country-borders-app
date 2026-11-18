// Copies shared static files into remaster/public so one source stays
// authoritative: favicons and the web manifest from the repository's public/,
// and the self-hosted UI font files plus their OFL licenses from @fontsource.
//
// T3 ADAPTER (UI fonts): when T3 publishes its WOFF2 directory, point FONTS
// below at it (or delete this block and update src/styles/fonts.css paths).
import fs from 'node:fs';
import path from 'node:path';
import { APP, REPO } from './lib.mjs';

const SHARED = [
  'favicon.ico',
  'favicon-96x96.png',
  'apple-touch-icon.png',
  'icon.svg',
  'manifest.json',
  // Replaced by a Direction A card when the design sign-off asks for one.
  'og-image.png',
];
for (const name of SHARED)
  fs.copyFileSync(path.join(REPO, 'public', name), path.join(APP, 'public', name));

// T2: the committed basemap build (tiles, relief, globe land), by manifest path.
const basemap = JSON.parse(fs.readFileSync(path.join(REPO, 'data/basemap-manifest.json'), 'utf8'));
for (const dir of ['public/tiles', 'public/basemap'])
  fs.rmSync(path.join(APP, dir), { recursive: true, force: true });
for (const rel of [basemap.tiles.path, path.dirname(basemap.relief.path)])
  fs.cpSync(path.join(REPO, rel), path.join(APP, rel), { recursive: true });
fs.rmSync(path.join(APP, 'public/basemap-standin'), { recursive: true, force: true });
fs.rmSync(path.join(APP, 'public/relief-standin'), { recursive: true, force: true });

const FONTS = {
  alegreya: ['400-normal', '500-normal', '700-normal', '400-italic', '500-italic'],
  'alegreya-sc': ['500-normal', '700-normal'],
  'atkinson-hyperlegible-next': ['400-normal', '500-normal', '700-normal'],
};
const out = path.join(APP, 'public/fonts');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
let count = 0;
for (const [family, cuts] of Object.entries(FONTS)) {
  const pkg = path.join(APP, 'node_modules/@fontsource', family);
  for (const cut of cuts)
    for (const subset of ['latin', 'latin-ext']) {
      const file = `${family}-${subset}-${cut}.woff2`;
      fs.copyFileSync(path.join(pkg, 'files', file), path.join(out, file));
      count += 1;
    }
  fs.copyFileSync(path.join(pkg, 'LICENSE'), path.join(out, `LICENSE-${family}.txt`));
}
console.log(`public: ${SHARED.length} shared files, ${count} font files`);

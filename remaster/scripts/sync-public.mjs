// Copies shared static files into remaster/public so one source stays
// authoritative: favicons and the web manifest from the repository's public/,
// T2's basemap build, and T3's fonts and glyphs, all committed and validated
// by `yarn data:validate`. Offline.
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

// T3: self-hosted WOFF2s, their three @font-face CSS files and licenses, and
// the map glyph PBFs (docs/FONTS.md). Only the few fields the app needs are
// bundled, as src/data/fonts.json; data/map-fonts.json itself is ~large.
const fonts = JSON.parse(fs.readFileSync(path.join(REPO, 'data/map-fonts.json'), 'utf8'));
for (const dir of ['public/fonts', 'public/glyphs'])
  fs.rmSync(path.join(APP, dir), { recursive: true, force: true });
fs.cpSync(path.join(REPO, 'public/fonts'), path.join(APP, 'public/fonts'), { recursive: true });
const glyphBuild = fonts.glyphs.url.split('/')[2];
fs.cpSync(path.join(REPO, 'public/glyphs', glyphBuild), path.join(APP, 'public/glyphs', glyphBuild), {
  recursive: true,
});
fs.rmSync(path.join(APP, 'public/glyphs-standin'), { recursive: true, force: true });
fs.writeFileSync(
  path.join(APP, 'src/data/fonts.json'),
  JSON.stringify({
    glyphsUrl: fonts.glyphs.url,
    fontstacks: Object.keys(fonts.glyphs.fontstacks),
    css: Object.fromEntries(Object.entries(fonts.fonts.css).map(([k, v]) => [k, v.path])),
    licenses: fonts.licenses.map(({ font, path: href }) => ({ font, href })),
  }),
);
console.log(`public: ${SHARED.length} shared files, T3 fonts and glyphs (${glyphBuild})`);

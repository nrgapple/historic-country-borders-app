// Copies the committed static files the site ships from public/ into the
// build's staging directory (SITE, Astro's publicDir): favicons, the web
// manifest, _headers, T2's basemap build, and T3's fonts and glyphs, all
// committed and validated by `yarn data:validate`. public/ also holds data
// that must not ship (combined year payloads, the PASDA source artifact),
// so it is never Astro's publicDir. Offline.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SITE } from './lib/app.mjs';

const SHARED = [
  // Cloudflare cache and content-type rules (checked by data:validate:fonts).
  '_headers',
  'favicon.ico',
  'favicon-96x96.png',
  'apple-touch-icon.png',
  'icon.svg',
  'manifest.json',
  // Replaced by a Direction A card when the design sign-off asks for one.
  'og-image.png',
];
fs.mkdirSync(SITE, { recursive: true });
for (const name of SHARED)
  fs.copyFileSync(path.join(ROOT, 'public', name), path.join(SITE, name));

// T2: the committed basemap build (tiles, relief, globe land), by manifest path.
const basemap = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data/basemap-manifest.json'), 'utf8'),
);
for (const dir of ['tiles', 'basemap'])
  fs.rmSync(path.join(SITE, dir), { recursive: true, force: true });
// Manifest paths are repository-relative (public/...); SITE mirrors public/.
const inSite = (rel) => path.join(SITE, path.relative('public', rel));
for (const rel of [basemap.tiles.path, path.dirname(basemap.relief.path)])
  fs.cpSync(path.join(ROOT, rel), inSite(rel), { recursive: true });

// T3: self-hosted WOFF2s, their three @font-face CSS files and licenses, and
// the map glyph PBFs (docs/FONTS.md). Only the few fields the app needs are
// bundled, as src/data/fonts.json; data/map-fonts.json itself is ~large.
const fonts = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data/map-fonts.json'), 'utf8'),
);
for (const dir of ['fonts', 'glyphs'])
  fs.rmSync(path.join(SITE, dir), { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'public/fonts'), path.join(SITE, 'fonts'), {
  recursive: true,
});
const glyphBuild = fonts.glyphs.url.split('/')[2];
fs.cpSync(
  path.join(ROOT, 'public/glyphs', glyphBuild),
  path.join(SITE, 'glyphs', glyphBuild),
  {
    recursive: true,
  },
);
fs.writeFileSync(
  path.join(ROOT, 'src/data/fonts.json'),
  JSON.stringify({
    glyphsUrl: fonts.glyphs.url,
    fontstacks: Object.keys(fonts.glyphs.fontstacks),
    css: Object.fromEntries(
      Object.entries(fonts.fonts.css).map(([k, v]) => [k, v.path]),
    ),
    licenses: fonts.licenses.map(({ font, path: href }) => ({ font, href })),
  }),
);
console.log(
  `public: ${SHARED.length} shared files, T3 fonts and glyphs (${glyphBuild})`,
);

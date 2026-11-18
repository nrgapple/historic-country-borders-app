// Map label fonts, all first-party:
// 1. Source Serif 4 WOFF2 (latin + latin-ext, SIL OFL 1.1, from @fontsource)
//    rendered by MapLibre >= 6.7 through the style's `font-faces`;
// 2. fallback SDF glyph PBFs (Noto Sans Medium, SIL OFL 1.1, from
//    protomaps/basemaps-assets) for characters outside those ranges, published
//    under the same fontstack name. Only ranges used by published names are copied.
// Downloads are cached on the SSD (~/LargeFiles/historic-borders-remaster).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SPIKE } from './lib.mjs';

const COMMIT = process.env.GLYPHS_COMMIT || 'main';
const FONTS = ['Noto Sans Medium'];
const cache = path.join(os.homedir(), 'LargeFiles/historic-borders-remaster/glyphs', COMMIT);
const out = path.join(SPIKE, 'public/glyphs');
const STACK = 'Atlas Labels';
const fontsOut = path.join(SPIKE, 'public/fonts');
fs.rmSync(fontsOut, { recursive: true, force: true });
fs.mkdirSync(fontsOut, { recursive: true });
for (const subset of ['latin', 'latin-ext']) {
  fs.copyFileSync(path.join(SPIKE, `node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-${subset}-wght-normal.woff2`), path.join(fontsOut, `source-serif-4-${subset}.woff2`));
}
fs.copyFileSync(path.join(SPIKE, 'node_modules/@fontsource-variable/source-serif-4/LICENSE'), path.join(fontsOut, 'LICENSE-OFL.txt'));

const ranges = new Set();
const dir = path.join(SPIKE, 'public/data/years');
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.labels.geojson'))) {
  for (const ft of JSON.parse(fs.readFileSync(path.join(dir, f))).features) {
    const s = ft.properties.n || ft.properties.p;
    if (s) for (const ch of s) ranges.add(Math.floor(ch.codePointAt(0) / 256) * 256);
  }
}
fs.rmSync(out, { recursive: true, force: true });
let bytes = 0, files = 0;
for (const font of FONTS) {
  fs.mkdirSync(path.join(out, STACK), { recursive: true });
  fs.mkdirSync(path.join(cache, font), { recursive: true });
  for (const start of [...ranges].sort((a, b) => a - b)) {
    const name = `${start}-${start + 255}.pbf`;
    const cached = path.join(cache, font, name);
    if (!fs.existsSync(cached)) {
      const url = `https://raw.githubusercontent.com/protomaps/basemaps-assets/${COMMIT}/fonts/${encodeURIComponent(font)}/${name}`;
      const res = await fetch(url);
      if (!res.ok) { console.warn(`skip ${font} ${name}: ${res.status}`); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 2 * 1024 * 1024) throw new Error(`unexpectedly large glyph file ${url}`);
      fs.writeFileSync(cached, buf);
    }
    fs.copyFileSync(cached, path.join(out, STACK, name));
    bytes += fs.statSync(cached).size; files += 1;
  }
}
fs.writeFileSync(path.join(out, 'OFL.txt'), 'Noto Sans glyphs: SIL Open Font License 1.1. Source: https://github.com/protomaps/basemaps-assets\n');
console.log(`glyphs: ${files} files, ${bytes} bytes, ranges ${[...ranges].sort((a, b) => a - b).join(',')}`);

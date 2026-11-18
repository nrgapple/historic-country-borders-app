// STAND-INS for tracks that have not landed yet, built offline from the design
// spike's committed data (design/living-atlas/data, OFL fonts). Each follows
// the contract the real track will publish, so switching is a one-line URL
// change in src/adapters/* (see README "Adapters"). T2's basemap landed and
// is copied by scripts/sync-public.mjs instead.
//
//   T3  public/glyphs-standin/{fontstack}/{range}.pbf   SDF glyphs per stack,
//       plus Noto Sans fallback ranges (from the spike's SSD cache) for the
//       non-Latin characters in published names, when that cache exists.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { APP, REPO, writeFile } from './lib.mjs';

const DESIGN = path.join(REPO, 'design/living-atlas/data');
const loadGlobal = (file, name) => {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(DESIGN, file), 'utf8'), sandbox);
  const value = sandbox.window[name];
  if (!value) throw new Error(`${file} did not define window.${name}`);
  return value;
};

/* ---- T3: glyphs ---------------------------------------------------------- */
const glyphsOut = path.join(APP, 'public/glyphs-standin');
fs.rmSync(glyphsOut, { recursive: true, force: true });
// T3's fontstack names (plan §5) -> the design spike's bundle names.
const STACKS = {
  'Alegreya SC Medium': ['glyphs-a.js', 'Alegreya SC Medium'],
  'Alegreya SC Bold': ['glyphs-a.js', 'Alegreya SC Bold'],
  'Alegreya Medium Italic': ['glyphs-a.js', 'Alegreya Medium Italic'],
  'Alegreya Italic': ['glyphs-a.js', 'Alegreya Italic'],
  'Alegreya Regular': ['glyphs-a.js', 'Alegreya Regular'],
  'Atkinson Hyperlegible Next Medium': ['glyphs-b.js', 'Atkinson Next Medium'],
  'Atkinson Hyperlegible Next Bold': ['glyphs-b.js', 'Atkinson Next Bold'],
};
const bundles = {};
const usedRanges = new Set();
const yearsDir = path.join(APP, 'public/data/historical');
if (fs.existsSync(yearsDir))
  for (const f of fs.readdirSync(yearsDir).filter((f) => /\.labels\.[0-9a-f]+\.json$/.test(f)))
    for (const ft of JSON.parse(fs.readFileSync(path.join(yearsDir, f))).features) {
      const s = ft.properties.n || ft.properties.p;
      if (s) for (const ch of s) usedRanges.add(Math.floor(ch.codePointAt(0) / 256) * 256);
    }
const notoCache = path.join(os.homedir(), 'LargeFiles/historic-borders-remaster/glyphs/main/Noto Sans Medium');
let glyphFiles = 0;
let fallbacks = 0;
for (const [stack, [file, source]] of Object.entries(STACKS)) {
  bundles[file] ??= loadGlobal(file, 'HB_GLYPHS');
  const dir = path.join(glyphsOut, stack);
  const have = new Set();
  for (const [key, b64] of Object.entries(bundles[file])) {
    const [name, range] = key.split('/');
    if (name !== source) continue;
    writeFile(path.join(dir, `${range}.pbf`), Buffer.from(b64, 'base64'));
    have.add(Number(range.split('-')[0]));
    glyphFiles += 1;
  }
  for (const start of usedRanges) {
    if (have.has(start)) continue;
    const cached = path.join(notoCache, `${start}-${start + 255}.pbf`);
    if (!fs.existsSync(cached)) continue;
    fs.copyFileSync(cached, path.join(dir, `${start}-${start + 255}.pbf`));
    fallbacks += 1;
  }
}
fs.writeFileSync(
  path.join(glyphsOut, 'LICENSE.txt'),
  'STAND-IN for T3. SDF glyphs derived from Alegreya, Alegreya SC (Huerta Tipografica) and Atkinson Hyperlegible Next (Braille Institute), and Noto Sans fallback ranges; all SIL Open Font License 1.1.\n',
);

console.log(`stand-ins: ${glyphFiles} glyph files + ${fallbacks} Noto fallback ranges (T3)`);

// Main-thread cost per label glyph, measured inside one page so that machine
// load affects both sides equally (measure-glyphs.mjs times whole map loads,
// which are noisy on a busy machine):
//
//   raster  what `font-faces` and local rendering do for every glyph: TinySDF
//           at MapLibre's local parameters (48 px, buffer 6, radius 16), from
//           the loaded WOFF2 faces;
//   decode  what the PBF path does: decode the range files' glyph messages and
//           copy each bitmap (MapLibre's parseGlyphPbf + AlphaImage).
//
// The glyphs are every distinct character of the 1492 and 1914 territory and
// place names, in the stacks those layers use. 4x CPU throttle, 9 interleaved
// rounds, median.  node scripts/measure-glyph-raster.mjs → results/glyph-raster.json
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { SPIKE } from './lib.mjs';

const REPO = path.resolve(SPIKE, '..');
const { chromium } = createRequire(path.join(REPO, 'package.json'))('@playwright/test');
const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'data/map-fonts.json'), 'utf8'));
const ROUNDS = Number(process.env.ROUNDS || 9);

const chars = { states: new Set(), places: new Set() };
for (const year of [1492, 1914]) {
  const file = fs.readdirSync(path.join(REPO, 'public/data/historical')).find((f) => f.startsWith(`${year}.`));
  const data = JSON.parse(fs.readFileSync(path.join(REPO, 'public/data/historical', file), 'utf8'));
  for (const f of data.data.labels.features) for (const c of f.properties?.NAME || '') chars.states.add(c);
  for (const f of data.places.features) for (const c of f.properties?.name || '') chars.places.add(c);
}
const jobs = [
  ['Alegreya SC Medium', [...chars.states]],
  ['Alegreya SC Bold', [...chars.states]],
  ['Alegreya Regular', [...chars.places]],
];

const tinySdf = fs
  .readFileSync(path.join(REPO, 'node_modules/@mapbox/tiny-sdf/index.js'), 'utf8')
  .replace('export default class TinySDF', 'window.TinySDF = class TinySDF');
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/fonts/map-aliases.css"><script>${tinySdf}</script>`);
  }
  const file = path.join(REPO, 'public', p);
  if (!file.startsWith(path.join(REPO, 'public')) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': p.endsWith('.css') ? 'text/css' : 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(base);
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const result = await page.evaluate(
  async ({ jobs, url, rounds }) => {
    // Load every face the glyphs need, so no draw hits a pending font.
    for (const [stack, list] of jobs) await document.fonts.load(`${/Bold/.test(stack) ? 700 : /Medium/.test(stack) ? 500 : 400} 48px "${stack}"`, list.join(''));
    const ranges = {};
    for (const [stack, list] of jobs) {
      for (const c of list) {
        const start = Math.floor(c.codePointAt(0) / 256) * 256;
        const key = `${stack}/${start}-${start + 255}`;
        ranges[key] ||= await (await fetch(url.replace('{fontstack}', stack).replace('{range}', `${start}-${start + 255}`))).arrayBuffer();
      }
    }
    const readVarint = (b, s) => { let r = 0, m = 1, x; do { x = b[s.i++]; r += (x & 127) * m; m *= 128; } while (x >= 128); return r; };
    const fields = (b, from, to, onField) => {
      const s = { i: from };
      while (s.i < to) {
        const key = readVarint(b, s); const f = key >> 3;
        if ((key & 7) === 0) onField(f, readVarint(b, s), 0, 0);
        else { const len = readVarint(b, s); onField(f, 0, s.i, s.i + len); s.i += len; }
      }
    };
    const decode = (buffer, wanted) => {
      const b = new Uint8Array(buffer); let n = 0;
      fields(b, 0, b.length, (f, v, s, e) => fields(b, s, e, (f2, v2, s2, e2) => {
        if (f2 !== 3) return;
        let id = 0, bitmap = null;
        fields(b, s2, e2, (f3, v3, s3, e3) => { if (f3 === 1) id = v3; else if (f3 === 2) bitmap = b.slice(s3, e3); });
        if (wanted.has(id)) n += bitmap ? 1 : 0;
      }));
      return n;
    };
    const samples = { raster: [], decode: [] };
    let glyphs = 0;
    for (let round = 0; round < rounds; round++) {
      let t = performance.now();
      glyphs = 0;
      for (const [stack, list] of jobs) {
        const weight = /Bold/.test(stack) ? 700 : /Medium/.test(stack) ? 500 : 400;
        const sdf = new window.TinySDF({ fontSize: 48, buffer: 6, radius: 16, cutoff: 0.25, fontFamily: `"${stack}"`, fontWeight: weight });
        for (const c of list) { sdf.draw(c); glyphs++; }
      }
      samples.raster.push(performance.now() - t);
      t = performance.now();
      for (const [stack, list] of jobs) {
        const byRange = {};
        for (const c of list) { const start = Math.floor(c.codePointAt(0) / 256) * 256; (byRange[`${stack}/${start}-${start + 255}`] ||= new Set()).add(c.codePointAt(0)); }
        for (const [key, wanted] of Object.entries(byRange)) decode(ranges[key], wanted);
      }
      samples.decode.push(performance.now() - t);
    }
    return { glyphs, samples, rangeFiles: Object.keys(ranges).length };
  },
  { jobs, url: `${base}${manifest.glyphs.url}`, rounds: ROUNDS },
);
await browser.close();
server.close();
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const out = {
  measuredAt: new Date().toISOString(),
  loadAverage: (await import('node:os')).loadavg().map((x) => Math.round(x)),
  cpuThrottle: 4,
  glyphBuild: manifest.glyphs.buildId,
  glyphs: result.glyphs,
  rangeFiles: result.rangeFiles,
  rounds: ROUNDS,
  medianMs: { raster: Math.round(median(result.samples.raster)), decode: Math.round(median(result.samples.decode)) },
  perGlyphMs: {
    raster: +(median(result.samples.raster) / result.glyphs).toFixed(3),
    decode: +(median(result.samples.decode) / result.glyphs).toFixed(3),
  },
  samples: result.samples,
};
fs.writeFileSync(path.join(SPIKE, 'results/glyph-raster.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ ...out, samples: undefined }));

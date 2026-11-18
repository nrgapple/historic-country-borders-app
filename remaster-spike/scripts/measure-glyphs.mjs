// Compares three ways MapLibre GL JS 6.19 can draw the Classic-atlas labels,
// all from the repository's built fonts (`yarn data:refresh:fonts` in the
// parent repo):
//
//   pbf    the style's `glyphs` URL serves prebuilt SDF PBFs; the page loads
//          /fonts/map-aliases.css so grapheme clusters (drawn locally by
//          MapLibre 6) use the same fonts.
//   faces  the style's `font-faces` declares the WOFF2 files (manifest
//          `fontstacks[*].faces`); MapLibre rasterizes every glyph on the main
//          thread, with the PBFs as fallback.
//   local  no `glyphs` URL: MapLibre rasterizes every glyph with TinySDF from
//          the page's CSS fonts (map-aliases.css), as `localIdeographFontFamily`
//          does for CJK.
//
// Scenario per run, in a fresh browser context under 4x CPU (page and worker)
// and optionally DevTools "Fast 3G" (562.5 ms RTT, 1.6 Mbps down):
//   1. load 1492 at the teacher camera over Europe and Anatolia → idle;
//   2. pan to North America, where names use Cree and Blackfoot syllabics,
//      Cherokee, Osage and combining marks → idle;
//   3. switch the data to 1914 and zoom out to the world → idle.
//
//   RUNS=3 node scripts/measure-glyphs.mjs     → results/glyphs.json + shots/glyphs-*.png
import fs from 'node:fs';
import { createRequire } from 'node:module';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { SPIKE } from './lib.mjs';

const REPO = path.resolve(SPIKE, '..');
// The parent repo's Playwright: its headless shell is what the font build uses.
const { chromium } = createRequire(path.join(REPO, 'package.json'))('@playwright/test');
const RUNS = Number(process.env.RUNS || 3);
const MODES = (process.env.MODES || 'pbf,faces,local').split(',');
const NETWORKS = {
  cpu4: null,
  cpu4fast3g: { offline: false, latency: 562.5, downloadThroughput: (1.6 * 1e6) / 8, uploadThroughput: (750 * 1e3) / 8 },
};
const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'data/map-fonts.json'), 'utf8'));
const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};

/** Slim label GeoJSON (n = territory, a = km², p = place) from a published year file. */
function labels(year) {
  const file = fs.readdirSync(path.join(REPO, 'public/data/historical')).find((f) => f.startsWith(`${year}.`));
  const data = JSON.parse(fs.readFileSync(path.join(REPO, 'public/data/historical', file), 'utf8'));
  const features = [
    ...data.data.labels.features
      .filter((f) => f.properties?.NAME)
      .map((f) => ({ type: 'Feature', geometry: f.geometry, properties: { n: f.properties.NAME, a: (f.properties.AREA || 0) / 1e6 } })),
    ...data.places.features
      .filter((f) => f.properties?.name)
      .map((f) => ({ type: 'Feature', geometry: f.geometry, properties: { p: f.properties.name } })),
  ];
  return JSON.stringify({ type: 'FeatureCollection', features });
}
const DATA = { 1492: labels(1492), 1914: labels(1914) };

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>glyph bench</title>
<link rel="stylesheet" href="/maplibre/maplibre-gl.css"><link id="aliases" rel="stylesheet">
<style>html,body,#map{margin:0;height:100%;background:#F1E9D6}</style></head><body><div id="map"></div>
<script type="module">
import * as ml from '/maplibre/maplibre-gl.mjs';
const mode = new URLSearchParams(location.search).get('mode');
const manifest = await (await fetch('/manifest.json')).json();
if (mode !== 'faces') document.getElementById('aliases').href = '/fonts/map-aliases.css';
ml.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
const stacks = manifest.glyphs.fontstacks;
const style = {
  version: 8,
  sources: { labels: { type: 'geojson', data: '/data/1492.json' } },
  layers: [
    { id: 'paper', type: 'background', paint: { 'background-color': '#F1E8D0' } },
    { id: 'states', type: 'symbol', source: 'labels', filter: ['has', 'n'],
      layout: {
        'text-field': ['get', 'n'],
        'text-font': ['case', ['>', ['get', 'a'], 250000], ['literal', ['Alegreya SC Bold']], ['literal', ['Alegreya SC Medium']]],
        'text-size': ['interpolate', ['linear'], ['zoom'], 2, 12, 5, 21],
        'text-letter-spacing': 0.1, 'text-max-width': 8, 'text-padding': 4,
        'symbol-sort-key': ['-', ['get', 'a']],
      },
      paint: { 'text-color': '#2A2017', 'text-halo-color': '#FBF6EA', 'text-halo-width': 1.8 } },
    { id: 'places', type: 'symbol', source: 'labels', filter: ['has', 'p'], minzoom: 2.5,
      layout: { 'text-field': ['get', 'p'], 'text-font': ['literal', ['Alegreya Regular']], 'text-size': 14, 'text-optional': true, 'text-max-width': 7 },
      paint: { 'text-color': '#554536', 'text-halo-color': '#FBF6EA', 'text-halo-width': 1.4 } },
  ],
};
if (mode !== 'local') style.glyphs = location.origin + manifest.glyphs.url;
if (mode === 'faces') {
  style['font-faces'] = Object.fromEntries(Object.entries(stacks).map(([name, s]) =>
    [name, s.faces.map((f) => ({ url: location.origin + f.url, 'unicode-range': f['unicode-range'] }))]));
}
window.__t0 = performance.now();
const map = new ml.Map({ container: 'map', style, center: [32, 41], zoom: 3.6, attributionControl: false, fadeDuration: 0, pixelRatio: 1 });
window.__map = map;
window.__phase = (fn) => new Promise((resolve, reject) => {
  const start = performance.now();
  const timer = setTimeout(() => reject(new Error('idle timeout')), 180000);
  map.once('idle', () => requestAnimationFrame(() => { clearTimeout(timer); resolve({ start, end: performance.now(),
    labels: map.queryRenderedFeatures({ layers: ['states', 'places'] }).length }); }));
  fn && fn();
});
window.__ready = window.__phase();
</script></body></html>`;

const TYPES = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.pbf': 'application/x-protobuf', '.woff2': 'font/woff2' };
const COMPRESS = new Set(['.mjs', '.js', '.css', '.json', '.pbf']);
const brCache = new Map();
function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = decodeURIComponent(url.pathname);
    let body;
    let ext;
    if (p === '/') { body = Buffer.from(PAGE); ext = '.html'; }
    else if (p === '/manifest.json') { body = fs.readFileSync(path.join(REPO, 'data/map-fonts.json')); ext = '.json'; }
    else if (p.startsWith('/data/')) { body = Buffer.from(DATA[path.basename(p, '.json')] || ''); ext = '.json'; }
    else {
      const file = p.startsWith('/maplibre/')
        ? path.join(SPIKE, 'node_modules/maplibre-gl/dist', p.slice(10))
        : path.join(REPO, 'public', p);
      if (!file.startsWith(SPIKE) && !file.startsWith(path.join(REPO, 'public')) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      body = fs.readFileSync(file);
      ext = path.extname(file);
    }
    const headers = { 'content-type': TYPES[ext] || 'text/html; charset=utf-8', 'cache-control': 'no-store' };
    if (COMPRESS.has(ext)) {
      const key = p;
      if (!brCache.has(key)) brCache.set(key, zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }));
      body = brCache.get(key);
      headers['content-encoding'] = 'br';
    }
    res.writeHead(200, headers);
    res.end(body);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function throttle(page, network) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  if (network) await cdp.send('Network.emulateNetworkConditions', network);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  let id = 1;
  cdp.on('Target.attachedToTarget', async (e) => {
    if (e.targetInfo.type !== 'worker') return;
    const send = (method, params = {}) => cdp.send('Target.sendMessageToTarget', { sessionId: e.sessionId, message: JSON.stringify({ id: id++, method, params }) }).catch(() => {});
    await send('Emulation.setCPUThrottlingRate', { rate: 4 });
    if (network) { await send('Network.enable'); await send('Network.emulateNetworkConditions', network); }
    await send('Runtime.runIfWaitingForDebugger');
  });
  await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: false });
  const bytes = [];
  const urls = new Map();
  cdp.on('Network.requestWillBeSent', (e) => urls.set(e.requestId, e.request.url));
  cdp.on('Network.loadingFinished', (e) => bytes.push({ url: urls.get(e.requestId), bytes: e.encodedDataLength, t: e.timestamp }));
  return bytes;
}

async function run(browser, base, mode, network, shot) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    window.__long = [];
    new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__long.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
  });
  const requests = await throttle(page, network);
  await page.goto(`${base}/?mode=${mode}`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  const phases = {};
  phases.europe1492 = await page.evaluate(() => window.__ready.then((r) => ({ ...r, start: window.__t0 })));
  if (shot) await page.screenshot({ path: path.join(SPIKE, `shots/glyphs-${mode}-europe-1492.png`) });
  phases.americas1492 = await page.evaluate(() => window.__phase(() => window.__map.jumpTo({ center: [-98, 47], zoom: 3.4 })));
  if (shot) await page.screenshot({ path: path.join(SPIKE, `shots/glyphs-${mode}-americas-1492.png`) });
  phases.world1914 = await page.evaluate(() => window.__phase(() => { window.__map.getSource('labels').setData('/data/1914.json'); window.__map.jumpTo({ center: [15, 30], zoom: 1.8 }); }));
  const long = await page.evaluate(() => window.__long);
  const result = {};
  for (const [name, p] of Object.entries(phases)) {
    const tasks = long.filter(([s]) => s >= p.start && s <= p.end);
    result[name] = {
      ms: Math.round(p.end - p.start),
      labels: p.labels,
      longTaskMs: Math.round(tasks.reduce((t, [, d]) => t + d, 0)),
      maxLongTaskMs: Math.round(Math.max(0, ...tasks.map(([, d]) => d))),
    };
  }
  const glyphReq = requests.filter((r) => r.url && /\/glyphs\//.test(r.url));
  const fontReq = requests.filter((r) => r.url && /\/fonts\/files\//.test(r.url));
  const cssReq = requests.filter((r) => r.url && /\/fonts\/[^/]+\.css$/.test(r.url));
  result.transfer = {
    glyphRequests: glyphReq.length, glyphBytes: glyphReq.reduce((t, r) => t + r.bytes, 0),
    fontRequests: fontReq.length, fontBytes: fontReq.reduce((t, r) => t + r.bytes, 0),
    cssBytes: cssReq.reduce((t, r) => t + r.bytes, 0),
  };
  result.warnings = [...new Set(errors)].slice(0, 5);
  await context.close();
  return result;
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const out = { measuredAt: new Date().toISOString(), loadAverage: (await import('node:os')).loadavg().map((x) => Math.round(x)), chromium: browser.version(), maplibre: JSON.parse(fs.readFileSync(path.join(SPIKE, 'node_modules/maplibre-gl/package.json'))).version, glyphBuild: manifest.glyphs.buildId, runs: RUNS, viewport: '1366x768 @1x', cpuThrottle: 4, networks: NETWORKS, results: {} };
for (const [networkName, network] of Object.entries(NETWORKS)) {
  // Interleave the modes so that background load drifts affect each equally.
  const byMode = Object.fromEntries(MODES.map((mode) => [mode, []]));
  for (let i = 0; i < RUNS; i++) {
    for (const mode of MODES) byMode[mode].push(await run(browser, base, mode, network, networkName === 'cpu4' && i === 0));
  }
  for (const mode of MODES) {
    const samples = byMode[mode];
    const med = {};
    for (const phase of ['europe1492', 'americas1492', 'world1914']) {
      med[phase] = Object.fromEntries(['ms', 'labels', 'longTaskMs', 'maxLongTaskMs'].map((k) => [k, median(samples.map((s) => s[phase][k]))]));
    }
    med.transfer = Object.fromEntries(Object.keys(samples[0].transfer).map((k) => [k, median(samples.map((s) => s.transfer[k]))]));
    out.results[`${networkName}/${mode}`] = { median: med, warnings: samples[0].warnings, samples };
    console.log(networkName, mode, JSON.stringify(med));
  }
}
await browser.close();
server.close();
fs.writeFileSync(path.join(SPIKE, 'results/glyphs.json'), `${JSON.stringify(out, null, 2)}\n`);

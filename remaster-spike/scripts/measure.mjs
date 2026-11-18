// Browser comparison of the current app and the spike under Chrome DevTools
// throttling (4x CPU, "Fast 3G": 562.5 ms RTT, 1.6 Mbps down, 750 kbps up).
//
//   node scripts/serve.mjs ../out 4300   # current app (`yarn build` output)
//   node scripts/serve.mjs dist 4400     # spike (`yarn build`)
//   RUNS=3 node scripts/measure.mjs
//
// Both apps expose their map instance as window.__map (the current app via a
// one-line, uncommitted measurement patch in components/map/MapCanvas.tsx).
// Throttling is applied to the page and to every dedicated worker, because
// both renderers fetch tiles/data from workers. Every non-local request is
// recorded and fails DNS resolution (the current build has a placeholder Mapbox token).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { SPIKE } from './lib.mjs';

const APPS = {
  current: { base: process.env.CURRENT_URL || 'http://127.0.0.1:4300' },
  spike: { base: process.env.SPIKE_URL || 'http://127.0.0.1:4400' },
};
const CASES = {
  1914: { query: '?lng=15.00&lat=50.00&zoom=3.50', expect: 'Austro-Hungarian Empire' },
  1492: { query: '?lng=32.00&lat=39.00&zoom=3.60', expect: 'Ottoman Empire' },
};
const RUNS = Number(process.env.RUNS || 3);
const HEAP_STEPS = 10;
const FAST_3G = { offline: false, latency: 562.5, downloadThroughput: (1.6 * 1e6) / 8, uploadThroughput: (750 * 1e3) / 8 };
const CPU = 4;
const median = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

const INIT = () => {
  const mark = (k) => { if (window.__t[k] == null) window.__t[k] = performance.now(); };
  window.__t = {};
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue;
    for (const fn of ['drawElements', 'drawArrays']) {
      const orig = C.prototype[fn];
      C.prototype[fn] = function (...a) { mark('firstDraw'); return orig.apply(this, a); };
    }
  }
  let m;
  Object.defineProperty(window, '__map', {
    configurable: true,
    get: () => m,
    set(v) {
      m = v;
      mark('mapCreated');
      // "Ready" = the next animation frame after every borders tile has been
      // (re)built from the year's data: a borders tile 'sourcedata' event has
      // arrived since the trigger and the borders source reports loaded.
      // Basemap tiles are not awaited (the current build's placeholder Mapbox
      // token means its basemap requests fail and it never fires 'idle').
      window.__renders = 0;
      let tiles = false;
      const check = () => {
        if (!tiles || !v.getSource('borders') || !v.isSourceLoaded('borders')) return;
        tiles = false;
        const sw = window.__switch;
        requestAnimationFrame(() => {
          mark('bordersIdle');
          if (sw && sw.setDataAt != null && sw.idleAt == null) sw.idleAt = performance.now();
        });
      };
      v.on('sourcedata', (e) => {
        if (e.sourceId !== 'borders') return;
        const sw = window.__switch;
        if (e.tile && (!sw || sw.setDataAt != null)) tiles = true;
        check();
      });
      v.on('render', () => { window.__renders += 1; check(); });
    },
  });
  addEventListener('keydown', (e) => { if (window.__switch && window.__switch.keyAt == null) window.__switch.keyAt = e.timeStamp; }, true);
};

async function throttle(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', FAST_3G);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const hosts = new Set();
  const workers = new Map();
  let nextId = 1;
  const pending = new Map();
  const toWorker = (sessionId, method, params = {}) => new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(() => resolve({ error: 'send failed' }));
  });
  cdp.on('Network.requestWillBeSent', (e) => hosts.add(new URL(e.request.url).host));
  cdp.on('Target.receivedMessageFromTarget', (e) => {
    const msg = JSON.parse(e.message);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Network.requestWillBeSent') hosts.add(new URL(msg.params.request.url).host);
  });
  cdp.on('Target.attachedToTarget', async (e) => {
    if (e.targetInfo.type !== 'worker') return;
    workers.set(e.sessionId, e.targetInfo.url);
    const r = await Promise.all([
      toWorker(e.sessionId, 'Network.enable'),
      toWorker(e.sessionId, 'Network.emulateNetworkConditions', FAST_3G),
      toWorker(e.sessionId, 'Emulation.setCPUThrottlingRate', { rate: CPU }),
    ]);
    workers.set(e.sessionId, { url: e.targetInfo.url, networkThrottled: !r[1].error, cpuThrottled: !r[2].error });
    await toWorker(e.sessionId, 'Runtime.runIfWaitingForDebugger');
  });
  await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: false });
  return {
    hosts, workers,
    async heap() {
      await cdp.send('HeapProfiler.collectGarbage');
      const main = (await cdp.send('Runtime.getHeapUsage')).usedSize;
      let worker = 0;
      for (const sessionId of workers.keys()) {
        await toWorker(sessionId, 'HeapProfiler.collectGarbage');
        const r = await toWorker(sessionId, 'Runtime.getHeapUsage');
        worker += r.result?.usedSize ?? 0;
      }
      return { main, worker, total: main + worker };
    },
  };
}

const stats = async (base, reset) => (await fetch(`${base}/__stats${reset ? '?reset=1' : ''}`)).json();
const bytesBy = (log) => {
  const out = { js: 0, css: 0, html: 0, data: 0, basemapTilesAndGlyphs: 0, other: 0, requests: log.length, dataFiles: log.filter((r) => r.path.startsWith('/data/')).map((r) => `${r.path.split('/').pop()}:${r.bytes}`) };
  for (const r of log) {
    if (['.js', '.mjs'].includes(r.ext)) out.js += r.bytes;
    else if (r.ext === '.css') out.css += r.bytes;
    else if (r.ext === '.html') out.html += r.bytes;
    else if (['.json', '.geojson'].includes(r.ext) && r.path.startsWith('/data/')) out.data += r.bytes;
    else if (r.ext === '.pbf') out.basemapTilesAndGlyphs += r.bytes;
    else out.other += r.bytes;
  }
  return out;
};

async function openYear(browser, app, year) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  const external = new Set(); // hosts come from CDP requestWillBeSent (page + workers)
  const page = await context.newPage();
  await page.addInitScript(INIT);
  const t = await throttle(page);
  await stats(APPS[app].base, true);
  await page.goto(`${APPS[app].base}/year/${year}${CASES[year].query}`, { waitUntil: 'commit' });
  for (let i = 0; ; i++) {
    const state = await page.evaluate(() => ({ t: window.__t, map: !!window.__map, src: window.__map?.getSource('borders') ? window.__map.isSourceLoaded('borders') : null, loaded: window.__map?.loaded() }));
    if (state.t.bordersIdle != null) break;
    if (process.env.DEBUG && i % 20 === 0) console.log('waiting', JSON.stringify(state));
    if (i > 1800) throw new Error(`map never became ready: ${JSON.stringify(state)}`);
    await page.waitForTimeout(100);
  }
  const initial = bytesBy(await stats(APPS[app].base, true));
  // Selectable: click the map centre until the details panel names the territory.
  const box = await page.locator('canvas').first().boundingBox();
  let selectableAt = null;
  let clicks = 0;
  await page.evaluate(() => { window.__long = []; new PerformanceObserver((l) => window.__long.push(...l.getEntries().map((e) => [Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask' }); });
  for (let i = 0; i < 40 && selectableAt == null; i++) {
    clicks += 1;
    await page.evaluate(() => { window.__t.clickAt = performance.now(); });
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    try {
      await page.waitForFunction((name) => [...document.querySelectorAll('h2[id$="panel-title"]')].some((h) => h.textContent.trim() === name), CASES[year].expect, { timeout: 1500, polling: 50 });
      selectableAt = await page.evaluate(() => performance.now());
    } catch { /* not yet selectable */ }
  }
  const marks = await page.evaluate(() => window.__t);
  marks.clicks = clicks;
  marks.longTasksAfterReady = await page.evaluate(() => window.__long.filter(([s]) => s >= window.__t.bordersIdle - 50).slice(0, 12));
  return { context, page, t, external, marks, selectableAt, initial };
}

async function switchYear(page, key = 'ArrowLeft') {
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    window.__switch = {};
    const s = window.__map.getSource('borders');
    if (!s.__wrapped) {
      const orig = s.setData;
      s.setData = function (...a) { if (window.__switch && window.__switch.setDataAt == null) window.__switch.setDataAt = performance.now(); return orig.apply(this, a); };
      s.__wrapped = true;
    }
  });
  await page.keyboard.press(key);
  await page.waitForFunction(() => window.__switch.idleAt != null, null, { timeout: 180000, polling: 50 });
  const s = await page.evaluate(() => window.__switch);
  return { ms: Math.round(s.idleAt - s.keyAt), path: await page.evaluate(() => location.pathname) };
}

// Third-party hosts fail DNS instead of being intercepted: Playwright request
// interception disables Chrome's HTTP cache, which would hide prefetch/preload
// behaviour and double-count downloads.
const browser = await chromium.launch({ channel: 'chromium', args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
const results = { measuredAt: new Date().toISOString(), chromium: browser.version(), throttling: { cpu: CPU, network: FAST_3G }, runs: RUNS, viewport: '1366x768 @1x', apps: {} };
for (const app of Object.keys(APPS).filter((a) => !process.env.ONLY_APP || a === process.env.ONLY_APP)) {
  results.apps[app] = {};
  for (const year of Object.keys(CASES).filter((y) => !process.env.ONLY_YEAR || y === process.env.ONLY_YEAR)) {
    const samples = [];
    for (let run = 0; run < RUNS; run++) {
      const r = await openYear(browser, app, year);
      if (run === 0) {
        fs.mkdirSync(path.join(SPIKE, 'shots'), { recursive: true });
        await r.page.waitForTimeout(1500);
        await r.page.screenshot({ path: path.join(SPIKE, 'shots', `${app}-${year}.png`) });
      }
      const r0 = await r.page.evaluate(() => window.__renders);
      await r.page.waitForTimeout(3000);
      const idleRendersPerSec = Math.round(((await r.page.evaluate(() => window.__renders)) - r0) / 3);
      const sw = await switchYear(r.page);
      const switchBytes = bytesBy(await stats(APPS[app].base, true));
      samples.push({
        clicks: r.marks.clicks, longTasksAfterReady: r.marks.longTasksAfterReady,
        firstMapPaintMs: Math.round(r.marks.firstDraw), mapReadyMs: Math.round(r.marks.bordersIdle), selectableMs: r.selectableAt && Math.round(r.selectableAt),
        switchMs: sw.ms, switchTo: sw.path, idleRendersPerSec, initial: r.initial, switchBytes,
        thirdPartyHosts: [...new Set([...r.external, ...[...r.t.hosts].filter((h) => h && !h.startsWith('127.0.0.1'))])],
        workers: [...r.t.workers.values()],
      });
      console.log(app, year, run, JSON.stringify(samples.at(-1)));
      await r.context.close();
    }
    // Heap after visiting ten years (cold start at this year, then ten steps back).
    const r = await openYear(browser, app, year);
    const visited = [];
    for (let i = 0; i < HEAP_STEPS; i++) visited.push((await switchYear(r.page)).path);
    await r.page.waitForTimeout(3000);
    const heap = await r.t.heap();
    console.log(app, year, 'heap', JSON.stringify(heap), visited.join(' '));
    await r.context.close();
    results.apps[app][year] = {
      median: {
        firstMapPaintMs: median(samples.map((s) => s.firstMapPaintMs)),
        mapReadyMs: median(samples.map((s) => s.mapReadyMs)),
        selectableMs: median(samples.map((s) => s.selectableMs)),
        switchMs: median(samples.map((s) => s.switchMs)),
        idleRendersPerSec: median(samples.map((s) => s.idleRendersPerSec)),
        jsBytes: median(samples.map((s) => s.initial.js)),
        cssBytes: median(samples.map((s) => s.initial.css)),
        dataBytes: median(samples.map((s) => s.initial.data)),
        basemapBytes: median(samples.map((s) => s.initial.basemapTilesAndGlyphs)),
        totalBytes: median(samples.map((s) => s.initial.js + s.initial.css + s.initial.html + s.initial.data + s.initial.basemapTilesAndGlyphs + s.initial.other)),
      },
      heapAfter10Years: heap, visited, samples,
    };
  }
}
await browser.close();
fs.mkdirSync(path.join(SPIKE, 'results'), { recursive: true });
fs.writeFileSync(path.join(SPIKE, 'results/browser.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(results.apps).map(([a, ys]) => [a, Object.fromEntries(Object.entries(ys).map(([y, v]) => [y, { ...v.median, heapMiB: +(v.heapAfter10Years.total / 1048576).toFixed(1), hosts: [...new Set(v.samples.flatMap((s) => s.thirdPartyHosts))] }]))])), null, 2));

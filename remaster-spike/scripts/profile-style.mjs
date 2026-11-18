// Per-decoration cost of the Classic-atlas style while panning.
//
//   node scripts/profile-style.mjs [baseUrl] [--rounds=3] [--frames=180]
//
// Method: full Chromium (new headless) on the host GPU, vsync and the frame-rate
// limiter off so frames run back to back, device pixel ratio 2 (the controller's
// cap) at 1440x900 to stress fill rate, and 4x CPU throttling on the main
// thread. The camera pans in three linear animated legs (like a drag: one
// `move` per frame, one `moveend` per leg). For each frame we record:
//   - map: MapLibre's render pass, closed with gl.finish(), so it covers the
//     CPU work plus the GPU work that pass submitted;
//   - frame: the rAF-to-rAF interval, which also covers compositing (the
//     paper grain's full-screen multiply) and the neatline's SVG rebuild.
// Each configuration turns ONE decoration off; its cost is baseline minus that
// configuration. Rounds interleave configurations to cancel drift.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { SPIKE } from './lib.mjs';

const base =
  process.argv[2] && !process.argv[2].startsWith('--')
    ? process.argv[2]
    : 'http://127.0.0.1:4400';
const arg = (k, d) =>
  Number(process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d);
const ROUNDS = arg('rounds', 3);
const FRAMES = arg('frames', 180);
const CPU = arg('cpu', 4);
const ONLY = process.argv
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split('|');

const W = (i) => `waterline-${i}`;
const CONFIGS = [
  { name: 'baseline (all decorations)', hide: [] },
  { name: 'edge bands', hide: ['territory-band'] },
  { name: 'waterlines (all 4)', hide: [W(0), W(1), W(2), W(3)] },
  { name: 'waterlines 2-4 (keep innermost)', hide: [W(1), W(2), W(3)] },
  { name: 'relief', hide: ['relief'] },
  { name: 'graticule', hide: ['graticule'] },
  { name: 'selection band + line', hide: ['selected-band', 'selected-line'] },
  { name: 'dependency hatch', hide: ['dependency-hatch'] },
  { name: 'paper grain (DOM)', grain: false },
  { name: 'neatline (DOM)', neatline: false },
  { name: 'lowPower rule', lowPower: true },
];
const SCENES_ALL = [
  {
    year: 1492,
    query: {
      place: 'Ottoman Empire',
      fit: '-33,28,54,58',
      pad: '24,450,40,24',
    },
  },
  {
    year: 1914,
    query: { place: 'France', fit: '-22,-36,58,62', pad: '24,24,24,24' },
  },
];

const SCENES = SCENES_ALL;
const CONFIGS_RUN = ONLY
  ? CONFIGS.filter((c, i) => i === 0 || ONLY.includes(c.name))
  : CONFIGS;
const browser = await chromium.launch({
  channel: 'chromium',
  args: [
    '--disable-gpu-vsync',
    '--disable-frame-rate-limit',
    '--ignore-gpu-blocklist',
  ],
});
const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

const results = {};
for (const scene of SCENES) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const q = new URLSearchParams({ lowPower: '0', ...scene.query });
  await page.goto(`${base}/review/${scene.year}?${q}`);
  await page.waitForFunction(() => !!window.__review);
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const map = window.__review.handle.map;
        const check = () =>
          map.getLayer('relief') && map.loaded()
            ? resolve()
            : map.once('idle', check);
        map.once('idle', check);
        setTimeout(resolve, 30000);
      }),
  );
  const renderer = await page.evaluate(() => {
    const gl = window.__review.handle.map.painter.context.gl;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });

  const samples = Object.fromEntries(
    CONFIGS_RUN.map((c) => [c.name, { map: [], frame: [] }]),
  );
  // Round -1 is a discarded warm-up; later rounds rotate the order to cancel drift.
  for (let round = -1; round < ROUNDS; round++) {
    const order =
      round < 0
        ? [CONFIGS_RUN[0]]
        : CONFIGS_RUN.map(
            (_, i) => CONFIGS_RUN[(i + round * 4) % CONFIGS_RUN.length],
          );
    for (const config of order) {
      const r = await page.evaluate(
        async ({ config, frames }) => {
          const { handle } = window.__review;
          const map = handle.map;
          const gl = map.painter.context.gl;
          const all = map.getStyle().layers.map((l) => l.id);
          const hidden = new Set(config.hide ?? []);
          handle.setOptions({ lowPower: !!config.lowPower });
          for (const id of all) {
            if (hidden.has(id)) map.setLayoutProperty(id, 'visibility', 'none');
          }
          const grain = document.querySelector('.hb-paper-grain');
          if (grain)
            grain.style.display =
              config.grain === false || config.lowPower ? 'none' : '';
          const svg = document.querySelector('.review__neatline');
          svg.style.display = config.neatline === false ? 'none' : '';
          // Wait for re-layout after any option change.
          await new Promise((res) =>
            map.loaded()
              ? setTimeout(res, 300)
              : map.once('idle', () => setTimeout(res, 300)),
          );
          const start = map.getCenter();
          const mapMs = [];
          const frameMs = [];
          const orig = map._render.bind(map);
          map._render = (t) => {
            const t0 = performance.now();
            const out = orig(t);
            gl.finish();
            mapMs.push(performance.now() - t0);
            return out;
          };
          // Three linear pans, like a drag: one `move` per frame, one `moveend` per leg.
          let last = performance.now();
          let counting = false;
          const tick = () => {
            const now = performance.now();
            if (counting) frameMs.push(now - last);
            last = now;
            if (counting) requestAnimationFrame(tick);
          };
          for (const dx of [360, -720, 360]) {
            await new Promise((done) => {
              map.once('moveend', done);
              counting = true;
              last = performance.now();
              requestAnimationFrame(tick);
              map.panBy([dx, 0], {
                duration: (frames / 3) * 16.7 * (Math.abs(dx) / 360),
                easing: (t) => t,
              });
            });
            counting = false;
          }
          map._render = orig;
          map.jumpTo({ center: start });
          for (const id of hidden)
            map.setLayoutProperty(id, 'visibility', 'visible');
          handle.setOptions({ lowPower: false });
          if (grain) grain.style.display = '';
          svg.style.display = '';
          return { mapMs: mapMs.slice(5), frameMs };
        },
        { config, frames: FRAMES },
      );
      if (round < 0) continue;
      samples[config.name].map.push(...r.mapMs);
      samples[config.name].frame.push(...r.frameMs);
    }
  }
  const baseline = samples[CONFIGS_RUN[0].name];
  const bMap = pct(baseline.map, 50);
  const bFrame = pct(baseline.frame, 50);
  results[scene.year] = {
    renderer,
    rows: CONFIGS_RUN.map((c) => {
      const s = samples[c.name];
      const m = pct(s.map, 50);
      const f = pct(s.frame, 50);
      return {
        config: c.name,
        mapMedian: +m.toFixed(2),
        mapP95: +pct(s.map, 95).toFixed(2),
        frameMedian: +f.toFixed(2),
        frameP95: +pct(s.frame, 95).toFixed(2),
        savedMap: c === CONFIGS_RUN[0] ? null : +(bMap - m).toFixed(2),
        savedFrame: c === CONFIGS_RUN[0] ? null : +(bFrame - f).toFixed(2),
        n: s.frame.length,
      };
    }),
  };
  console.log(
    `\n${scene.year} (${renderer}), CPU ${CPU}x, median ms over ${ROUNDS} rounds x ${FRAMES} frames`,
  );
  console.table(results[scene.year].rows);
  await ctx.close();
}
await browser.close();
const out = path.join(SPIKE, `results/style-profile-cpu${CPU}x.json`);
fs.writeFileSync(
  out,
  JSON.stringify(
    {
      measured: new Date().toISOString(),
      method: `Chromium new headless, host GPU, vsync off, 1440x900 @2x, ${CPU}x CPU throttle, 3 linear animated pans`,
      cpuThrottle: CPU,
      rounds: ROUNDS,
      frames: FRAMES,
      results,
    },
    null,
    2,
  ),
);
console.log(`wrote ${path.relative(SPIKE, out)}`);

'use strict';

// Renders the basemap layers with plain review colours and saves
// docs/product/basemap-review.png. A review aid, not part of any build.
//
//   yarn basemap:review
//
// Needs MapLibre GL JS in .cache/basemap-review (see docs/BASEMAP.md) and a
// Playwright Chromium. Label glyphs come from the design spike's bundle.

const fs = require('fs');
const http = require('http');
const path = require('path');
const { ROOT } = require('./lib/basemap');

const MAPLIBRE = path.join(
  ROOT,
  '.cache/basemap-review/node_modules/maplibre-gl/dist',
);
const VIEW = process.env.BASEMAP_REVIEW_VIEW; // lon,lat,zoom for ad-hoc checks
const OUTPUT =
  process.env.BASEMAP_REVIEW_OUT ||
  path.join(ROOT, 'docs/product/basemap-review.png');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.geojson': 'application/geo+json',
  '.pbf': 'application/x-protobuf',
  '.webp': 'image/webp',
};

const glyphs = (() => {
  const bundle = fs.readFileSync(
    path.join(ROOT, 'design/living-atlas/data/glyphs-a.js'),
    'utf8',
  );
  return JSON.parse(
    bundle.slice(bundle.indexOf('{'), bundle.lastIndexOf('}') + 1),
  );
})();

const inside = (base, rel) => {
  const file = path.resolve(base, rel);
  return file.startsWith(base + path.sep) ? file : null;
};

const resolve = (pathname) => {
  if (pathname === '/')
    return path.join(__dirname, 'basemap-review/index.html');
  if (pathname === '/data/basemap-manifest.json')
    return path.join(ROOT, 'data/basemap-manifest.json');
  if (pathname === '/data/historical/1492.json') {
    const dir = path.join(ROOT, 'public/data/historical');
    return path.join(
      dir,
      fs.readdirSync(dir).find((f) => /^1492\.[0-9a-f]+\.json$/.test(f)),
    );
  }
  if (pathname.startsWith('/maplibre/'))
    return inside(MAPLIBRE, pathname.slice('/maplibre/'.length));
  if (
    pathname.startsWith('/tiles/basemap/') ||
    pathname.startsWith('/basemap/')
  )
    return inside(path.join(ROOT, 'public'), pathname.slice(1));
  return null;
};

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(
    new URL(request.url, 'http://x').pathname,
  );
  const glyph = /^\/glyphs\/([^/]+)\/(\d+-\d+)\.pbf$/.exec(pathname);
  if (glyph) {
    const data = glyphs[`${glyph[1]}/${glyph[2]}`];
    response.writeHead(data ? 200 : 404, {
      'Content-Type': 'application/x-protobuf',
    });
    return response.end(data ? Buffer.from(data, 'base64') : undefined);
  }
  const file = resolve(pathname);
  if (!file || !fs.existsSync(file)) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {
    'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
  });
  fs.createReadStream(file).pipe(response);
});

const main = async () => {
  if (!fs.existsSync(path.join(MAPLIBRE, 'maplibre-gl.mjs')))
    throw new Error(
      'MapLibre is missing; see docs/BASEMAP.md "Visual review" for the one-time install.',
    );
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 560 },
      deviceScaleFactor: 1,
    });
    const failures = [];
    page.on('pageerror', (error) => failures.push(error.message));
    page.on('response', (r) => {
      if (r.status() >= 400 && !r.url().includes('/glyphs/'))
        failures.push(`${r.status()} ${r.url()}`);
    });
    await page.goto(VIEW ? `${url}?view=${VIEW}` : url);
    await page.waitForFunction(() => window.__ready === true, null, {
      timeout: 120000,
    });
    if (failures.length)
      throw new Error(`review page errors:\n${failures.join('\n')}`);
    await page.screenshot({ path: OUTPUT, fullPage: true });
    console.log(`wrote ${OUTPUT}`);
  } finally {
    await browser.close();
    server.close();
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
    server.close();
  });
}

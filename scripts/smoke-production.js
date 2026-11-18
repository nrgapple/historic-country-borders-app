'use strict';

// Production serves the build (dist/): per-year split files and a
// content-hashed PA district index. After `yarn build` the index name comes
// from dist/; without a local build (the scheduled uptime check) it is read
// from the live PA page's preload link.
const fs = require('fs');
const path = require('path');
const splitAssets = require('../data/historical-split-assets.json');
const { runProductionSmoke } = require('./lib/production-smoke');

const baseUrl = process.env.BASE_URL || 'https://historicborders.app';
const historicalAssetPath = splitAssets.years['1994'].polygons.url;
const PA_INDEX = /\/data\/pa\/districts\.[0-9a-f]+\.json/;

async function paIndexPath() {
  const paDirectory = path.join(__dirname, '..', 'dist', 'data', 'pa');
  if (fs.existsSync(paDirectory)) {
    const file = fs
      .readdirSync(paDirectory)
      .find((name) => /^districts\.[0-9a-f]+\.json$/.test(name));
    if (!file) throw new Error('No PA district index in dist/data/pa');
    return `/data/pa/${file}`;
  }
  const response = await fetch(new URL('/pa/school-districts', baseUrl), {
    signal: AbortSignal.timeout(20_000),
  });
  const match = (await response.text()).match(PA_INDEX);
  if (!match) throw new Error('The live PA page names no district index');
  return match[0];
}

paIndexPath()
  .then((schoolAssetPath) =>
    runProductionSmoke({ baseUrl, historicalAssetPath, schoolAssetPath }),
  )
  .then((results) => {
    results.forEach(({ path: checked, status, durationMs, cacheControl }) => {
      console.log(`${status} ${checked} ${durationMs}ms (${cacheControl})`);
    });
    console.log(
      `Production smoke passed: ${results.length} static checks; Worker requests: 0`,
    );
  })
  .catch((error) => {
    console.error(`Production smoke failed: ${error.message}`);
    process.exitCode = 1;
  });

'use strict';

// Production serves the remaster build (remaster/dist): per-year split files
// and a content-hashed PA district index. Run after yarn remaster:build.
const fs = require('fs');
const path = require('path');
const splitAssets = require('../data/historical-split-assets.json');
const { runProductionSmoke } = require('./lib/production-smoke');

const baseUrl = process.env.BASE_URL || 'https://historicborders.app';
const historicalAssetPath = splitAssets.years['1994'].polygons.url;
const paDirectory = path.join(
  __dirname,
  '..',
  'remaster',
  'dist',
  'data',
  'pa',
);
const paIndex = fs
  .readdirSync(paDirectory)
  .find((file) => /^districts\.[0-9a-f]+\.json$/.test(file));
if (!paIndex) throw new Error('No PA district index in remaster/dist/data/pa');

runProductionSmoke({
  baseUrl,
  historicalAssetPath,
  schoolAssetPath: `/data/pa/${paIndex}`,
})
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

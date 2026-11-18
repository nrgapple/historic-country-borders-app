'use strict';

const historicalAssets = require('../data/historical-assets.json');
const { runProductionSmoke } = require('./lib/production-smoke');

const baseUrl = process.env.BASE_URL || 'https://historicborders.app';
const historicalAssetPath = historicalAssets.assets['1994'].url;

runProductionSmoke({ baseUrl, historicalAssetPath })
  .then((results) => {
    results.forEach(({ path, status, durationMs, cacheControl }) => {
      console.log(`${status} ${path} ${durationMs}ms (${cacheControl})`);
    });
    console.log(
      `Production smoke passed: ${results.length} static checks; Worker requests: 0`,
    );
  })
  .catch((error) => {
    console.error(`Production smoke failed: ${error.message}`);
    process.exitCode = 1;
  });

'use strict';

// Offline basemap validation (part of `yarn data:validate`). Checks pinned
// sources and hashes, the tile tree against its manifest and budgets, the
// layer contract inside every tile, and the relief and globe assets.
// See docs/BASEMAP.md.

const { BUDGETS, validateBasemap } = require('./lib/basemap');

if (require.main === module) {
  const result = validateBasemap();
  if (result.errors.length) {
    for (const error of result.errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log(
      `Validated basemap: ${result.files} files (budget ${BUDGETS.basemapFiles}), ` +
        `${(result.tileBytes / 1024).toFixed(0)} KiB of tiles, ${(result.assetBytes / 1024).toFixed(0)} KiB of assets.`,
    );
  }
}

module.exports = { validateBasemap };

'use strict';

// Offline validation of the PA street basemap (part of `yarn data:validate`):
// the pin, the manifest, every tile against the layer contract and coverage
// index, the tree digest and the budgets. See docs/PA_BASEMAP.md.

const { BUDGETS, validatePaBasemap } = require('./lib/pa-basemap');

if (require.main === module) {
  const result = validatePaBasemap();
  if (result.errors.length) {
    for (const error of result.errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log(
      `Validated PA basemap: ${result.files} tiles (budget ${BUDGETS.files}), ` +
        `${(result.bytes / 1048576).toFixed(1)} MiB, largest ${(result.largest / 1024).toFixed(0)} KiB.`,
    );
  }
}

module.exports = { validatePaBasemap };

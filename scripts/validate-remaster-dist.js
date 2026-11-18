'use strict';

// Checks the remaster build (remaster/dist) before it is deployed to
// production: required pages and files, and Cloudflare's Free-plan limits.
const fs = require('fs');
const path = require('path');
const { checkDeployableFiles } = require('./lib/deploy-files');

const DIST = path.join(__dirname, '..', 'remaster', 'dist');
const REQUIRED = [
  'index.html',
  '404.html',
  'year/1492.html',
  'year/1994.html',
  'year/-100.html',
  'pa/school-districts.html',
  '_headers',
  'robots.txt',
  'sitemap.xml',
];

function main() {
  if (!fs.existsSync(DIST)) {
    throw new Error('remaster/dist does not exist; run yarn remaster:build');
  }
  const missing = REQUIRED.filter(
    (file) => !fs.existsSync(path.join(DIST, file)),
  );
  if (missing.length) throw new Error(`missing ${missing.join(', ')}`);
  const { count, largest, errors } = checkDeployableFiles(DIST);
  if (errors.length) throw new Error(errors.join('; '));
  console.log(
    `Remaster build valid: ${count} files, largest ${largest.file} (${(largest.bytes / 1024).toFixed(0)} KiB)`,
  );
}

try {
  main();
} catch (error) {
  console.error(`Remaster build validation failed: ${error.message}`);
  process.exitCode = 1;
}

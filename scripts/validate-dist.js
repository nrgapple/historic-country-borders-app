'use strict';

// Checks the build (dist/) before it is deployed to
// production: required pages and files, and Cloudflare's Free-plan limits.
const fs = require('fs');
const path = require('path');
const { checkDeployableFiles } = require('./lib/deploy-files');

const DIST = path.join(__dirname, '..', 'dist');
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

// Production executes Worker code only for /api/feedback; everything else
// is a static asset from dist.
function checkWorkerConfig() {
  const wrangler = fs.readFileSync(
    path.join(__dirname, '..', 'wrangler.toml'),
    'utf8',
  );
  const workerFirstMatch = wrangler.match(
    /run_worker_first\s*=\s*\[([^\]]*)\]/,
  );
  const workerFirstRoutes = workerFirstMatch
    ? [...workerFirstMatch[1].matchAll(/["']([^"']+)["']/g)].map(
        (match) => match[1],
      )
    : [];
  const durableObjectBindings = (
    wrangler.match(/\[\[durable_objects\.bindings\]\]/g) || []
  ).length;
  if (
    !wrangler.includes('main = "worker/index.ts"') ||
    !wrangler.includes('directory = "./dist"') ||
    JSON.stringify(workerFirstRoutes) !== JSON.stringify(['/api/feedback']) ||
    durableObjectBindings !== 1 ||
    !wrangler.includes('class_name = "FeedbackRateLimiter"') ||
    !wrangler.includes('not_found_handling = "404-page"') ||
    /run_worker_first\s*=\s*true/.test(wrangler)
  ) {
    throw new Error(
      'Workers Static Assets must serve dist and execute code only for /api/feedback',
    );
  }
}

function main() {
  if (!fs.existsSync(DIST)) {
    throw new Error('dist does not exist; run yarn build');
  }
  const missing = REQUIRED.filter(
    (file) => !fs.existsSync(path.join(DIST, file)),
  );
  if (missing.length) throw new Error(`missing ${missing.join(', ')}`);
  checkWorkerConfig();
  const { count, largest, errors } = checkDeployableFiles(DIST);
  if (errors.length) throw new Error(errors.join('; '));
  console.log(
    `Build valid: ${count} files, largest ${largest.file} (${(largest.bytes / 1024).toFixed(0)} KiB)`,
  );
}

try {
  main();
} catch (error) {
  console.error(`Build validation failed: ${error.message}`);
  process.exitCode = 1;
}

const fs = require('fs');
const path = require('path');
const historicalManifest = require('../data/historical-manifest.json');
const historicalAssets = require('../data/historical-assets.json');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'out');
const MAX_CLOUDFLARE_ASSET_BYTES = 25 * 1024 * 1024;
const MAX_CLOUDFLARE_FILES = 20_000;

function fail(message) {
  throw new Error(`Static export validation failed: ${message}`);
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const destination = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(destination) : [destination];
  });
}

function requireFile(relative) {
  const destination = path.join(OUT, relative);
  if (!fs.existsSync(destination)) fail(`missing ${relative}`);
  return destination;
}

function main() {
  if (!fs.existsSync(OUT)) fail('out/ does not exist; run yarn build');
  [
    'index.html',
    '404.html',
    'pa/school-districts.html',
    '_headers',
    '_redirects',
    'robots.txt',
    'sitemap.xml',
  ].forEach(requireFile);
  historicalManifest.years.forEach((year) => requireFile(`year/${year}.html`));
  Object.values(historicalAssets.assets).forEach((asset) =>
    requireFile(asset.url.replace(/^\//, '')),
  );
  requireFile('data/pa-school-districts.json');

  const wrangler = fs.readFileSync(path.join(ROOT, 'wrangler.toml'), 'utf8');
  if (
    !wrangler.includes('main = "worker/index.ts"') ||
    !wrangler.includes('directory = "./out"') ||
    !wrangler.includes('run_worker_first = ["/api/feedback"]') ||
    !wrangler.includes('not_found_handling = "404-page"') ||
    /run_worker_first\s*=\s*true/.test(wrangler)
  ) {
    fail('Workers Static Assets must execute code only for /api/feedback');
  }

  const headers = fs.readFileSync(requireFile('_headers'), 'utf8');
  if (
    !headers.includes('/_next/static/*') ||
    !headers.includes('/data/historical/*') ||
    !headers.includes('max-age=31536000, immutable')
  ) {
    fail('static immutable cache headers are missing');
  }
  const redirectRules = fs
    .readFileSync(requireFile('_redirects'), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  if (redirectRules.some((rule) => rule.startsWith('/*'))) {
    fail('a broad redirect would intercept static routes or 404s');
  }

  if (fs.existsSync(path.join(ROOT, 'pages', 'api')))
    fail('Next API routes remain in the static app');
  if (fs.existsSync(path.join(ROOT, 'functions')))
    fail('Pages Functions remain; the exact Worker route is authoritative');
  const workerFiles = walk(path.join(ROOT, 'worker')).map((file) =>
    path.relative(path.join(ROOT, 'worker'), file),
  );
  if (JSON.stringify(workerFiles) !== JSON.stringify(['index.ts'])) {
    fail(`unexpected Worker files: ${workerFiles.join(', ')}`);
  }

  const files = walk(OUT);
  const browserFiles = files.filter((file) =>
    ['.html', '.js'].includes(path.extname(file)),
  );
  for (const file of browserFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (
      content.includes('/api/borders') ||
      content.includes('/api/wikipedia')
    ) {
      fail(`${path.relative(OUT, file)} references a removed runtime route`);
    }
  }
  if (files.length > MAX_CLOUDFLARE_FILES)
    fail(`file count ${files.length} exceeds Cloudflare static asset limit`);
  const oversized = files.find(
    (file) => fs.statSync(file).size > MAX_CLOUDFLARE_ASSET_BYTES,
  );
  if (oversized)
    fail(
      `${path.relative(OUT, oversized)} exceeds the 25 MiB static asset limit`,
    );

  const sitemap = fs.readFileSync(requireFile('sitemap.xml'), 'utf8');
  historicalManifest.years.forEach((year) => {
    if (
      !sitemap.includes(`<loc>https://historicborders.app/year/${year}</loc>`)
    ) {
      fail(`sitemap omits year ${year}`);
    }
  });

  console.log(
    `Static export is valid (${files.length} files; approved dynamic route: /api/feedback)`,
  );
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

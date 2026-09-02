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
    '_routes.json',
    'robots.txt',
    'sitemap.xml',
  ].forEach(requireFile);
  historicalManifest.years.forEach((year) => requireFile(`year/${year}.html`));
  Object.values(historicalAssets.assets).forEach((asset) =>
    requireFile(asset.url.replace(/^\//, '')),
  );
  requireFile('data/pa-school-districts.json');

  const routes = JSON.parse(
    fs.readFileSync(requireFile('_routes.json'), 'utf8'),
  );
  if (
    routes.version !== 1 ||
    JSON.stringify(routes.include) !== JSON.stringify(['/api/feedback']) ||
    !Array.isArray(routes.exclude) ||
    routes.exclude.length !== 0
  ) {
    fail('_routes.json must invoke Functions only for /api/feedback');
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
  const functionFiles = fs.existsSync(path.join(ROOT, 'functions'))
    ? walk(path.join(ROOT, 'functions'))
    : [];
  const relativeFunctions = functionFiles.map((file) =>
    path.relative(path.join(ROOT, 'functions'), file),
  );
  if (
    JSON.stringify(relativeFunctions) !==
    JSON.stringify([path.join('api', 'feedback.ts')])
  ) {
    fail(`unexpected dynamic functions: ${relativeFunctions.join(', ')}`);
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
    fail(`file count ${files.length} exceeds Cloudflare Pages limit`);
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

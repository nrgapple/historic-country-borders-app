const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const chunksDirectory = path.join(ROOT, '.next/static/chunks');
const budgets = {
  totalJavaScript: 2100 * 1024,
  largestJavaScriptChunk: 1550 * 1024,
  initialRouteJavaScript: 400 * 1024,
  // Combined per-year payloads (production until the remaster cutover).
  historicalDataTotal: 32 * 1024 * 1024,
  historicalDataLargest: 2600 * 1024,
  // Split per-year files for the remaster, measured at Brotli quality 5,
  // close to what Cloudflare's on-the-fly compression sends. 1492 is the
  // outlier (~698 KiB polygons); the median year is far smaller.
  splitDataTotal: 32 * 1024 * 1024,
  splitPolygonsLargestBrotli: 800 * 1024,
  splitLabelsLargestBrotli: 64 * 1024,
  splitIndexLargestBrotli: 96 * 1024,
  // REMASTER_PLAN.md §6 trigger for reconsidering vector tiles: more than
  // five years above 300 KB Brotli. Brotli-5 is stricter than the plan's -11.
  splitPolygonYearsOver300KiB: 5,
  contextDataTotal: 2 * 1024 * 1024,
  contextDataLargest: 96 * 1024,
  capitalsDataLargest: 48 * 1024,
  schoolDataRaw: 12000 * 1024,
  schoolDataBrotli: 1850 * 1024,
};

if (!fs.existsSync(chunksDirectory)) {
  console.error('Missing .next build output. Run `yarn build` first.');
  process.exit(1);
}

const walk = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
const bytes = (file) => fs.statSync(file).size;
const formatKiB = (value) => `${(value / 1024).toFixed(1)} KiB`;
const errors = [];
const enforce = (label, actual, limit) => {
  if (actual > limit)
    errors.push(`${label}: ${formatKiB(actual)} exceeds ${formatKiB(limit)}`);
};

const javascriptFiles = walk(chunksDirectory)
  .filter((file) => file.endsWith('.js'))
  .map((file) => ({ file: path.relative(ROOT, file), bytes: bytes(file) }))
  .sort((a, b) => b.bytes - a.bytes);
const totalJavaScript = javascriptFiles.reduce(
  (total, file) => total + file.bytes,
  0,
);
const largestJavaScript = javascriptFiles[0]?.bytes || 0;

enforce('Total JavaScript', totalJavaScript, budgets.totalJavaScript);
enforce(
  'Largest JavaScript chunk',
  largestJavaScript,
  budgets.largestJavaScriptChunk,
);

const buildManifest = require('../.next/build-manifest.json');
const routeSizes = ['/year/[year]', '/pa/school-districts'].map((route) => {
  const routeFiles = [
    ...new Set([
      ...(buildManifest.pages['/_app'] || []),
      ...(buildManifest.pages[route] || []),
    ]),
  ].filter((file) => file.endsWith('.js'));
  const size = routeFiles.reduce(
    (total, file) => total + bytes(path.join(ROOT, '.next', file)),
    0,
  );
  enforce(`${route} initial JavaScript`, size, budgets.initialRouteJavaScript);
  return { route, size };
});

const brotli5 = (file) =>
  zlib.brotliCompressSync(fs.readFileSync(file), {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 5,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: bytes(file),
    },
  }).length;
const historicalDirectoryFiles = walk(path.join(ROOT, 'out/data/historical'));
const historicalFiles = historicalDirectoryFiles.filter((file) =>
  /^[a-z0-9]+\.[a-f0-9]{16}\.json$/.test(path.basename(file)),
);
const historicalSizes = historicalFiles.map(bytes);
const historicalTotal = historicalSizes.reduce(
  (total, size) => total + size,
  0,
);
const historicalLargest = Math.max(0, ...historicalSizes);
enforce('Historical data total', historicalTotal, budgets.historicalDataTotal);
enforce(
  'Largest historical payload',
  historicalLargest,
  budgets.historicalDataLargest,
);

const splitKinds = ['polygons', 'labels', 'index'];
const split = Object.fromEntries(splitKinds.map((kind) => [kind, []]));
historicalDirectoryFiles.forEach((file) => {
  const match = path
    .basename(file)
    .match(/^[a-z0-9]+\.(polygons|labels|index)\.[a-f0-9]{16}\.json$/);
  if (match) split[match[1]].push({ raw: bytes(file), brotli: brotli5(file) });
});
splitKinds.forEach((kind) => {
  if (split[kind].length !== historicalFiles.length)
    errors.push(
      `Split ${kind}: ${split[kind].length} files for ${historicalFiles.length} years`,
    );
});
const splitTotal = splitKinds
  .flatMap((kind) => split[kind])
  .reduce((total, file) => total + file.raw, 0);
const largestBrotli = (kind) =>
  Math.max(0, ...split[kind].map((file) => file.brotli));
const polygonYearsOver300 = split.polygons.filter(
  (file) => file.brotli > 300 * 1024,
).length;
enforce('Split historical data total', splitTotal, budgets.splitDataTotal);
enforce(
  'Largest split polygons (Brotli-5)',
  largestBrotli('polygons'),
  budgets.splitPolygonsLargestBrotli,
);
enforce(
  'Largest split labels (Brotli-5)',
  largestBrotli('labels'),
  budgets.splitLabelsLargestBrotli,
);
enforce(
  'Largest split index (Brotli-5)',
  largestBrotli('index'),
  budgets.splitIndexLargestBrotli,
);
if (polygonYearsOver300 > budgets.splitPolygonYearsOver300KiB)
  errors.push(
    `Split polygons: ${polygonYearsOver300} years exceed 300 KiB Brotli-5 (limit ${budgets.splitPolygonYearsOver300KiB}); see REMASTER_PLAN.md §6`,
  );

const contextDirectoryFiles = walk(path.join(ROOT, 'out/data/context'));
const isCapitals = (file) => /\.capitals\.[a-f0-9]{16}\.json$/.test(file);
const contextSizes = contextDirectoryFiles
  .filter((file) => file.endsWith('.json') && !isCapitals(file))
  .map(bytes);
const contextTotal = contextSizes.reduce((total, size) => total + size, 0);
const contextLargest = Math.max(0, ...contextSizes);
if (!contextSizes.length)
  errors.push('Context data: no files in out/data/context');
enforce('Context data total', contextTotal, budgets.contextDataTotal);
enforce('Largest context file', contextLargest, budgets.contextDataLargest);
const capitalsSizes = contextDirectoryFiles.filter(isCapitals).map(bytes);
if (capitalsSizes.length !== historicalFiles.length)
  errors.push(
    `Capitals: ${capitalsSizes.length} files for ${historicalFiles.length} years`,
  );
const capitalsLargest = Math.max(0, ...capitalsSizes);
enforce('Largest capitals file', capitalsLargest, budgets.capitalsDataLargest);

const schoolDataPath = path.join(ROOT, 'out/data/pa-school-districts.json');
const schoolRaw = bytes(schoolDataPath);
const schoolBrotli = zlib.brotliCompressSync(
  fs.readFileSync(schoolDataPath),
).length;
enforce('School payload raw', schoolRaw, budgets.schoolDataRaw);
enforce('School payload Brotli', schoolBrotli, budgets.schoolDataBrotli);

const summary = [
  '## Performance and build-size budgets',
  '',
  `- JavaScript chunks: ${formatKiB(totalJavaScript)} / ${formatKiB(budgets.totalJavaScript)}`,
  `- Largest JavaScript chunk: ${formatKiB(largestJavaScript)} / ${formatKiB(budgets.largestJavaScriptChunk)}`,
  ...routeSizes.map(
    ({ route, size }) =>
      `- ${route} initial JavaScript: ${formatKiB(size)} / ${formatKiB(budgets.initialRouteJavaScript)}`,
  ),
  `- Historical data: ${formatKiB(historicalTotal)} total / ${formatKiB(budgets.historicalDataTotal)}; ${formatKiB(historicalLargest)} largest / ${formatKiB(budgets.historicalDataLargest)}`,
  `- Split historical data: ${formatKiB(splitTotal)} total / ${formatKiB(budgets.splitDataTotal)}; Brotli-5 largest polygons ${formatKiB(largestBrotli('polygons'))} / ${formatKiB(budgets.splitPolygonsLargestBrotli)}, labels ${formatKiB(largestBrotli('labels'))} / ${formatKiB(budgets.splitLabelsLargestBrotli)}, index ${formatKiB(largestBrotli('index'))} / ${formatKiB(budgets.splitIndexLargestBrotli)}; ${polygonYearsOver300} polygon years over 300 KiB / ${budgets.splitPolygonYearsOver300KiB}`,
  `- Capitals: ${formatKiB(capitalsLargest)} largest / ${formatKiB(budgets.capitalsDataLargest)}`,
  `- Context data: ${formatKiB(contextTotal)} total / ${formatKiB(budgets.contextDataTotal)}; ${formatKiB(contextLargest)} largest / ${formatKiB(budgets.contextDataLargest)}`,
  `- School data: ${formatKiB(schoolRaw)} raw / ${formatKiB(budgets.schoolDataRaw)}; ${formatKiB(schoolBrotli)} Brotli / ${formatKiB(budgets.schoolDataBrotli)}`,
];

console.log(summary.slice(2).join('\n'));
console.log('\nLargest chunks:');
javascriptFiles
  .slice(0, 5)
  .forEach(({ file, bytes: size }) =>
    console.log(`- ${formatKiB(size)} ${file}`),
  );
if (process.env.GITHUB_STEP_SUMMARY)
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n`);
if (errors.length) {
  console.error(
    `\nPerformance budget failures:\n${errors.map((error) => `- ${error}`).join('\n')}`,
  );
  process.exitCode = 1;
}

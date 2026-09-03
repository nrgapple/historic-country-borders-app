const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const chunksDirectory = path.join(ROOT, '.next/static/chunks');
const budgets = {
  totalJavaScript: 2100 * 1024,
  largestJavaScriptChunk: 1550 * 1024,
  initialRouteJavaScript: 400 * 1024,
  historicalDataTotal: 55 * 1024 * 1024,
  historicalDataLargest: 3500 * 1024,
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

const historicalFiles = walk(path.join(ROOT, 'out/data/historical')).filter(
  (file) => file.endsWith('.json'),
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

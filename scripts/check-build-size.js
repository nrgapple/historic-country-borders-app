'use strict';

// Performance and build-size budgets for the production build (dist).
// Run after `yarn build`. Every file in the build counts against the
// Cloudflare Free plan's per-version file limit; the per-year data, glyph and
// font budgets keep first loads small on school networks.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { checkDeployableFiles } = require('./lib/deploy-files');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const budgets = {
  // Split per-year files, measured at Brotli quality 5, close to what
  // Cloudflare's on-the-fly compression sends. 1492 is the outlier
  // (~698 KiB polygons); the median year is far smaller.
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
  // Self-hosted fonts and map glyphs (docs/FONTS.md). Glyph PBFs are fetched
  // per visible range, so the per-file limit matters more than the total.
  glyphFiles: 160,
  glyphTotal: 3 * 1024 * 1024,
  glyphLargest: 128 * 1024,
  fontFiles: 80,
  fontTotal: 1100 * 1024,
  defaultLatinFonts: 240 * 1024,
  projectorLatinFonts: 64 * 1024,
  // Literata 400, 400 italic and 600 for the Modern textbook map style.
  textbookLatinFonts: 72 * 1024,
};

const walk = (directory) =>
  fs.existsSync(directory)
    ? fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(entryPath) : [entryPath];
      })
    : [];
const bytes = (file) => fs.statSync(file).size;
const formatKiB = (value) => `${(value / 1024).toFixed(1)} KiB`;
const brotli5 = (file) =>
  zlib.brotliCompressSync(fs.readFileSync(file), {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 5,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: bytes(file),
    },
  }).length;
const errors = [];
const enforce = (label, actual, limit) => {
  if (actual > limit)
    errors.push(`${label}: ${formatKiB(actual)} exceeds ${formatKiB(limit)}`);
};

if (!fs.existsSync(DIST)) {
  console.error('Missing dist. Run `yarn build` first.');
  process.exit(1);
}

// Every file wrangler uploads, including the T2 basemap, T8's PA street
// basemap and the district tiles.
const deployable = checkDeployableFiles(DIST);
errors.push(...deployable.errors.map((e) => `dist: ${e}`));
const count = (rel) => walk(path.join(DIST, rel)).length;

const split = { polygons: [], labels: [], index: [] };
walk(path.join(DIST, 'data/historical')).forEach((file) => {
  const match = path
    .basename(file)
    .match(/^[a-z0-9]+\.(polygons|labels|index)\.[a-f0-9]{16}\.json$/);
  if (match) split[match[1]].push({ raw: bytes(file), brotli: brotli5(file) });
});
const years = split.polygons.length;
if (!years) errors.push('Split year data: no files in data/historical');
['labels', 'index'].forEach((kind) => {
  if (split[kind].length !== years)
    errors.push(
      `Split ${kind}: ${split[kind].length} files for ${years} years`,
    );
});
const splitTotal = Object.values(split)
  .flat()
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

const contextFiles = walk(path.join(DIST, 'data/context')).filter((file) =>
  file.endsWith('.json'),
);
const isCapitals = (file) => /\.capitals\.[a-f0-9]{16}\.json$/.test(file);
const contextSizes = contextFiles.filter((f) => !isCapitals(f)).map(bytes);
const contextTotal = contextSizes.reduce((total, size) => total + size, 0);
const contextLargest = Math.max(0, ...contextSizes);
if (!contextSizes.length) errors.push('Context data: no files in data/context');
enforce('Context data total', contextTotal, budgets.contextDataTotal);
enforce('Largest context file', contextLargest, budgets.contextDataLargest);
const capitalsSizes = contextFiles.filter(isCapitals).map(bytes);
if (capitalsSizes.length !== years)
  errors.push(`Capitals: ${capitalsSizes.length} files for ${years} years`);
const capitalsLargest = Math.max(0, ...capitalsSizes);
enforce('Largest capitals file', capitalsLargest, budgets.capitalsDataLargest);

const glyphSizes = walk(path.join(DIST, 'glyphs'))
  .filter((file) => file.endsWith('.pbf'))
  .map(bytes);
const glyphTotal = glyphSizes.reduce((total, size) => total + size, 0);
const glyphLargest = Math.max(0, ...glyphSizes);
if (!glyphSizes.length) errors.push('Glyphs: no PBFs in glyphs/');
if (glyphSizes.length > budgets.glyphFiles)
  errors.push(
    `Glyph files: ${glyphSizes.length} exceeds ${budgets.glyphFiles}`,
  );
enforce('Glyph PBF total', glyphTotal, budgets.glyphTotal);
enforce('Largest glyph PBF', glyphLargest, budgets.glyphLargest);

const fontSizes = walk(path.join(DIST, 'fonts/files'))
  .filter((file) => file.endsWith('.woff2'))
  .map(bytes);
const fontTotal = fontSizes.reduce((total, size) => total + size, 0);
if (fontSizes.length > budgets.fontFiles)
  errors.push(`Font files: ${fontSizes.length} exceeds ${budgets.fontFiles}`);
enforce('WOFF2 total', fontTotal, budgets.fontTotal);
// The Latin subsets of each UI group: what a page in English downloads at most.
const fontManifest = require('../data/map-fonts.json');
const latinFontBytes = (group) =>
  fontManifest.fonts.ui[group]
    .filter((file) => /-latin-\d/.test(file))
    .reduce((total, file) => total + bytes(path.join(DIST, file)), 0);
const defaultLatinFonts = latinFontBytes('default');
const projectorLatinFonts = latinFontBytes('projector');
const textbookLatinFonts = latinFontBytes('textbook');
enforce('Default UI Latin fonts', defaultLatinFonts, budgets.defaultLatinFonts);
enforce(
  'Projector UI Latin fonts',
  projectorLatinFonts,
  budgets.projectorLatinFonts,
);
enforce(
  'Textbook UI Latin fonts',
  textbookLatinFonts,
  budgets.textbookLatinFonts,
);

const summary = [
  '## Performance and build-size budgets',
  '',
  `- Deployable files in dist/: ${deployable.count} / ${deployable.maxFiles} (Cloudflare Free limit 20,000); largest ${formatKiB(deployable.largest.bytes)} ${deployable.largest.file}`,
  `  - T2 basemap ${count('tiles/basemap') + count('basemap')}, T8 PA street basemap ${count('tiles/pa')}, PA district tiles ${count('tiles/pa-districts')}, glyphs ${count('glyphs')}, fonts ${count('fonts')}, year data ${count('data/historical') + count('data/context')}`,
  `- Split historical data (${years} years): ${formatKiB(splitTotal)} total / ${formatKiB(budgets.splitDataTotal)}; Brotli-5 largest polygons ${formatKiB(largestBrotli('polygons'))} / ${formatKiB(budgets.splitPolygonsLargestBrotli)}, labels ${formatKiB(largestBrotli('labels'))} / ${formatKiB(budgets.splitLabelsLargestBrotli)}, index ${formatKiB(largestBrotli('index'))} / ${formatKiB(budgets.splitIndexLargestBrotli)}; ${polygonYearsOver300} polygon years over 300 KiB / ${budgets.splitPolygonYearsOver300KiB}`,
  `- Capitals: ${formatKiB(capitalsLargest)} largest / ${formatKiB(budgets.capitalsDataLargest)}`,
  `- Context data: ${formatKiB(contextTotal)} total / ${formatKiB(budgets.contextDataTotal)}; ${formatKiB(contextLargest)} largest / ${formatKiB(budgets.contextDataLargest)}`,
  `- Glyph PBFs: ${glyphSizes.length} files / ${budgets.glyphFiles}; ${formatKiB(glyphTotal)} total / ${formatKiB(budgets.glyphTotal)}; ${formatKiB(glyphLargest)} largest / ${formatKiB(budgets.glyphLargest)}`,
  `- WOFF2 fonts: ${fontSizes.length} files / ${budgets.fontFiles}; ${formatKiB(fontTotal)} total / ${formatKiB(budgets.fontTotal)}; Latin UI ${formatKiB(defaultLatinFonts)} default / ${formatKiB(budgets.defaultLatinFonts)}, ${formatKiB(projectorLatinFonts)} projector / ${formatKiB(budgets.projectorLatinFonts)}, ${formatKiB(textbookLatinFonts)} textbook / ${formatKiB(budgets.textbookLatinFonts)}`,
];

console.log(summary.slice(2).join('\n'));
if (process.env.GITHUB_STEP_SUMMARY)
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n`);
if (errors.length) {
  console.error(
    `\nPerformance budget failures:\n${errors.map((error) => `- ${error}`).join('\n')}`,
  );
  process.exitCode = 1;
}

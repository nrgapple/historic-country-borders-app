#!/usr/bin/env node
// Explicit build step for self-hosted fonts and MapLibre glyph PBFs:
//
//   yarn data:refresh:fonts
//
// 1. Scans published names (scripts/lib/map-fonts.js NAME_DIRECTORIES) for the
//    codepoints and 256-codepoint glyph ranges they use.
// 2. Copies the needed @fontsource WOFF2 subsets to public/fonts/files with
//    content-hashed names, subsets the pinned full Noto Sans to the characters
//    no other font covers, and writes the @font-face CSS and OFL copies.
// 3. Renders one SDF glyph PBF per fontstack and needed range with Chromium's
//    text rasterizer and @mapbox/tiny-sdf (MapLibre's own SDF code) into
//    public/glyphs/<buildId>/<fontstack>/<range>.pbf. Each fontstack merges
//    its primary font with Noto fallbacks for characters the primary lacks.
// 4. Writes data/map-fonts.json, the manifest the validator and style read.
//
// The only network access is the one-time download of the pinned Noto Sans
// (verified by SHA-256, cached under ~/LargeFiles). Requires Playwright's
// Chromium (`yarn playwright install chromium`). Never run at deploy time.
const fs = require('fs');
const os = require('os');
const path = require('path');
const fontkit = require('fontkit');
const { subsetToWoff2 } = require('./lib/font-subset');
const {
  CSS_FILES,
  FONTSTACKS,
  MANIFEST_PATH,
  NOTO_SANS_SOURCE,
  PUBLIC_FONTS,
  PUBLIC_GLYPHS,
  ROOT,
  SDF,
  TOP_ADJUSTMENT,
  UI_FACES,
  collectPublishedNames,
  encodeGlyphPbf,
  faceFiles,
  fontsourceDir,
  fontsourceVersion,
  fontstackChain,
  formatUnicodeRange,
  inRanges,
  isControl,
  parseUnicodeRange,
  rangeName,
  rangeStart,
  rangesOf,
  sha256,
  sniffedFace,
  subtractCodePoints,
  summarizeScripts,
} = require('./lib/map-fonts');

const CACHE =
  process.env.HB_FONT_CACHE ||
  path.join(os.homedir(), 'LargeFiles/historic-borders/fonts');
const NOTO = NOTO_SANS_SOURCE.package;
const hex = (codePoint) =>
  `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;

const cmapCache = new Map();
/** The exact codepoints a font file maps, from its cmap table. */
function cmap(file) {
  if (!cmapCache.has(file)) {
    cmapCache.set(
      file,
      new Set(fontkit.create(fs.readFileSync(file)).characterSet),
    );
  }
  return cmapCache.get(file);
}

/** Downloads one pinned google/fonts file into the cache and verifies it. */
async function pinnedNotoFile(key) {
  const { path: repoPath, sha256: expected } = NOTO_SANS_SOURCE.files[key];
  const cached = path.join(
    CACHE,
    'google-fonts',
    NOTO_SANS_SOURCE.commit,
    path.basename(repoPath),
  );
  if (!fs.existsSync(cached)) {
    const url = `https://raw.githubusercontent.com/google/fonts/${NOTO_SANS_SOURCE.commit}/${repoPath
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
    console.log(`downloading ${url}`);
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 16 * 1024 * 1024)
      throw new Error(`${url}: unexpectedly large`);
    fs.mkdirSync(path.dirname(cached), { recursive: true });
    fs.writeFileSync(cached, bytes);
  }
  const bytes = fs.readFileSync(cached);
  if (sha256(bytes) !== expected) {
    throw new Error(
      `${cached} does not match the pinned SHA-256; delete it and retry`,
    );
  }
  return bytes;
}

/** The file of an ordered list that draws a codepoint: the first whose declared range and cmap hold it. */
const sourceFor = (files, codePoint) =>
  files.find(
    (entry) =>
      inRanges(entry.ranges, codePoint) && cmap(entry.file).has(codePoint),
  );

/** Files that draw at least one needed codepoint (first match wins), plus `always` subsets, in list order. */
function selectFiles(files, needed, always = []) {
  const used = new Set(files.filter((entry) => always.includes(entry.subset)));
  for (const codePoint of needed) {
    const source = sourceFor(files, codePoint);
    if (source) used.add(source);
  }
  return files.filter((entry) => used.has(entry));
}

/**
 * A file's declared unicode-range minus the needed codepoints it lacks, so
 * neither the browser nor MapLibre's `font-faces` picks it for a published
 * character it cannot draw.
 */
const effectiveRange = (entry, needed) =>
  formatUnicodeRange(
    subtractCodePoints(
      entry.ranges,
      needed.filter(
        (codePoint) =>
          inRanges(entry.ranges, codePoint) && !cmap(entry.file).has(codePoint),
      ),
    ),
  );

async function build() {
  const {
    files: nameFiles,
    names,
    codePoints,
    clusters,
  } = collectPublishedNames();
  if (!names.size)
    throw new Error(
      'No published names found; run yarn data:refresh:historical',
    );
  const needed = [...codePoints.keys()].sort((a, b) => a - b);
  const ranges = [...new Set(needed.map(rangeStart))].sort((a, b) => a - b);
  console.log(
    `names: ${names.size} distinct strings in ${nameFiles.length} files; ` +
      `${needed.length} codepoints in ${ranges.length} ranges; ${clusters.size} multi-codepoint clusters`,
  );

  // --- The Noto Sans subset ---------------------------------------------------
  // Codepoints some primary font lacks, plus every codepoint of a cluster some
  // primary cannot draw whole, so the browser can draw that cluster from one font.
  const chains = Object.fromEntries(
    Object.keys(FONTSTACKS).map((name) => [name, fontstackChain(name)]),
  );
  const primaries = [
    ...Object.values(chains).map((chain) => chain[0]),
    ...Object.values(UI_FACES)
      .flat()
      .filter((spec) => spec.pkg !== NOTO && !spec.subsets),
  ];
  const coverage = (spec) => {
    const set = new Set();
    for (const entry of faceFiles(spec))
      for (const codePoint of cmap(entry.file)) set.add(codePoint);
    return set;
  };
  const primaryCoverage = primaries.map(coverage);
  const notoWanted = new Set(
    needed.filter((codePoint) =>
      primaryCoverage.some((set) => !set.has(codePoint)),
    ),
  );
  for (const cluster of clusters.keys()) {
    const points = [...cluster].map((char) => char.codePointAt(0));
    if (
      primaryCoverage.some((set) =>
        points.some((codePoint) => !set.has(codePoint)),
      )
    ) {
      for (const codePoint of points) notoWanted.add(codePoint);
    }
  }
  const notoSources = {
    normal: await pinnedNotoFile('normal'),
    italic: await pinnedNotoFile('italic'),
  };
  const notoLicense = (await pinnedNotoFile('license')).toString('utf8');
  const notoFaces = new Map();
  const notoFaceFiles = async ({ weight, style }) => {
    const key = `${weight}-${style}`;
    if (!notoFaces.has(key)) {
      const source = notoSources[style === 'italic' ? 'italic' : 'normal'];
      const sourceCmap = new Set(fontkit.create(source).characterSet);
      const kept = [...notoWanted].filter((codePoint) =>
        sourceCmap.has(codePoint),
      );
      const woff2 = await subsetToWoff2(source, kept, {
        wght: weight,
        wdth: 100,
      });
      const file = path.join(CACHE, 'subsets', `${NOTO}-names-${key}.woff2`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, woff2);
      cmapCache.delete(file);
      notoFaces.set(key, [
        {
          pkg: NOTO,
          weight,
          style,
          subset: 'names',
          unicodeRange: formatUnicodeRange(rangesOf(kept)),
          file,
        },
      ]);
    }
    return notoFaces.get(key);
  };
  /** Subset files for a face spec, from fontsource or the Noto subset. */
  const filesFor = async (spec) => {
    const files = (
      spec.pkg === NOTO ? await notoFaceFiles(spec) : faceFiles(spec)
    ).map((entry) => ({
      ...entry,
      ranges: parseUnicodeRange(entry.unicodeRange),
    }));
    return spec.subsets
      ? files.filter((entry) => spec.subsets.includes(entry.subset))
      : files;
  };

  // --- Web fonts and CSS ------------------------------------------------------
  fs.rmSync(PUBLIC_FONTS, { recursive: true, force: true });
  fs.mkdirSync(path.join(PUBLIC_FONTS, 'files'), { recursive: true });
  fs.mkdirSync(path.join(PUBLIC_FONTS, 'licenses'), { recursive: true });
  const published = new Map();
  const packages = new Set();
  const publish = (entry) => {
    if (!published.has(entry.file)) {
      const bytes = fs.readFileSync(entry.file);
      const hash = sha256(bytes);
      const name = `${path.basename(entry.file, '.woff2')}.${hash.slice(0, 10)}.woff2`;
      fs.writeFileSync(path.join(PUBLIC_FONTS, 'files', name), bytes);
      const noto = entry.pkg === NOTO;
      published.set(entry.file, {
        path: `/fonts/files/${name}`,
        source: noto
          ? `${NOTO_SANS_SOURCE.repository} ${NOTO_SANS_SOURCE.files[entry.style === 'italic' ? 'italic' : 'normal'].path}`
          : `@fontsource/${entry.pkg}`,
        version: noto ? NOTO_SANS_SOURCE.commit : fontsourceVersion(entry.pkg),
        license: `/fonts/licenses/LICENSE-${entry.pkg}.txt`,
        subset: entry.subset,
        weight: entry.weight,
        style: entry.style,
        unicodeRange: effectiveRange(entry, needed),
        bytes: bytes.length,
        sha256: hash,
      });
      packages.add(entry.pkg);
    }
    return published.get(entry.file);
  };
  const fontFace = (
    family,
    entry,
    weight = entry.weight,
    style = entry.style,
  ) =>
    [
      '@font-face {',
      `  font-family: '${family}';`,
      `  font-style: ${style};`,
      `  font-weight: ${weight};`,
      '  font-display: swap;',
      `  src: url('files/${path.basename(publish(entry).path)}') format('woff2');`,
      `  unicode-range: ${publish(entry).unicodeRange.replace(/,/g, ', ')};`,
      '}',
    ].join('\n');

  const uiRules = {};
  const uiFiles = {};
  for (const [group, faces] of Object.entries(UI_FACES)) {
    uiRules[group] = [];
    uiFiles[group] = [];
    for (const spec of faces) {
      const files = await filesFor(spec);
      const chosen = spec.subsets
        ? files
        : selectFiles(files, needed, ['latin', 'names']);
      // Declared fallback-first: the browser tries the last declared face first.
      for (const entry of [...chosen].reverse()) {
        uiRules[group].push(fontFace(spec.family, entry));
        uiFiles[group].push(publish(entry).path);
      }
    }
  }

  // Alias faces named exactly like each fontstack. MapLibre 6 draws grapheme
  // clusters (a letter plus combining marks) locally, using the fontstack name
  // as the CSS family, so these keep those glyphs in the same fonts. Faces are
  // declared fallback-first because, for overlapping unicode-ranges, the
  // browser tries the last declared face first.
  const aliasRules = { default: [], projector: [] };
  const chainFiles = {};
  for (const [name, chain] of Object.entries(chains)) {
    const { weight, style } = sniffedFace(name);
    chainFiles[name] = [];
    for (const [index, spec] of chain.entries()) {
      for (const entry of await filesFor(spec))
        chainFiles[name].push({ ...entry, primary: index === 0 });
    }
    for (const entry of selectFiles(chainFiles[name], needed).reverse()) {
      aliasRules[FONTSTACKS[name].group].push(
        fontFace(name, entry, weight, style),
      );
    }
  }

  const header = (lines) =>
    [
      '/*',
      ' * Generated by scripts/build-map-fonts.js. Do not edit; see docs/FONTS.md.',
      ...lines.map((line) => ` * ${line}`),
      ' * Fonts: SIL Open Font License 1.1; license copies in /fonts/licenses/.',
      ' */',
      '',
    ].join('\n');
  const css = {
    [CSS_FILES.default]:
      header([
        'UI faces: Alegreya, Alegreya SC, Alegreya Sans, Historic Borders Scripts.',
      ]) + `${uiRules.default.join('\n\n')}\n`,
    [CSS_FILES.map]:
      header([
        'Map alias faces for the default fontstacks. Load on the map page only;',
        'a file downloads only when MapLibre draws a combining-mark cluster from it.',
      ]) + `${aliasRules.default.join('\n\n')}\n`,
    [CSS_FILES.projector]:
      header([
        'Projector text: Atkinson Hyperlegible Next UI faces and map alias faces.',
        'Load only when the Projector text setting is on.',
      ]) + `${[...uiRules.projector, ...aliasRules.projector].join('\n\n')}\n`,
  };
  for (const [file, text] of Object.entries(css))
    fs.writeFileSync(path.join(PUBLIC_FONTS, file), text);

  // --- Glyph PBFs ---------------------------------------------------------------
  let rendered;
  for (let attempt = 1; !rendered; attempt++) {
    try {
      rendered = await renderGlyphs({ needed, ranges, chainFiles });
    } catch (error) {
      if (attempt >= 2 || !/closed|crash/i.test(error.message)) throw error;
      console.warn(
        `Chromium stopped during glyph rendering (${error.message}); retrying once`,
      );
    }
  }
  const { buildFiles, chromiumVersion } = rendered;
  const buildId = sha256(
    buildFiles
      .map((f) => `${f.name}/${f.range}:${sha256(f.buffer)}`)
      .join('\n'),
  ).slice(0, 12);
  fs.rmSync(PUBLIC_GLYPHS, { recursive: true, force: true });
  const fontstacks = {};
  for (const { name, range, buffer, glyphs } of buildFiles) {
    const directory = path.join(PUBLIC_GLYPHS, buildId, name);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, `${range}.pbf`), buffer);
    fontstacks[name] ||= {
      group: FONTSTACKS[name].group,
      use: FONTSTACKS[name].use,
      ...sniffedFace(name),
      sources: chains[name].map((spec) =>
        spec.pkg === NOTO
          ? `Noto Sans ${spec.weight} ${spec.style} (google/fonts ${NOTO_SANS_SOURCE.commit.slice(0, 7)}, subset)`
          : `@fontsource/${spec.pkg} ${spec.weight} ${spec.style}`,
      ),
      // Ready-made input for a style's `font-faces`, in fallback order.
      faces: selectFiles(chainFiles[name], needed).map((entry) => ({
        url: publish(entry).path,
        'unicode-range': publish(entry).unicodeRange.split(','),
      })),
      ranges: {},
    };
    fontstacks[name].ranges[range] = {
      bytes: buffer.length,
      glyphs,
      sha256: sha256(buffer),
    };
  }

  // --- Licenses and manifest ----------------------------------------------------
  const licenses = [...packages].sort().map((pkg) => {
    const noto = pkg === NOTO;
    const text = noto
      ? notoLicense
      : fs.readFileSync(path.join(fontsourceDir(pkg), 'LICENSE'), 'utf8');
    if (!/SIL OPEN FONT LICENSE Version 1\.1/i.test(text)) {
      throw new Error(`${pkg} is not licensed under OFL 1.1`);
    }
    const file = `LICENSE-${pkg}.txt`;
    fs.writeFileSync(path.join(PUBLIC_FONTS, 'licenses', file), text);
    return {
      font: noto
        ? NOTO_SANS_SOURCE.name
        : JSON.parse(
            fs.readFileSync(
              path.join(fontsourceDir(pkg), 'metadata.json'),
              'utf8',
            ),
          ).family,
      source: noto
        ? `${NOTO_SANS_SOURCE.repository} @ ${NOTO_SANS_SOURCE.commit}`
        : `@fontsource/${pkg}@${fontsourceVersion(pkg)}`,
      license: 'OFL-1.1',
      path: `/fonts/licenses/${file}`,
      sha256: sha256(text),
      copyright: [
        ...new Set(
          text.match(
            /Copyright \d{4}(?:-\d{4})? The [^(\n]+?Authors \([^)\s]+\)/g,
          ) || [],
        ),
      ],
    };
  });
  const fontFiles = [...published.values()].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
  const cssFiles = Object.fromEntries(
    Object.entries(CSS_FILES).map(([group, file]) => {
      const bytes = fs.readFileSync(path.join(PUBLIC_FONTS, file));
      return [
        group,
        { path: `/fonts/${file}`, bytes: bytes.length, sha256: sha256(bytes) },
      ];
    }),
  );
  const manifest = {
    schemaVersion: 1,
    generatedBy: 'scripts/build-map-fonts.js',
    names: {
      files: nameFiles.length,
      distinct: names.size,
      codePoints: needed.length,
      codePointsSha256: sha256(needed.join(',')),
      clusters: clusters.size,
      ranges: ranges.map(rangeName),
      scripts: summarizeScripts(codePoints),
    },
    glyphs: {
      buildId,
      url: `/glyphs/${buildId}/{fontstack}/{range}.pbf`,
      renderer: {
        method: 'Chromium canvas text + @mapbox/tiny-sdf',
        chromium: chromiumVersion,
        tinySdf: JSON.parse(
          fs.readFileSync(
            path.join(ROOT, 'node_modules/@mapbox/tiny-sdf/package.json'),
            'utf8',
          ),
        ).version,
        ...SDF,
        topAdjustment: TOP_ADJUSTMENT,
      },
      fontstacks,
    },
    fonts: { css: cssFiles, ui: uiFiles, files: fontFiles },
    licenses,
  };
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  const glyphBytes = buildFiles.reduce(
    (total, f) => total + f.buffer.length,
    0,
  );
  const fontBytes = fontFiles.reduce((total, f) => total + f.bytes, 0);
  console.log(
    `glyphs: ${buildFiles.length} files, ${glyphBytes} bytes, build ${buildId}`,
  );
  console.log(`fonts: ${fontFiles.length} WOFF2 files, ${fontBytes} bytes`);
  console.log(
    `scripts: ${manifest.names.scripts.map((s) => `${s.script} (${s.codePoints})`).join(', ')}`,
  );
}

async function renderGlyphs({ needed, ranges, chainFiles }) {
  // Required lazily so a missing browser fails here with Playwright's message.
  const { chromium } = require('@playwright/test');
  const tinySdf = fs
    .readFileSync(
      path.join(ROOT, 'node_modules/@mapbox/tiny-sdf/index.js'),
      'utf8',
    )
    .replace('export default class TinySDF', 'window.TinySDF = class TinySDF');

  // Every file in every chain, registered under its own family so that each
  // codepoint is drawn by exactly the file whose cmap holds it: no system
  // fallback and no synthesized bold or italic.
  const familyOf = new Map();
  for (const files of Object.values(chainFiles)) {
    for (const entry of files) {
      if (!familyOf.has(entry.file))
        familyOf.set(entry.file, `hb-font-${familyOf.size}`);
    }
  }

  const browser = await chromium.launch();
  const chromiumVersion = browser.version();
  const page = await browser.newPage();
  await page.setContent(
    '<!doctype html><meta charset="utf-8"><title>glyphs</title>',
  );
  await page.addScriptTag({ content: tinySdf });
  await page.evaluate(
    async (faces) => {
      for (const { family, data } of faces) {
        const font = new FontFace(
          family,
          Uint8Array.from(atob(data), (c) => c.charCodeAt(0)),
        );
        await font.load();
        document.fonts.add(font);
      }
    },
    [...familyOf].map(([file, family]) => ({
      family,
      data: fs.readFileSync(file).toString('base64'),
    })),
  );

  const buildFiles = [];
  const missing = [];
  const neededSet = new Set(needed);
  for (const [name, files] of Object.entries(chainFiles)) {
    for (const start of ranges) {
      const assignments = [];
      for (let codePoint = start; codePoint < start + 256; codePoint++) {
        if (isControl(codePoint)) continue;
        // A range carries everything its primary font has, so it stays stable
        // when names change, but only the needed characters from fallbacks.
        const source = sourceFor(files, codePoint);
        if (source && (source.primary || neededSet.has(codePoint))) {
          assignments.push([codePoint, familyOf.get(source.file)]);
        } else if (!source && neededSet.has(codePoint))
          missing.push(`${name} ${hex(codePoint)}`);
      }
      const glyphs = await page.evaluate(
        ({ assignments, sdf }) => {
          const rasterizers = {};
          return assignments.map(([id, family]) => {
            rasterizers[family] ||= new window.TinySDF({
              ...sdf,
              fontFamily: `"${family}"`,
            });
            const g = rasterizers[family].draw(String.fromCodePoint(id));
            let bitmap = null;
            if (g.glyphWidth && g.glyphHeight) {
              let binary = '';
              for (const value of g.data) binary += String.fromCharCode(value);
              bitmap = btoa(binary);
            }
            return {
              id,
              bitmap,
              width: g.glyphWidth,
              height: g.glyphHeight,
              left: g.glyphLeft,
              top: g.glyphTop,
              advance: g.glyphAdvance,
            };
          });
        },
        { assignments, sdf: SDF },
      );
      const range = rangeName(start);
      const buffer = encodeGlyphPbf({
        name,
        range,
        glyphs: glyphs.map((g) => ({
          id: g.id,
          bitmap: g.bitmap ? Buffer.from(g.bitmap, 'base64') : null,
          width: g.width,
          height: g.height,
          left: g.left,
          top: g.top - TOP_ADJUSTMENT,
          advance: Math.max(0, Math.round(g.advance)),
        })),
      });
      buildFiles.push({ name, range, buffer, glyphs: glyphs.length });
    }
  }
  await browser.close();
  if (missing.length) {
    throw new Error(
      `No font covers these published codepoints:\n${missing.join('\n')}`,
    );
  }
  return { buildFiles, chromiumVersion };
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

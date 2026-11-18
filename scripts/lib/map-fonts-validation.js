// Checks the published fonts and glyph PBFs against data/map-fonts.json and
// against the names that are actually published. Pure apart from file reads,
// so tests can run it on fixture trees.
const fs = require('fs');
const path = require('path');
const {
  FONTSTACKS,
  checkStyleFontstacks,
  collectPublishedNames,
  decodeGlyphPbf,
  rangeName,
  rangeStart,
  sha256,
  walkFiles,
} = require('./map-fonts');

const IMMUTABLE = 'public, max-age=31536000, immutable';
const OFL_HEADER = /SIL OPEN FONT LICENSE Version 1\.1/i;
const hex = (codePoint) =>
  `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;

/** Parses a Cloudflare `_headers` file into { pattern: { header: value } }. */
function parseHeaders(text) {
  const rules = {};
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = line.trim();
      rules[current] ||= {};
    } else if (current) {
      const index = line.indexOf(':');
      if (index > 0)
        rules[current][line.slice(0, index).trim().toLowerCase()] = line
          .slice(index + 1)
          .trim();
    }
  }
  return rules;
}

/**
 * @param {object} options
 * @param {string} options.root - repository root holding public/ and data/
 * @param {object} options.manifest - parsed data/map-fonts.json
 * @param {object} [options.style] - a MapLibre style to check `text-font` against
 * @param {string[]} [options.nameDirectories] - override the scanned name directories
 * @param {string[]} [options.expectedFontstacks] - override the configured fontstack names
 * @returns {{ errors: string[], summary: object }}
 */
function validateMapFonts({
  root,
  manifest,
  style,
  nameDirectories,
  expectedFontstacks,
}) {
  const errors = [];
  const fail = (message) => errors.push(message);
  const publicDir = path.join(root, 'public');

  if (manifest.schemaVersion !== 1)
    fail('unsupported map-fonts manifest schema');
  const { buildId, url, fontstacks = {} } = manifest.glyphs || {};
  if (!/^[0-9a-f]{12}$/.test(buildId || ''))
    fail('glyph buildId is missing or malformed');
  if (url !== `/glyphs/${buildId}/{fontstack}/{range}.pbf`)
    fail(`glyph URL template ${url} is wrong`);

  const configured = expectedFontstacks || Object.keys(FONTSTACKS);
  for (const name of configured) {
    if (!fontstacks[name])
      fail(`fontstack "${name}" is configured but not built`);
  }
  for (const name of Object.keys(fontstacks)) {
    if (!configured.includes(name))
      fail(`fontstack "${name}" is built but not configured`);
    if (name.includes(','))
      fail(`fontstack "${name}" must not contain a comma`);
  }

  // Coverage: every codepoint of every published name, in every fontstack.
  const { names, codePoints } = collectPublishedNames(root, nameDirectories);
  if (!names.size) fail('no published names found');
  const byRange = new Map();
  for (const codePoint of codePoints.keys()) {
    const start = rangeStart(codePoint);
    if (!byRange.has(start)) byRange.set(start, []);
    byRange.get(start).push(codePoint);
  }
  const neededRanges = [...byRange.keys()].sort((a, b) => a - b).map(rangeName);
  const expectedFiles = new Set();
  let glyphBytes = 0;
  for (const [name, stack] of Object.entries(fontstacks)) {
    for (const [range, entry] of Object.entries(stack.ranges || {})) {
      expectedFiles.add(path.join('glyphs', buildId, name, `${range}.pbf`));
      if (!neededRanges.includes(range))
        fail(`${name} ${range} is published but no name needs it`);
    }
    for (const [start, needed] of byRange) {
      const range = rangeName(start);
      const entry = stack.ranges && stack.ranges[range];
      const file = path.join(
        publicDir,
        'glyphs',
        buildId,
        name,
        `${range}.pbf`,
      );
      if (!entry || !fs.existsSync(file)) {
        fail(
          `${name} is missing glyph range ${range} (needed for ${hex(needed[0])} in "${codePoints.get(needed[0])}")`,
        );
        continue;
      }
      const buffer = fs.readFileSync(file);
      glyphBytes += buffer.length;
      if (sha256(buffer) !== entry.sha256)
        fail(`${name}/${range}.pbf does not match the manifest hash`);
      let decoded;
      try {
        decoded = decodeGlyphPbf(buffer);
      } catch (error) {
        fail(`${name}/${range}.pbf is not a valid glyph PBF: ${error.message}`);
        continue;
      }
      if (
        decoded.length !== 1 ||
        decoded[0].name !== name ||
        decoded[0].range !== range
      ) {
        fail(`${name}/${range}.pbf declares the wrong fontstack or range`);
        continue;
      }
      const ids = new Set();
      for (const glyph of decoded[0].glyphs) {
        if (glyph.id < start || glyph.id > start + 255)
          fail(`${name}/${range}.pbf holds ${hex(glyph.id)} outside its range`);
        if (ids.has(glyph.id))
          fail(`${name}/${range}.pbf repeats ${hex(glyph.id)}`);
        ids.add(glyph.id);
        if (
          glyph.bitmap &&
          glyph.bitmap.length !== (glyph.width + 6) * (glyph.height + 6)
        ) {
          fail(
            `${name}/${range}.pbf ${hex(glyph.id)} has a bitmap of the wrong size`,
          );
        }
      }
      for (const codePoint of needed) {
        if (!ids.has(codePoint)) {
          fail(
            `${name} has no glyph for ${hex(codePoint)} used in "${codePoints.get(codePoint)}"`,
          );
        }
      }
    }
  }
  const glyphsDir = path.join(publicDir, 'glyphs');
  const publishedGlyphs = walkFiles(glyphsDir).map((file) =>
    path.relative(publicDir, file),
  );
  for (const file of publishedGlyphs) {
    if (!expectedFiles.has(file))
      fail(`public/${file} is not in the glyph manifest`);
  }

  // Web fonts and CSS.
  const fonts = manifest.fonts || { files: [], css: {} };
  const listed = new Map((fonts.files || []).map((file) => [file.path, file]));
  const licensePaths = new Set(
    (manifest.licenses || []).map((license) => license.path),
  );
  let fontBytes = 0;
  for (const file of listed.values()) {
    const absolute = path.join(publicDir, file.path);
    if (!fs.existsSync(absolute)) {
      fail(`font file ${file.path} is missing`);
      continue;
    }
    const bytes = fs.readFileSync(absolute);
    fontBytes += bytes.length;
    if (sha256(bytes) !== file.sha256)
      fail(`font file ${file.path} does not match the manifest hash`);
    if (!/^\/fonts\/files\/[\w.-]+\.[0-9a-f]{10}\.woff2$/.test(file.path)) {
      fail(`font file ${file.path} must have a content-hashed name`);
    }
    if (!licensePaths.has(file.license))
      fail(`font file ${file.path} has no listed license`);
  }
  for (const file of walkFiles(path.join(publicDir, 'fonts', 'files'))) {
    const published = `/${path.relative(publicDir, file).split(path.sep).join('/')}`;
    if (!listed.has(published))
      fail(`${published} is not in the font manifest`);
  }
  for (const [group, css] of Object.entries(fonts.css || {})) {
    const absolute = path.join(publicDir, css.path);
    if (!fs.existsSync(absolute)) {
      fail(`${group} CSS ${css.path} is missing`);
      continue;
    }
    const text = fs.readFileSync(absolute, 'utf8');
    if (sha256(text) !== css.sha256)
      fail(`${css.path} does not match the manifest hash`);
    for (const [, reference] of text.matchAll(/url\('([^']+)'\)/g)) {
      const target = path.posix.join(path.posix.dirname(css.path), reference);
      if (!listed.has(target))
        fail(`${css.path} references ${reference}, which is not published`);
    }
  }

  // Licenses.
  for (const license of manifest.licenses || []) {
    const absolute = path.join(publicDir, license.path);
    if (!fs.existsSync(absolute)) {
      fail(`license ${license.path} is missing`);
      continue;
    }
    const text = fs.readFileSync(absolute, 'utf8');
    if (sha256(text) !== license.sha256)
      fail(`license ${license.path} does not match the manifest hash`);
    if (license.license !== 'OFL-1.1' || !OFL_HEADER.test(text))
      fail(`license ${license.path} is not OFL 1.1`);
    if (!license.copyright || !license.copyright.length)
      fail(`license ${license.path} has no copyright line`);
  }
  if (!(manifest.licenses || []).length) fail('no font licenses listed');

  // Delivery headers: Wrangler sends .pbf without a Content-Type.
  const headersPath = path.join(publicDir, '_headers');
  const rules = fs.existsSync(headersPath)
    ? parseHeaders(fs.readFileSync(headersPath, 'utf8'))
    : {};
  const glyphRule = rules['/glyphs/*'] || {};
  if (glyphRule['content-type'] !== 'application/x-protobuf') {
    fail(
      'public/_headers must set Content-Type: application/x-protobuf for /glyphs/*',
    );
  }
  if (glyphRule['cache-control'] !== IMMUTABLE)
    fail('public/_headers must cache /glyphs/* as immutable');
  if ((rules['/fonts/files/*'] || {})['cache-control'] !== IMMUTABLE) {
    fail('public/_headers must cache /fonts/files/* as immutable');
  }

  if (style)
    for (const error of checkStyleFontstacks(style, manifest)) fail(error);

  return {
    errors,
    summary: {
      names: names.size,
      codePoints: codePoints.size,
      ranges: neededRanges,
      fontstacks: Object.keys(fontstacks).length,
      glyphFiles: publishedGlyphs.length,
      glyphBytes,
      fontFiles: listed.size,
      fontBytes,
      licenses: (manifest.licenses || []).length,
    },
  };
}

module.exports = { parseHeaders, validateMapFonts };

// Shared configuration and helpers for the self-hosted web fonts and the
// MapLibre glyph PBFs. Used by scripts/build-map-fonts.js (the explicit build
// step), scripts/validate-map-fonts.js (part of `yarn data:validate`) and the
// unit tests. See docs/FONTS.md.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'data', 'map-fonts.json');
const PUBLIC_FONTS = path.join(ROOT, 'public', 'fonts');
const PUBLIC_GLYPHS = path.join(ROOT, 'public', 'glyphs');

/**
 * Glyph SDF parameters. These are the values every glyph PBF server uses
 * (fontnik, font-maker) and that MapLibre's shader expects: 24 px glyphs with
 * a 3 px buffer, an 8 px distance radius and a 0.25 cutoff.
 */
const SDF = { fontSize: 24, buffer: 3, radius: 8, cutoff: 0.25 };
/** Glyph PBF `top` is measured from this baseline offset (MapLibre's topAdjustment). */
const TOP_ADJUSTMENT = 27;

/** A fontsource face: package name (without `@fontsource/`), weight and style. */
const face = (pkg, weight, style = 'normal') => ({ pkg, weight, style });

/**
 * The full Noto Sans (OFL 1.1) from google/fonts, pinned by commit and hash.
 * Fontsource's Noto Sans subsets drop combining marks such as U+0313 and
 * U+0328 and punctuation such as U+2027 that published names use, so the
 * build downloads the full variable font once (cached on the SSD), then
 * subsets and instances it to exactly the codepoints it has to supply.
 */
const NOTO_SANS_SOURCE = {
  package: 'noto-sans',
  name: 'Noto Sans',
  repository: 'https://github.com/google/fonts',
  commit: '7af0d90b4d532ffa4b041937b560c6df4e7b1e95',
  files: {
    normal: {
      path: 'ofl/notosans/NotoSans[wdth,wght].ttf',
      sha256:
        'bfb7bb691513f12e734dc346c03a03f784912432d7e3fa8e56efcf906fe86b3d',
    },
    italic: {
      path: 'ofl/notosans/NotoSans-Italic[wdth,wght].ttf',
      sha256:
        '58e6e0ebd1931b29a365aa2d3e2ee9a9e831a3af7cf3ad1462d4e72154f0b291',
    },
    license: {
      path: 'ofl/notosans/OFL.txt',
      sha256:
        'cee9892f9f0cc8fe882c9e9537ee6a89621d86ee7ceaf70b02e2b2b1c25c061a',
    },
  },
};

/**
 * Fallbacks merged into every map fontstack, in order. Static hosting cannot
 * combine fontstacks at request time, so each fontstack directory already
 * contains these glyphs for anything its primary font lacks.
 */
const FALLBACKS = (weight, style) => [
  face('noto-sans', weight, style),
  face('noto-sans-cherokee', weight),
  face('noto-sans-canadian-aboriginal', weight),
  face('noto-sans-osage', 400),
];

/**
 * Every MapLibre fontstack the Classic-atlas style may reference. Use each
 * name as a single-element `text-font` array: a multi-name array makes
 * MapLibre request a combined directory that does not exist.
 * `group` decides which CSS file carries the alias faces (see below).
 */
const FONTSTACKS = {
  'Alegreya SC Medium': {
    group: 'default',
    use: 'State and territory names',
    primary: face('alegreya-sc', 500),
  },
  'Alegreya SC Bold': {
    group: 'default',
    use: 'State names above 250,000 km²',
    primary: face('alegreya-sc', 700),
  },
  'Alegreya Medium Italic': {
    group: 'default',
    use: 'Sea and ocean names',
    primary: face('alegreya', 500, 'italic'),
  },
  'Alegreya Italic': {
    group: 'default',
    use: 'River and lake names',
    primary: face('alegreya', 400, 'italic'),
  },
  'Alegreya Regular': {
    group: 'default',
    use: 'City, capital and site names',
    primary: face('alegreya', 400),
  },
  'Atkinson Hyperlegible Next Medium': {
    group: 'projector',
    use: 'Projector text: water, cities and small labels',
    primary: face('atkinson-hyperlegible-next', 500),
  },
  'Atkinson Hyperlegible Next Bold': {
    group: 'projector',
    use: 'Projector text: state names (uppercase plus letter-spacing)',
    primary: face('atkinson-hyperlegible-next', 700),
  },
  'Literata Italic': {
    group: 'textbook',
    use: 'Modern textbook map style: sea, river and ruins names',
    primary: face('literata', 400, 'italic'),
  },
};

/** Web fonts for the page itself, grouped by the CSS file that declares them. */
const UI_FACES = {
  default: [
    { family: 'Alegreya', ...face('alegreya', 400) },
    { family: 'Alegreya', ...face('alegreya', 400, 'italic') },
    { family: 'Alegreya', ...face('alegreya', 500, 'italic') },
    { family: 'Alegreya', ...face('alegreya', 700) },
    { family: 'Alegreya SC', ...face('alegreya-sc', 500) },
    { family: 'Alegreya SC', ...face('alegreya-sc', 700) },
    { family: 'Alegreya Sans', ...face('alegreya-sans', 500) },
    { family: 'Alegreya Sans', ...face('alegreya-sans', 700) },
    // Characters in published names that no Alegreya cut covers. Each file
    // holds only those characters, so ordinary text never downloads them.
    { family: 'Historic Borders Scripts', ...face('noto-sans', 400) },
    { family: 'Historic Borders Scripts', ...face('noto-sans', 700) },
    {
      family: 'Historic Borders Scripts',
      ...face('noto-sans-cherokee', 400),
      subsets: ['cherokee'],
    },
    {
      family: 'Historic Borders Scripts',
      ...face('noto-sans-canadian-aboriginal', 400),
      subsets: ['canadian-aboriginal'],
    },
    {
      family: 'Historic Borders Scripts',
      ...face('noto-sans-osage', 400),
      subsets: ['osage'],
    },
  ],
  projector: [
    {
      family: 'Atkinson Hyperlegible Next',
      ...face('atkinson-hyperlegible-next', 400),
    },
    {
      family: 'Atkinson Hyperlegible Next',
      ...face('atkinson-hyperlegible-next', 400, 'italic'),
    },
    {
      family: 'Atkinson Hyperlegible Next',
      ...face('atkinson-hyperlegible-next', 500),
    },
    {
      family: 'Atkinson Hyperlegible Next',
      ...face('atkinson-hyperlegible-next', 700),
    },
  ],
  // "Modern textbook" map style: Literata for the year, titles and reading
  // text. Its Atkinson faces come from projector.css, loaded with it.
  textbook: [
    { family: 'Literata', ...face('literata', 400) },
    { family: 'Literata', ...face('literata', 400, 'italic') },
    { family: 'Literata', ...face('literata', 600) },
  ],
};

/** The published CSS files, relative to public/fonts. */
const CSS_FILES = {
  default: 'atlas.css',
  map: 'map-aliases.css',
  projector: 'projector.css',
  textbook: 'textbook.css',
};

/**
 * Property keys whose string values can become map labels. Covers today's
 * published year files (`NAME`, `ABBREVN`, `SUBJECTO`, `PARTOF`, place `name`)
 * and the remaster's slim label files (`n` territory name, `p` place name).
 */
const NAME_KEYS = ['NAME', 'ABBREVN', 'SUBJECTO', 'PARTOF', 'name', 'n', 'p'];
/** Directories, relative to the repository root, scanned for published names. */
const NAME_DIRECTORIES = [
  'public/data/historical',
  'public/data/years',
  'public/basemap/labels',
];

const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');

const fontsourceDir = (pkg) =>
  path.join(ROOT, 'node_modules', '@fontsource', pkg);
const fontsourceVersion = (pkg) =>
  JSON.parse(
    fs.readFileSync(path.join(fontsourceDir(pkg), 'package.json'), 'utf8'),
  ).version;

/** Parses `U+0000-00FF,U+0131` into inclusive [start, end] pairs. */
function parseUnicodeRange(value) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = /^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/i.exec(part);
      if (!match) throw new Error(`Unsupported unicode-range entry: ${part}`);
      const start = parseInt(match[1], 16);
      return [start, match[2] ? parseInt(match[2], 16) : start];
    });
}

/** Removes single codepoints from inclusive ranges. */
function subtractCodePoints(ranges, codePoints) {
  let result = ranges
    .map(([start, end]) => [start, end])
    .sort((a, b) => a[0] - b[0]);
  for (const codePoint of codePoints) {
    result = result.flatMap(([start, end]) => {
      if (codePoint < start || codePoint > end) return [[start, end]];
      return [
        ...(codePoint > start ? [[start, codePoint - 1]] : []),
        ...(codePoint < end ? [[codePoint + 1, end]] : []),
      ];
    });
  }
  return result;
}

/** Inclusive ranges covering exactly the given codepoints. */
function rangesOf(codePoints) {
  const sorted = [...new Set(codePoints)].sort((a, b) => a - b);
  const ranges = [];
  for (const codePoint of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && codePoint === last[1] + 1) last[1] = codePoint;
    else ranges.push([codePoint, codePoint]);
  }
  return ranges;
}

/** Formats inclusive ranges as CSS unicode-range entries. */
function formatUnicodeRange(ranges) {
  const hex = (value) => value.toString(16).toUpperCase().padStart(4, '0');
  return ranges
    .map(([start, end]) =>
      start === end ? `U+${hex(start)}` : `U+${hex(start)}-${hex(end)}`,
    )
    .join(',');
}

const inRanges = (ranges, codePoint) =>
  ranges.some(([start, end]) => codePoint >= start && codePoint <= end);

/** The fontsource subsets (name → unicode-range string) a package declares. */
function fontsourceSubsets(pkg) {
  return JSON.parse(
    fs.readFileSync(path.join(fontsourceDir(pkg), 'unicode.json'), 'utf8'),
  );
}

/** The nearest weight this package ships for a style, preferring the exact one. */
function availableFace(pkg, weight, style) {
  // The pinned Noto Sans is variable in weight and has an italic.
  if (pkg === NOTO_SANS_SOURCE.package) return { pkg, weight, style };
  const files = fs.readdirSync(path.join(fontsourceDir(pkg), 'files'));
  const faces = files
    .map((file) => /-(\d+)-(normal|italic)\.woff2$/.exec(file))
    .filter(Boolean)
    .map((match) => ({ weight: Number(match[1]), style: match[2] }));
  const candidates = faces.filter((f) => f.style === style);
  const pool = candidates.length
    ? candidates
    : faces.filter((f) => f.style === 'normal');
  const best = pool.sort(
    (a, b) =>
      Math.abs(a.weight - weight) - Math.abs(b.weight - weight) ||
      a.weight - b.weight,
  )[0];
  if (!best) throw new Error(`@fontsource/${pkg} has no WOFF2 faces`);
  return { pkg, weight: best.weight, style: best.style };
}

/**
 * One WOFF2 file per subset of a face, in priority order: fontsource lists
 * Latin last so that CSS (which tries the last declared face first) prefers
 * it, so this reverses that order.
 */
function faceFiles({ pkg, weight, style }) {
  const subsets = fontsourceSubsets(pkg);
  return Object.entries(subsets)
    .reverse()
    .map(([subset, unicodeRange]) => ({
      pkg,
      weight,
      style,
      subset,
      unicodeRange,
      file: path.join(
        fontsourceDir(pkg),
        'files',
        `${pkg}-${subset}-${weight}-${style}.woff2`,
      ),
    }))
    .filter((entry) => fs.existsSync(entry.file));
}

/** The primary face followed by the fallbacks, each resolved to a shipped weight. */
function fontstackChain(name) {
  const stack = FONTSTACKS[name];
  if (!stack) throw new Error(`Unknown fontstack ${name}`);
  const { weight, style } = stack.primary;
  return [stack.primary, ...FALLBACKS(weight, style)].map((f) =>
    availableFace(f.pkg, f.weight, f.style),
  );
}

/**
 * The weight and style MapLibre infers from a fontstack name when it draws a
 * glyph locally (grapheme clusters, missing ranges). The alias faces declare
 * exactly these, so the browser never synthesizes bold or italic.
 */
function sniffedFace(name) {
  const style = /italic/i.test(name)
    ? 'italic'
    : /oblique/i.test(name)
      ? 'oblique'
      : 'normal';
  const weights = {
    regular: 400,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  };
  let weight = 400;
  for (const [word, value] of Object.entries(weights)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(name)) weight = value;
  }
  return { weight, style };
}

/** C0 and C1 controls are never drawn, so they are neither required nor emitted. */
const isControl = (codePoint) =>
  codePoint < 0x20 || (codePoint >= 0x7f && codePoint < 0xa0);

const rangeStart = (codePoint) => Math.floor(codePoint / 256) * 256;
const rangeName = (start) => `${start}-${start + 255}`;

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(entryPath) : [entryPath];
  });
}

/** Collects label strings from any GeoJSON-like object graph. */
function collectNamesFromValue(value, names) {
  if (Array.isArray(value)) {
    for (const item of value) collectNamesFromValue(item, names);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (value.properties && typeof value.properties === 'object') {
    for (const key of NAME_KEYS) {
      const name = value.properties[key];
      if (typeof name === 'string' && name) names.add(name);
    }
  }
  for (const [key, child] of Object.entries(value)) {
    if (
      key !== 'geometry' &&
      key !== 'properties' &&
      child &&
      typeof child === 'object'
    ) {
      collectNamesFromValue(child, names);
    }
  }
}

/**
 * Every distinct published label string under the name directories, and the
 * codepoints they use with one example name each.
 */
function collectPublishedNames(root = ROOT, directories = NAME_DIRECTORIES) {
  const names = new Set();
  const files = directories
    .flatMap((directory) => walkFiles(path.join(root, directory)))
    .filter((file) => /\.(geo)?json$/.test(file))
    .sort();
  for (const file of files) {
    collectNamesFromValue(JSON.parse(fs.readFileSync(file, 'utf8')), names);
  }
  const codePoints = new Map();
  const clusters = new Map();
  const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
  for (const name of [...names].sort()) {
    for (const char of name) {
      const codePoint = char.codePointAt(0);
      if (!isControl(codePoint) && !codePoints.has(codePoint))
        codePoints.set(codePoint, name);
    }
    for (const { segment } of segmenter.segment(name)) {
      if ([...segment].length > 1 && !clusters.has(segment))
        clusters.set(segment, name);
    }
  }
  return {
    files: files.map((file) => path.relative(root, file)),
    names,
    codePoints,
    clusters,
  };
}

const SCRIPTS = [
  'Latin',
  'Greek',
  'Cyrillic',
  'Armenian',
  'Hebrew',
  'Arabic',
  'Ethiopic',
  'Cherokee',
  'Canadian_Aboriginal',
  'Osage',
  'Deseret',
  'Devanagari',
  'Thai',
  'Georgian',
  'Han',
  'Hiragana',
  'Katakana',
  'Hangul',
  'Inherited',
  'Common',
];

/** The Unicode script of a codepoint, by its Script property. */
function scriptOf(codePoint) {
  const char = String.fromCodePoint(codePoint);
  for (const script of SCRIPTS) {
    if (new RegExp(`\\p{Script=${script}}`, 'u').test(char)) return script;
  }
  return 'Other';
}

/** Codepoint counts and one example per script, sorted by count. */
function summarizeScripts(codePoints) {
  const scripts = new Map();
  for (const [codePoint, example] of codePoints) {
    const script = scriptOf(codePoint);
    const entry = scripts.get(script) || { script, codePoints: 0, example };
    entry.codePoints += 1;
    scripts.set(script, entry);
  }
  return [...scripts.values()].sort((a, b) => b.codePoints - a.codePoints);
}

// --- Glyph PBF codec -------------------------------------------------------
// The format is MapLibre's glyphs.proto: a `glyphs` message with one
// `fontstack` (1: name, 2: range, 3: repeated glyph); each glyph has
// 1: id, 2: bitmap, 3: width, 4: height, 5: left (sint32), 6: top (sint32),
// 7: advance.

function encodeVarint(value, out) {
  let n = value;
  while (n > 0x7f) {
    out.push((n % 0x80) | 0x80);
    n = Math.floor(n / 0x80);
  }
  out.push(n);
}

const zigzag = (value) => (value >= 0 ? value * 2 : -value * 2 - 1);

function encodeFields(fields) {
  const chunks = [];
  for (const [field, type, value] of fields) {
    const head = [];
    if (type === 'varint' || type === 'svarint') {
      encodeVarint(field * 8, head);
      encodeVarint(type === 'svarint' ? zigzag(value) : value, head);
      chunks.push(Buffer.from(head));
    } else {
      const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
      encodeVarint(field * 8 + 2, head);
      encodeVarint(bytes.length, head);
      chunks.push(Buffer.from(head), bytes);
    }
  }
  return Buffer.concat(chunks);
}

/** Encodes one fontstack range into a glyph PBF. */
function encodeGlyphPbf({ name, range, glyphs }) {
  const glyphMessages = [...glyphs]
    .sort((a, b) => a.id - b.id)
    .map((glyph) =>
      encodeFields([
        [1, 'varint', glyph.id],
        ...(glyph.bitmap && glyph.bitmap.length
          ? [[2, 'bytes', Buffer.from(glyph.bitmap)]]
          : []),
        [3, 'varint', glyph.width],
        [4, 'varint', glyph.height],
        [5, 'svarint', glyph.left],
        [6, 'svarint', glyph.top],
        [7, 'varint', glyph.advance],
      ]),
    );
  const fontstack = encodeFields([
    [1, 'bytes', name],
    [2, 'bytes', range],
    ...glyphMessages.map((message) => [3, 'bytes', message]),
  ]);
  return encodeFields([[1, 'bytes', fontstack]]);
}

function readFields(buffer) {
  const fields = [];
  let offset = 0;
  const readVarint = () => {
    let result = 0;
    let multiplier = 1;
    for (;;) {
      if (offset >= buffer.length) throw new Error('Truncated varint');
      const byte = buffer[offset++];
      result += (byte & 0x7f) * multiplier;
      if (byte < 0x80) return result;
      multiplier *= 0x80;
      if (multiplier > 2 ** 56) throw new Error('Varint too long');
    }
  };
  while (offset < buffer.length) {
    const key = readVarint();
    const field = Math.floor(key / 8);
    const wire = key % 8;
    if (wire === 0) fields.push({ field, value: readVarint() });
    else if (wire === 2) {
      const length = readVarint();
      if (offset + length > buffer.length) throw new Error('Truncated field');
      fields.push({ field, bytes: buffer.subarray(offset, offset + length) });
      offset += length;
    } else throw new Error(`Unsupported wire type ${wire}`);
  }
  return fields;
}

const unzigzag = (value) => (value % 2 ? -(value + 1) / 2 : value / 2);

/** Decodes a glyph PBF into its fontstacks and glyph metrics. */
function decodeGlyphPbf(buffer) {
  return readFields(buffer)
    .filter(({ field, bytes }) => field === 1 && bytes)
    .map(({ bytes }) => {
      const stack = { name: '', range: '', glyphs: [] };
      for (const entry of readFields(bytes)) {
        if (entry.field === 1) stack.name = entry.bytes.toString('utf8');
        else if (entry.field === 2) stack.range = entry.bytes.toString('utf8');
        else if (entry.field === 3) {
          const glyph = {
            id: 0,
            bitmap: null,
            width: 0,
            height: 0,
            left: 0,
            top: 0,
            advance: 0,
          };
          for (const g of readFields(entry.bytes)) {
            if (g.field === 1) glyph.id = g.value;
            else if (g.field === 2) glyph.bitmap = g.bytes;
            else if (g.field === 3) glyph.width = g.value;
            else if (g.field === 4) glyph.height = g.value;
            else if (g.field === 5) glyph.left = unzigzag(g.value);
            else if (g.field === 6) glyph.top = unzigzag(g.value);
            else if (g.field === 7) glyph.advance = g.value;
          }
          stack.glyphs.push(glyph);
        }
      }
      return stack;
    });
}

// --- Style checks ------------------------------------------------------------

const isStringArray = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((item) => typeof item === 'string');
/** Operators a `text-font` expression can use to choose between font literals. */
const CHOOSERS = new Set(['case', 'match', 'step', 'coalesce', 'let']);
/** Expression operators that read a value at runtime; a font from them cannot be checked. */
const RUNTIME_OPERATORS = new Set([
  'get',
  'var',
  'at',
  'feature-state',
  'global-state',
  'properties',
  'to-string',
  'concat',
  'array',
  'string',
  'slice',
  'downcase',
  'upcase',
  'config',
  'id',
  'geometry-type',
  'zoom',
]);

/**
 * Every fontstack a MapLibre style references through `text-font`: plain
 * string arrays and the `['literal', [...]]` outputs of `case`, `match`,
 * `step`, `coalesce` and `let`. Stacks are joined with commas, as MapLibre
 * requests them. Layers whose font is read from data (`get`, `var`, …) cannot
 * be checked statically and are listed in `dataDriven`.
 */
function collectStyleFontstacks(style) {
  const stacks = new Set();
  const dataDriven = new Set();
  const visit = (value, layerId) => {
    if (!Array.isArray(value)) return;
    if (value[0] === 'literal') {
      if (isStringArray(value[1])) stacks.add(value[1].join(','));
      else dataDriven.add(layerId);
      return;
    }
    if (!CHOOSERS.has(value[0])) {
      if (isStringArray(value) && !RUNTIME_OPERATORS.has(value[0]))
        stacks.add(value.join(','));
      else dataDriven.add(layerId);
      return;
    }
    const last = value.length - 1;
    const outputs = {
      case: () => [
        ...value.slice(2, last).filter((_, i) => i % 2 === 0),
        value[last],
      ],
      match: () => [
        ...value.slice(3, last).filter((_, i) => i % 2 === 0),
        value[last],
      ],
      step: () => value.slice(2).filter((_, i) => i % 2 === 0),
      coalesce: () => value.slice(1),
      let: () => [value[last]],
    }[value[0]]();
    for (const output of outputs) visit(output, layerId);
  };
  for (const layer of style.layers || []) {
    const textFont = layer.layout && layer.layout['text-font'];
    if (textFont !== undefined) visit(textFont, layer.id);
  }
  return { stacks: [...stacks].sort(), dataDriven: [...dataDriven].sort() };
}

/** Errors for style fontstacks that the glyph manifest does not publish. */
function checkStyleFontstacks(style, manifest) {
  const published = new Set(Object.keys(manifest.glyphs.fontstacks));
  const errors = [];
  const { stacks, dataDriven } = collectStyleFontstacks(style);
  for (const layerId of dataDriven) {
    errors.push(
      `layer ${layerId} reads text-font from data, which cannot be validated`,
    );
  }
  for (const stack of stacks) {
    if (!published.has(stack)) {
      errors.push(
        stack.includes(',')
          ? `text-font ${JSON.stringify(stack.split(','))} combines fontstacks; use one published name per array`
          : `text-font "${stack}" has no published glyphs`,
      );
    }
  }
  if (style.glyphs && style.glyphs !== manifest.glyphs.url) {
    errors.push(
      `style glyphs URL ${style.glyphs} is not ${manifest.glyphs.url}`,
    );
  }
  return errors;
}

module.exports = {
  CSS_FILES,
  FONTSTACKS,
  MANIFEST_PATH,
  NAME_DIRECTORIES,
  NAME_KEYS,
  NOTO_SANS_SOURCE,
  PUBLIC_FONTS,
  PUBLIC_GLYPHS,
  ROOT,
  SDF,
  TOP_ADJUSTMENT,
  UI_FACES,
  availableFace,
  checkStyleFontstacks,
  collectNamesFromValue,
  collectPublishedNames,
  collectStyleFontstacks,
  decodeGlyphPbf,
  encodeGlyphPbf,
  faceFiles,
  fontsourceDir,
  fontsourceSubsets,
  fontsourceVersion,
  fontstackChain,
  formatUnicodeRange,
  inRanges,
  isControl,
  parseUnicodeRange,
  rangeName,
  rangeStart,
  rangesOf,
  scriptOf,
  sha256,
  sniffedFace,
  subtractCodePoints,
  summarizeScripts,
  walkFiles,
};

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

const {
  FONTSTACKS,
  checkStyleFontstacks,
  collectPublishedNames,
  collectStyleFontstacks,
  decodeGlyphPbf,
  encodeGlyphPbf,
  formatUnicodeRange,
  parseUnicodeRange,
  rangesOf,
  scriptOf,
  sha256,
  sniffedFace,
  subtractCodePoints,
  summarizeScripts,
} = require('../scripts/lib/map-fonts');
const {
  parseHeaders,
  validateMapFonts,
} = require('../scripts/lib/map-fonts-validation');

const temporaryRoots: string[] = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

const write = (root: string, file: string, content: string | Buffer) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content);
};

const point = (properties: Record<string, unknown>) => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Point', coordinates: [0, 0] },
});

describe('glyph PBF codec', () => {
  it('round-trips metrics, negative bearings, astral codepoints and empty glyphs', () => {
    const glyphs = [
      {
        id: 0x41,
        bitmap: Buffer.alloc(9 * 10, 7),
        width: 3,
        height: 4,
        left: -1,
        top: -20,
        advance: 9,
      },
      {
        id: 0x20,
        bitmap: null,
        width: 0,
        height: 0,
        left: 0,
        top: -27,
        advance: 6,
      },
      {
        id: 0x104b0,
        bitmap: Buffer.alloc(7 * 8, 200),
        width: 1,
        height: 2,
        left: 2,
        top: 3,
        advance: 300,
      },
    ];
    const buffer = encodeGlyphPbf({
      name: 'Alegreya SC Medium',
      range: '0-255',
      glyphs,
    });
    const [stack] = decodeGlyphPbf(buffer);
    expect(stack.name).toBe('Alegreya SC Medium');
    expect(stack.range).toBe('0-255');
    expect(stack.glyphs.map((g: { id: number }) => g.id)).toEqual([
      0x20, 0x41, 0x104b0,
    ]);
    const a = stack.glyphs.find((g: { id: number }) => g.id === 0x41);
    expect({ ...a, bitmap: [...a.bitmap] }).toEqual({
      ...glyphs[0],
      bitmap: [...glyphs[0].bitmap!],
    });
    expect(stack.glyphs[0].bitmap).toBeNull();
    expect(stack.glyphs[2].advance).toBe(300);
  });

  it('rejects truncated input', () => {
    const buffer = encodeGlyphPbf({ name: 'X', range: '0-255', glyphs: [] });
    expect(() => decodeGlyphPbf(buffer.subarray(0, buffer.length - 2))).toThrow(
      /Truncated/,
    );
  });
});

describe('unicode ranges', () => {
  it('parses, subtracts and formats CSS unicode-range values', () => {
    expect(parseUnicodeRange('U+0000-00FF, U+0131')).toEqual([
      [0, 255],
      [0x131, 0x131],
    ]);
    expect(
      formatUnicodeRange(
        subtractCodePoints([[0x100, 0x110]], [0x100, 0x105, 0x110]),
      ),
    ).toBe('U+0101-0104,U+0106-010F');
    expect(formatUnicodeRange(rangesOf([0x41, 0x43, 0x42, 0x104b0]))).toBe(
      'U+0041-0043,U+104B0',
    );
    expect(() => parseUnicodeRange('U+4??')).toThrow(/Unsupported/);
  });
});

describe('published names', () => {
  it('collects label strings from legacy and slim year files, with codepoints and clusters', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-names-'));
    temporaryRoots.push(root);
    write(
      root,
      'public/data/historical/1492.abc.json',
      JSON.stringify({
        data: {
          labels: {
            type: 'FeatureCollection',
            features: [point({ NAME: 'Đại Việt', AREA: 1 })],
          },
          borders: {
            type: 'FeatureCollection',
            features: [point({ NAME: 'Kanienʼkehá꞉ka', COLOR: '#fff' })],
          },
        },
        places: {
          type: 'FeatureCollection',
          features: [point({ name: 'x̣àʼisla' })],
        },
      }),
    );
    write(
      root,
      'public/data/years/1914.labels.geojson',
      JSON.stringify({
        type: 'FeatureCollection',
        features: [point({ n: 'ᓀᐦᐃᔭᐤ', p: 'Tab\tName' })],
      }),
    );
    const { names, codePoints, clusters, files } = collectPublishedNames(root);
    expect(files).toHaveLength(2);
    expect([...names].sort()).toEqual(
      ['Kanienʼkehá꞉ka', 'Tab\tName', 'x̣àʼisla', 'ᓀᐦᐃᔭᐤ', 'Đại Việt'].sort(),
    );
    expect(codePoints.has(0xa789)).toBe(true);
    expect(codePoints.has(0x1403)).toBe(true);
    expect(codePoints.has(0x09)).toBe(false); // controls are never drawn
    expect(codePoints.has('#'.codePointAt(0))).toBe(false); // COLOR is not a name
    expect([...clusters.keys()]).toContain('x̣');
  });

  it('names the Unicode scripts it finds', () => {
    expect(scriptOf(0x1403)).toBe('Canadian_Aboriginal');
    expect(scriptOf(0x13a3)).toBe('Cherokee');
    expect(scriptOf(0x104b0)).toBe('Osage');
    expect(scriptOf(0x0313)).toBe('Inherited');
    expect(scriptOf(0x2027)).toBe('Common');
    const summary = summarizeScripts(
      new Map([
        [0x41, 'A'],
        [0x42, 'B'],
        [0x3b2, 'β'],
      ]),
    );
    expect(summary).toEqual([
      { script: 'Latin', codePoints: 2, example: 'A' },
      { script: 'Greek', codePoints: 1, example: 'β' },
    ]);
  });
});

describe('fontstack configuration', () => {
  it('uses names MapLibre can request and sniff a weight and style from', () => {
    for (const [name, stack] of Object.entries(FONTSTACKS) as [
      string,
      { primary: { weight: number; style: string } },
    ][]) {
      expect(name).not.toMatch(/,/);
      expect(sniffedFace(name)).toEqual({
        weight: stack.primary.weight,
        style: stack.primary.style,
      });
    }
  });

  it('matches the committed manifest', () => {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '..', 'data', 'map-fonts.json'),
        'utf8',
      ),
    );
    expect(Object.keys(manifest.glyphs.fontstacks).sort()).toEqual(
      Object.keys(FONTSTACKS).sort(),
    );
    expect(manifest.glyphs.url).toBe(
      `/glyphs/${manifest.glyphs.buildId}/{fontstack}/{range}.pbf`,
    );
  });
});

describe('style fontstack checks', () => {
  const manifest = {
    glyphs: {
      url: '/glyphs/abc/{fontstack}/{range}.pbf',
      fontstacks: { 'Alegreya SC Medium': {}, 'Alegreya SC Bold': {} },
    },
  };

  it('finds stacks in plain arrays and inside expressions', () => {
    const style = {
      layers: [
        { id: 'a', layout: { 'text-font': ['Alegreya Regular'] } },
        {
          id: 'b',
          layout: {
            'text-font': [
              'case',
              ['>', ['get', 'a'], 250000],
              ['literal', ['Alegreya SC Bold']],
              ['literal', ['Alegreya SC Medium']],
            ],
          },
        },
        {
          id: 'c',
          layout: {
            'text-font': [
              'step',
              ['zoom'],
              ['literal', ['Alegreya Italic']],
              5,
              ['literal', ['Alegreya Medium Italic']],
            ],
          },
        },
        { id: 'd', layout: { 'text-font': ['get', 'font'] } },
        { id: 'e', type: 'fill' },
      ],
    };
    expect(collectStyleFontstacks(style)).toEqual({
      stacks: [
        'Alegreya Italic',
        'Alegreya Medium Italic',
        'Alegreya Regular',
        'Alegreya SC Bold',
        'Alegreya SC Medium',
      ],
      dataDriven: ['d'],
    });
  });

  it('reports unpublished, combined and data-driven stacks and a wrong glyphs URL', () => {
    const style = {
      glyphs: '/glyphs/{fontstack}/{range}.pbf',
      layers: [
        { id: 'ok', layout: { 'text-font': ['Alegreya SC Medium'] } },
        {
          id: 'combined',
          layout: { 'text-font': ['Alegreya SC Bold', 'Noto Sans Regular'] },
        },
        { id: 'missing', layout: { 'text-font': ['Open Sans Regular'] } },
        {
          id: 'data',
          layout: {
            'text-font': [
              'coalesce',
              ['get', 'font'],
              ['literal', ['Alegreya SC Bold']],
            ],
          },
        },
      ],
    };
    const errors = checkStyleFontstacks(style, manifest);
    expect(errors).toHaveLength(4);
    expect(errors.join('\n')).toMatch(/layer data reads text-font from data/);
    expect(errors.join('\n')).toMatch(/combines fontstacks/);
    expect(errors.join('\n')).toMatch(
      /"Open Sans Regular" has no published glyphs/,
    );
    expect(errors.join('\n')).toMatch(/glyphs URL/);
    expect(
      checkStyleFontstacks(
        { glyphs: manifest.glyphs.url, layers: style.layers.slice(0, 1) },
        manifest,
      ),
    ).toEqual([]);
  });
});

describe('_headers parsing', () => {
  it('reads path blocks and their headers', () => {
    expect(
      parseHeaders(
        '# note\n/glyphs/*\n  Content-Type: application/x-protobuf\n  Cache-Control: a, b\n\n/x\n  X-Y: z\n',
      ),
    ).toEqual({
      '/glyphs/*': {
        'content-type': 'application/x-protobuf',
        'cache-control': 'a, b',
      },
      '/x': { 'x-y': 'z' },
    });
  });
});

describe('map font validation', () => {
  const STACK = 'Alegreya SC Medium';
  const IMMUTABLE = 'public, max-age=31536000, immutable';
  const OFL =
    'Copyright 2011 The Alegreya Project Authors (https://example.org)\nSIL OPEN FONT LICENSE Version 1.1\n';

  /** A minimal published tree for one fontstack and the names "Aé" and "ᐊ". */
  function fixture({ glyphIds = [0x41, 0xe9, 0x140a], headers = true } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-fonts-'));
    temporaryRoots.push(root);
    write(
      root,
      'public/data/historical/1.a.json',
      JSON.stringify({
        type: 'FeatureCollection',
        features: [point({ NAME: 'Aé' }), point({ name: 'ᐊ' })],
      }),
    );
    const buildId = '0123456789ab';
    const ranges: Record<
      string,
      { bytes: number; glyphs: number; sha256: string }
    > = {};
    for (const [start, range] of [
      [0, '0-255'],
      [5120, '5120-5375'],
    ] as const) {
      const glyphs = glyphIds
        .filter((id) => id >= start && id < start + 256)
        .map((id) => ({
          id,
          bitmap: Buffer.alloc(49),
          width: 1,
          height: 1,
          left: 0,
          top: -10,
          advance: 8,
        }));
      const buffer = encodeGlyphPbf({ name: STACK, range, glyphs });
      write(root, `public/glyphs/${buildId}/${STACK}/${range}.pbf`, buffer);
      ranges[range] = {
        bytes: buffer.length,
        glyphs: glyphs.length,
        sha256: sha256(buffer),
      };
    }
    const font = Buffer.from('woff2');
    const fontPath =
      '/fonts/files/alegreya-sc-latin-500-normal.0123456789.woff2';
    write(root, `public${fontPath}`, font);
    const css =
      "@font-face { src: url('files/alegreya-sc-latin-500-normal.0123456789.woff2') format('woff2'); }\n";
    write(root, 'public/fonts/atlas.css', css);
    write(root, 'public/fonts/licenses/LICENSE-alegreya-sc.txt', OFL);
    if (headers) {
      write(
        root,
        'public/_headers',
        `/glyphs/*\n  Content-Type: application/x-protobuf\n  Cache-Control: ${IMMUTABLE}\n\n/fonts/files/*\n  Cache-Control: ${IMMUTABLE}\n`,
      );
    }
    const manifest = {
      schemaVersion: 1,
      glyphs: {
        buildId,
        url: `/glyphs/${buildId}/{fontstack}/{range}.pbf`,
        fontstacks: { [STACK]: { ranges } },
      },
      fonts: {
        css: {
          default: {
            path: '/fonts/atlas.css',
            bytes: css.length,
            sha256: sha256(css),
          },
        },
        files: [
          {
            path: fontPath,
            sha256: sha256(font),
            bytes: font.length,
            license: '/fonts/licenses/LICENSE-alegreya-sc.txt',
          },
        ],
      },
      licenses: [
        {
          path: '/fonts/licenses/LICENSE-alegreya-sc.txt',
          license: 'OFL-1.1',
          sha256: sha256(OFL),
          copyright: [
            'Copyright 2011 The Alegreya Project Authors (https://example.org)',
          ],
        },
      ],
    };
    return { root, manifest, buildId };
  }
  const validate = (root: string, manifest: object) =>
    validateMapFonts({ root, manifest, expectedFontstacks: [STACK] }).errors;

  it('accepts a complete tree', () => {
    const { root, manifest } = fixture();
    const result = validateMapFonts({
      root,
      manifest,
      expectedFontstacks: [STACK],
    });
    expect(result.errors).toEqual([]);
    expect(result.summary).toMatchObject({
      codePoints: 3,
      ranges: ['0-255', '5120-5375'],
      glyphFiles: 2,
      licenses: 1,
    });
  });

  it('reports a codepoint a fontstack cannot draw', () => {
    const { root, manifest } = fixture({ glyphIds: [0x41, 0x140a] });
    expect(validate(root, manifest)).toEqual([
      `${STACK} has no glyph for U+00E9 used in "Aé"`,
    ]);
  });

  it('reports a missing range, a stale file and a changed file', () => {
    const { root, manifest, buildId } = fixture();
    fs.rmSync(
      path.join(root, `public/glyphs/${buildId}/${STACK}/5120-5375.pbf`),
    );
    write(root, 'public/glyphs/old/Alegreya SC Medium/0-255.pbf', 'x');
    fs.appendFileSync(
      path.join(root, 'public/fonts/atlas.css'),
      '/* edited */',
    );
    const errors = validate(root, manifest).join('\n');
    expect(errors).toMatch(
      /missing glyph range 5120-5375 \(needed for U\+140A in "ᐊ"\)/,
    );
    expect(errors).toMatch(
      /public\/glyphs\/old\/Alegreya SC Medium\/0-255.pbf is not in the glyph manifest/,
    );
    expect(errors).toMatch(/atlas.css does not match the manifest hash/);
  });

  it('requires OFL license copies and delivery headers', () => {
    const { root, manifest } = fixture({ headers: false });
    fs.writeFileSync(
      path.join(root, 'public/fonts/licenses/LICENSE-alegreya-sc.txt'),
      'All rights reserved',
    );
    const errors = validate(root, manifest).join('\n');
    expect(errors).toMatch(/LICENSE-alegreya-sc.txt does not match/);
    expect(errors).toMatch(/is not OFL 1.1/);
    expect(errors).toMatch(/Content-Type: application\/x-protobuf/);
    expect(errors).toMatch(/\/fonts\/files\/\* as immutable/);
  });

  it('reports configured fontstacks that were not built', () => {
    const { root, manifest } = fixture();
    const errors = validateMapFonts({
      root,
      manifest,
      expectedFontstacks: [STACK, 'Alegreya Regular'],
    }).errors;
    expect(errors).toEqual([
      'fontstack "Alegreya Regular" is configured but not built',
    ]);
  });
});

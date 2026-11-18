/**
 * Renders MapLibre glyph PBFs (SDF, 24 px, 3 px buffer) from the self-hosted
 * OFL fonts in ../fonts, using Chromium's text rasterizer and @mapbox/tiny-sdf
 * (the same SDF code MapLibre uses for locally drawn glyphs).
 *
 *   node tools/make-glyphs.cjs
 *
 * Production would use the same approach (or maplibre/font-maker) at build
 * time and serve /glyphs/{fontstack}/{range}.pbf as immutable static files.
 */
const fs = require('fs');
const path = require('path');
const ROOT_NM = process.env.ROOT_NODE_MODULES || '/Volumes/External SSD/Developer/Projects/borders/node_modules';
const { chromium } = require(path.join(ROOT_NM, 'playwright'));
const Pbf = require(path.join(ROOT_NM, 'pbf'));

const here = path.resolve(__dirname, '..');
const STACKS = {
  a: {
    'Alegreya SC Medium': ['alegreya-sc', 500, 'normal'],
    'Alegreya SC Bold': ['alegreya-sc', 700, 'normal'],
    'Alegreya Italic': ['alegreya', 400, 'italic'],
    'Alegreya Medium Italic': ['alegreya', 500, 'italic'],
    'Alegreya Regular': ['alegreya', 400, 'normal'],
  },
  b: {
    'Atkinson Next Bold': ['atkinson-hyperlegible-next', 700, 'normal'],
    'Atkinson Next ExtraBold': ['atkinson-hyperlegible-next', 800, 'normal'],
    'Atkinson Next Medium': ['atkinson-hyperlegible-next', 500, 'normal'],
    'Literata Italic': ['literata', 400, 'italic'],
    'Literata Medium Italic': ['literata', 500, 'italic'],
  },
  c: {
    'Spectral SC Medium': ['spectral-sc', 500, 'normal'],
    'Spectral SC SemiBold': ['spectral-sc', 600, 'normal'],
    'Spectral Italic': ['spectral', 400, 'italic'],
    'Spectral Medium Italic': ['spectral', 500, 'italic'],
    'Libre Franklin Medium': ['libre-franklin', 500, 'normal'],
  },
};
// Latin, Latin Extended-A/B and punctuation cover every label in view.
const RANGES = [0, 256, 8192];
const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

const tinySdf = fs
  .readFileSync(path.join(ROOT_NM, '@mapbox/tiny-sdf/index.js'), 'utf8')
  .replace('export default class TinySDF', 'window.TinySDF = class TinySDF');

const writeGlyph = (g, pbf) => {
  pbf.writeVarintField(1, g.id);
  if (g.bitmap) pbf.writeBytesField(2, Buffer.from(g.bitmap, 'base64'));
  pbf.writeVarintField(3, g.width);
  pbf.writeVarintField(4, g.height);
  pbf.writeSVarintField(5, g.left);
  pbf.writeSVarintField(6, g.top);
  pbf.writeVarintField(7, g.advance);
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [dir, stacks] of Object.entries(STACKS)) {
    const faces = Object.entries(stacks)
      .flatMap(([name, [file, weight, style]]) =>
        [['latin', LATIN], ['latin-ext', LATIN_EXT]].map(([sub, range]) => {
          const url = 'data:font/woff2;base64,' + fs.readFileSync(path.join(here, 'fonts', `${file}-${sub}-${weight}-${style}.woff2`)).toString('base64');
          return `@font-face{font-family:"${name}";src:url(${url}) format("woff2");unicode-range:${range};}`;
        }),
      )
      .join('\n');
    await page.setContent(`<style>${faces}</style><script>${tinySdf}</script>`);
    const bundle = {};
    for (const name of Object.keys(stacks)) {
      for (const start of RANGES) {
        const glyphs = await page.evaluate(
          async ({ name, start }) => {
            const chars = [];
            for (let id = start; id < start + 256; id++) chars.push(id);
            await document.fonts.load(`24px "${name}"`, chars.map((c) => String.fromCharCode(c)).join(''));
            const sdf = new window.TinySDF({ fontSize: 24, buffer: 3, radius: 8, cutoff: 0.25, fontFamily: `"${name}"` });
            const b64 = (arr) => { let s = ''; for (const v of arr) s += String.fromCharCode(v); return btoa(s); };
            return chars
              .filter((id) => !(id < 32 || (id >= 127 && id < 160)))
              .map((id) => {
                const g = sdf.draw(String.fromCharCode(id));
                return { id, bitmap: g.glyphWidth && g.glyphHeight ? b64(g.data) : null, width: g.glyphWidth, height: g.glyphHeight, left: 0, top: g.glyphTop - 27, advance: Math.round(g.glyphAdvance) };
              });
          },
          { name, start },
        );
        const pbf = new Pbf();
        const range = `${start}-${start + 255}`;
        pbf.writeMessage(1, (_, p) => {
          p.writeStringField(1, name);
          p.writeStringField(2, range);
          glyphs.forEach((g) => p.writeMessage(3, writeGlyph, g));
        });
        bundle[`${name}/${range}`] = Buffer.from(pbf.finish()).toString('base64');
      }
    }
    const file = path.join(here, 'data', `glyphs-${dir}.js`);
    fs.writeFileSync(file, `window.HB_GLYPHS=${JSON.stringify(bundle)};\n`);
    console.log(file, (fs.statSync(file).size / 1024).toFixed(0) + ' kB');
  }
  await browser.close();
})();

// Subsets and instances a TrueType font with HarfBuzz (harfbuzzjs, MIT) and
// compresses the result to WOFF2 (wawoff2, MIT). Used by the font build to
// cut the pinned full Noto Sans down to the few codepoints that published
// names need and no other shipped font covers.
const fs = require('fs');
const wawoff2 = require('wawoff2');

const HB_MEMORY_MODE_WRITABLE = 2;
const HB_SUBSET_SETS_LAYOUT_FEATURE_TAG = 6;

const tag = (value) =>
  value.split('').reduce((a, ch) => a * 256 + ch.charCodeAt(0), 0);

let harfbuzz;
async function loadHarfbuzz() {
  if (!harfbuzz) {
    const wasm = fs.readFileSync(
      require.resolve('harfbuzzjs/dist/harfbuzz-subset.wasm'),
    );
    const { instance } = await WebAssembly.instantiate(wasm);
    instance.exports._initialize();
    harfbuzz = instance.exports;
  }
  return harfbuzz;
}

/**
 * @param {Buffer} ttf - a TrueType font (static or variable)
 * @param {number[]} codePoints - codepoints to keep; glyphs they need through
 *   layout features (marks, ligatures) are kept as well
 * @param {Record<string, number>} axes - variation axes to pin, e.g. { wght: 500, wdth: 100 }
 * @returns {Promise<Buffer>} the subset as WOFF2
 */
async function subsetToWoff2(ttf, codePoints, axes = {}) {
  const hb = await loadHarfbuzz();
  const heap = () => new Uint8Array(hb.memory.buffer);
  const input = hb.hb_subset_input_create_or_fail();
  if (!input) throw new Error('hb_subset_input_create_or_fail failed');
  const fontBuffer = hb.malloc(ttf.byteLength);
  heap().set(ttf, fontBuffer);
  const blob = hb.hb_blob_create(
    fontBuffer,
    ttf.byteLength,
    HB_MEMORY_MODE_WRITABLE,
    0,
    0,
  );
  const face = hb.hb_face_create(blob, 0);
  hb.hb_blob_destroy(blob);
  let subset = 0;
  try {
    // Keep every layout feature (mark positioning in particular).
    const features = hb.hb_subset_input_set(
      input,
      HB_SUBSET_SETS_LAYOUT_FEATURE_TAG,
    );
    hb.hb_set_clear(features);
    hb.hb_set_invert(features);
    const unicodes = hb.hb_subset_input_unicode_set(input);
    for (const codePoint of codePoints) hb.hb_set_add(unicodes, codePoint);
    for (const [axis, value] of Object.entries(axes)) {
      if (
        !hb.hb_subset_input_pin_axis_location(input, face, tag(axis), value)
      ) {
        throw new Error(`Could not pin axis ${axis} to ${value}`);
      }
    }
    subset = hb.hb_subset_or_fail(face, input);
    if (!subset) throw new Error('hb_subset_or_fail failed');
    const result = hb.hb_face_reference_blob(subset);
    const offset = hb.hb_blob_get_data(result, 0);
    const length = hb.hb_blob_get_length(result);
    const truetype = Buffer.from(heap().subarray(offset, offset + length));
    hb.hb_blob_destroy(result);
    if (!length) throw new Error('HarfBuzz produced an empty subset');
    return Buffer.from(await wawoff2.compress(truetype));
  } finally {
    if (subset) hb.hb_face_destroy(subset);
    hb.hb_subset_input_destroy(input);
    hb.hb_face_destroy(face);
    hb.free(fontBuffer);
  }
}

module.exports = { subsetToWoff2 };

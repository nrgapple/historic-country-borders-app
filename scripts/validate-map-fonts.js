#!/usr/bin/env node
// Part of `yarn data:validate`. Checks that every configured map fontstack has
// glyphs for every codepoint in the published names, that fonts, CSS and OFL
// license copies match data/map-fonts.json, and that _headers serves glyphs
// with a Content-Type. Pass `--style <style.json>` to also check that every
// `text-font` in a MapLibre style is a published fontstack.
const fs = require('fs');
const path = require('path');
const { MANIFEST_PATH, ROOT } = require('./lib/map-fonts');
const { validateMapFonts } = require('./lib/map-fonts-validation');

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(
      'data/map-fonts.json is missing; run yarn data:refresh:fonts',
    );
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const styleIndex = process.argv.indexOf('--style');
  const style =
    styleIndex > 0
      ? JSON.parse(
          fs.readFileSync(path.resolve(process.argv[styleIndex + 1]), 'utf8'),
        )
      : undefined;
  const { errors, summary } = validateMapFonts({ root: ROOT, manifest, style });
  if (errors.length) {
    console.error(
      `Map font validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`,
    );
    console.error('Run yarn data:refresh:fonts after changing names or fonts.');
    process.exitCode = 1;
    return;
  }
  console.log(
    `Validated ${summary.fontstacks} fontstacks × ${summary.ranges.length} ranges ` +
      `(${summary.glyphFiles} glyph PBFs, ${summary.glyphBytes} bytes) covering ` +
      `${summary.codePoints} codepoints in ${summary.names} names; ` +
      `${summary.fontFiles} WOFF2 files (${summary.fontBytes} bytes), ${summary.licenses} OFL licenses.`,
  );
}

main();

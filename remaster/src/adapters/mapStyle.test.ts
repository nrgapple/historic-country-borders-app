import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '@repo/data/map-fonts.json';
import { DEFAULT_SETTINGS } from '../atlas/settings';
import { createStyle, LAYER, SOURCE } from './mapStyle';
import { BASEMAP_LAYER } from './basemap';

// T3's own style check (docs/FONTS.md): every text-font must be one
// published fontstack, and the glyphs URL must be the manifest's.
const require = createRequire(import.meta.url);
const { checkStyleFontstacks } = require(path.resolve('../scripts/lib/map-fonts.js')) as {
  checkStyleFontstacks: (style: unknown, manifest: unknown) => string[];
};

const styleFor = (projectorText: boolean) =>
  createStyle({ origin: '', settings: { ...DEFAULT_SETTINGS, projectorText } });

const fontsOf = (style: ReturnType<typeof styleFor>) =>
  JSON.stringify(style.layers.map((l) => ('layout' in l ? l.layout?.['text-font'] : null)));

describe('Classic-atlas style adapter', () => {
  it('uses only fontstacks T3 publishes, one per array, and its glyph URL', () => {
    expect(checkStyleFontstacks(styleFor(false), manifest)).toEqual([]);
    expect(checkStyleFontstacks(styleFor(true), manifest)).toEqual([]);
  });

  it('requests Atkinson glyphs only with Projector text on', () => {
    expect(fontsOf(styleFor(false))).not.toContain('Atkinson');
    expect(fontsOf(styleFor(true))).toContain('Atkinson Hyperlegible Next Bold');
    expect(fontsOf(styleFor(true))).not.toContain('Alegreya');
  });

  it('paints the ocean mask over the territory fills (plan §2.1)', () => {
    const ids = styleFor(false).layers.map((l) => l.id);
    expect(ids.indexOf(LAYER.ocean)).toBeGreaterThan(ids.indexOf(LAYER.territoryFill));
    expect(ids.indexOf(LAYER.ocean)).toBeGreaterThan(ids.indexOf(LAYER.selectedLine));
    // Symbol priority: other cities, then the selected capital, then state names on top.
    expect(ids.slice(-3)).toEqual([LAYER.places, LAYER.selectedCapital, LAYER.stateLabels]);
  });

  it('reads T2 source-layers and applies the toned-down waterline rule', () => {
    const style = styleFor(false);
    const waterlines = style.layers.filter((l) => l.id.startsWith('waterline-'));
    expect(waterlines.map((l) => l.maxzoom)).toEqual([5, 5, 3.5, 3.5]);
    for (const l of waterlines) expect(JSON.stringify(l)).toContain('landmass_km2');
    const sea = style.layers.find((l) => l.id === LAYER.seaLabels)!;
    expect((sea as { 'source-layer'?: string })['source-layer']).toBe(BASEMAP_LAYER.marine);
    expect(Object.keys(style.sources)).toEqual(
      expect.arrayContaining([SOURCE.basemap, SOURCE.borders, SOURCE.labels, SOURCE.capitals]),
    );
  });
});

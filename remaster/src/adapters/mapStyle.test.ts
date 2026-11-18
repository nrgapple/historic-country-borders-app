import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '@repo/data/map-fonts.json';
import { DEFAULT_SETTINGS } from '../atlas/settings';
import {
  createStyle,
  LAYER,
  resolveLowPower,
  SOURCE,
  styleOptions,
} from './mapStyle';

// T6's own suite (remaster-spike/src/atlas/classic/style.test.ts) covers the
// cartography; these check how the app drives it.
const require = createRequire(import.meta.url);
const { checkStyleFontstacks } = require(
  path.resolve('../scripts/lib/map-fonts.js'),
) as {
  checkStyleFontstacks: (style: unknown, manifest: unknown) => string[];
};

const styleFor = (projectorText: boolean, lowPower = false) =>
  createStyle({
    origin: '',
    settings: { ...DEFAULT_SETTINGS, projectorText },
    lowPower,
  });
const fontsOf = (style: ReturnType<typeof styleFor>) =>
  JSON.stringify(
    style.layers.map((l) =>
      l.type === 'symbol' ? l.layout?.['text-font'] : null,
    ),
  );

describe('Classic-atlas style adapter (T6)', () => {
  it('passes T3’s fontstack check with and without Projector text', () => {
    expect(checkStyleFontstacks(styleFor(false), manifest)).toEqual([]);
    expect(checkStyleFontstacks(styleFor(true), manifest)).toEqual([]);
  });

  it('requests Atkinson glyphs only with Projector text on', () => {
    expect(fontsOf(styleFor(false))).not.toContain('Atkinson');
    expect(fontsOf(styleFor(true))).toContain(
      'Atkinson Hyperlegible Next Bold',
    );
  });

  it('maps every app setting onto T6’s options', () => {
    const o = styleOptions(
      {
        ...DEFAULT_SETTINGS,
        textSize: 'large',
        textCase: 'upper',
        countryOpacity: 0.4,
        borderThickness: 0,
        showLabels: false,
        projectorText: true,
      },
      true,
      { id: 3, name: 'Castile', dependencyIds: [] },
    );
    expect(o).toMatchObject({
      settings: {
        textSize: 'large',
        textCase: 'upper',
        countryOpacity: 0.4,
        borderThickness: 0,
        showLabels: false,
      },
      projectorText: true,
      lowPower: true,
      selected: { id: 3, name: 'Castile' },
    });
    expect(
      styleOptions(DEFAULT_SETTINGS, false, {
        id: null,
        name: null,
        dependencyIds: [],
      }).selected,
    ).toBeNull();
  });

  it('paints the ocean mask over the territory fills (plan §2.1)', () => {
    const ids = styleFor(false).layers.map((l) => l.id);
    expect(ids.indexOf(LAYER.ocean)).toBeGreaterThan(
      ids.indexOf(LAYER.selectedLine),
    );
  });

  it('lets the URL force low power on or off', () => {
    expect(resolveLowPower('?lowPower=1')).toBe(true);
    expect(resolveLowPower('?lowPower=0')).toBe(false);
  });

  it('draws viewport anchors below the state names and above every city (T7)', () => {
    const style = styleFor(false);
    const ids = style.layers.map((l) => l.id);
    expect(style.sources[SOURCE.viewportLabels]).toBeDefined();
    expect(ids.indexOf(LAYER.viewportStateLabels)).toBeLessThan(
      ids.indexOf(LAYER.stateLabels),
    );
    for (const city of [LAYER.places, LAYER.capitals])
      expect(ids.indexOf(LAYER.viewportStateLabels)).toBeGreaterThan(
        ids.indexOf(city),
      );
  });

  it('passes relocated territories through to the state-name filter', () => {
    const sel = { id: null, name: null, dependencyIds: [] };
    expect(
      styleOptions(DEFAULT_SETTINGS, false, sel, [131, 86]).relocatedLabels,
    ).toEqual([131, 86]);
    expect(styleOptions(DEFAULT_SETTINGS, false, sel).relocatedLabels).toEqual(
      [],
    );
  });
});

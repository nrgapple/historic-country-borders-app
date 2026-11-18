import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '@repo/data/map-fonts.json';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { DEFAULT_SETTINGS } from '../atlas/settings';
import {
  createStyle,
  LAYER,
  legendEntries,
  resolveLowPower,
  SOURCE,
  styledLayers,
  styleOptions,
} from './mapStyle';
import {
  TEXTBOOK_HIDDEN,
  TEXTBOOK_LAYER,
  TEXTBOOK_MARKER,
} from './textbookStyle';

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

describe('Modern textbook style (theme B)', () => {
  const themed = (
    theme: 'classic' | 'textbook',
    changes: Partial<typeof DEFAULT_SETTINGS> = {},
    lowPower = false,
  ) =>
    createStyle({
      origin: '',
      settings: { ...DEFAULT_SETTINGS, ...changes },
      lowPower,
      theme,
    });
  const layer = (style: ReturnType<typeof themed>, id: string) =>
    style.layers.find((l) => l.id === id)!;
  const visibility = (style: ReturnType<typeof themed>, id: string) =>
    (layer(style, id).layout as { visibility?: string } | undefined)
      ?.visibility ?? 'visible';

  it('has exactly the Classic layer ids, in the same order (a switch only sets properties)', () => {
    const a = themed('classic').layers.map((l) => l.id);
    const b = themed('textbook').layers.map((l) => l.id);
    expect(b).toEqual(a);
    // Adding the relief keeps the two lists aligned too.
    const o = styleOptions(DEFAULT_SETTINGS, false);
    expect(styledLayers('textbook', o, true).map((l) => l.id)).toEqual(
      styledLayers('classic', o, true).map((l) => l.id),
    );
    expect(
      styledLayers('classic', o, true).findIndex((l) => l.id === LAYER.relief),
    ).toBeLessThan(
      styledLayers('classic', o, true).findIndex(
        (l) => l.id === LAYER.edgeBand,
      ),
    );
  });

  it('draws no graticule in either theme (owner decision)', () => {
    for (const theme of ['classic', 'textbook'] as const)
      expect(themed(theme).layers.map((l) => l.id)).not.toContain(
        LAYER.graticule,
      );
  });

  it('is a valid MapLibre style that requests only published fontstacks', () => {
    for (const projectorText of [false, true]) {
      const style = themed('textbook', { projectorText });
      expect(validateStyleMin(style)).toEqual([]);
      expect(checkStyleFontstacks(style, manifest)).toEqual([]);
    }
    expect(fontsOf(themed('textbook'))).toContain('Literata Italic');
    expect(fontsOf(themed('textbook'))).not.toContain('Alegreya');
    expect(fontsOf(themed('classic'))).not.toContain('Literata');
  });

  it('shows B’s hatch, casing and shelf only in B, and hides A’s decorations', () => {
    const a = themed('classic');
    const b = themed('textbook');
    for (const id of Object.values(TEXTBOOK_LAYER)) {
      expect(visibility(a, id)).toBe('none');
      expect(visibility(b, id)).toBe('visible');
    }
    for (const id of TEXTBOOK_HIDDEN) {
      expect(visibility(b, id)).toBe('none');
      expect(visibility(a, id)).not.toBe('none');
    }
  });

  it('paints the B palette, water and capitals', () => {
    const b = themed('textbook');
    expect(layer(b, LAYER.ocean).paint).toMatchObject({
      'fill-color': '#BCDDEB',
    });
    expect(layer(b, LAYER.land).paint).toMatchObject({
      'background-color': '#F4F1EA',
    });
    expect(JSON.stringify(layer(b, LAYER.territoryFill).paint)).toContain(
      '#F6B9A6',
    );
    expect(layer(b, LAYER.stateLabels).layout).toMatchObject({
      'text-transform': 'uppercase',
    });
    expect(
      (layer(b, TEXTBOOK_LAYER.selectedHatch).paint as Record<string, unknown>)[
        'fill-pattern'
      ],
    ).toBe(TEXTBOOK_MARKER.selectedHatch);
  });

  it('keeps the ocean over the fills and the label order of T7', () => {
    const ids = themed('textbook').layers.map((l) => l.id);
    expect(ids.indexOf(LAYER.ocean)).toBeGreaterThan(
      ids.indexOf(LAYER.selectedLine),
    );
    expect(ids.indexOf(TEXTBOOK_LAYER.shelf)).toBe(
      ids.indexOf(LAYER.ocean) + 1,
    );
    expect(ids.indexOf(TEXTBOOK_LAYER.borderCasing)).toBeLessThan(
      ids.indexOf(LAYER.border),
    );
    expect(ids.indexOf(LAYER.viewportStateLabels)).toBeLessThan(
      ids.indexOf(LAYER.stateLabels),
    );
  });

  it('keeps low power working: B drops the dependency hatch and the shelf, never the selection', () => {
    const b = themed('textbook', {}, true);
    expect(visibility(b, LAYER.dependencyHatch)).toBe('none');
    expect(visibility(b, TEXTBOOK_LAYER.shelf)).toBe('none');
    expect(visibility(b, TEXTBOOK_LAYER.selectedHatch)).toBe('visible');
    expect(visibility(b, LAYER.selectedLine)).toBe('visible');
  });

  it('gives the key B’s swatches in B and T6’s in Classic', () => {
    const drawn = {
      selected: true,
      dependency: true,
      overlordDependency: false,
      capital: true,
      city: true,
      site: false,
    };
    const b = legendEntries(drawn, 'textbook');
    expect(b.map((e) => e.id)).toEqual(
      legendEntries(drawn, 'classic').map((e) => e.id),
    );
    expect(b[0].symbol).toMatchObject({ edge: '#1B5CA6', hatch: true });
  });
});

import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import manifest from '@repo/data/map-fonts.json';
import { DEFAULT_SETTINGS, type Settings } from '../../atlas/settings';
import {
  BASEMAP_ATTRIBUTION,
  createPaStyle,
  districtFillOpacity,
  dynamicProperties,
  PA_COLOR,
  PA_LAYER,
  PA_SOURCE,
} from '../paStyle';
import { districtFill, districtPalette } from '../palette';

const require = createRequire(import.meta.url);
const { checkStyleFontstacks } = require(
  path.resolve('scripts/lib/map-fonts.js'),
) as {
  checkStyleFontstacks: (style: unknown, manifest: unknown) => string[];
};

const styleFor = (
  changes: Partial<Settings> = {},
  selectedId: number | null = null,
  origin = '',
) =>
  createPaStyle(origin, {
    settings: { ...DEFAULT_SETTINGS, ...changes },
    selectedId,
  });

describe('Pennsylvania Classic-atlas style', () => {
  it('is a valid MapLibre style in every settings combination', () => {
    for (const changes of [
      {},
      { projectorText: true },
      { textCase: 'upper' as const, textSize: 'large' as const },
      { showLabels: false },
      { borderThickness: 0, countryOpacity: 0.1 },
      { paColourBy: 'football' as const },
      { paColourBy: 'piaa' as const, showLabels: false },
      { paColourBy: 'enrollment' as const, projectorText: true },
    ])
      for (const selected of [null, 3])
        expect(
          validateStyleMin(styleFor(changes, selected, 'http://127.0.0.1')),
        ).toEqual([]);
  });

  it('uses only T3’s published fontstacks, Atkinson only with Projector text', () => {
    expect(checkStyleFontstacks(styleFor(), manifest)).toEqual([]);
    expect(
      checkStyleFontstacks(styleFor({ projectorText: true }), manifest),
    ).toEqual([]);
    expect(JSON.stringify(styleFor().layers)).not.toContain('Atkinson');
    expect(JSON.stringify(styleFor({ projectorText: true }).layers)).toContain(
      'Atkinson Hyperlegible Next Bold',
    );
  });

  it('serves tiles only through the first-party protocol, with ODbL credit', () => {
    const style = styleFor();
    expect(JSON.stringify(style)).not.toMatch(
      /mapbox\.com|https?:\/\/(?!127\.0\.0\.1)[^"]*\{z\}/,
    );
    const basemap = style.sources[PA_SOURCE.basemap] as {
      tiles: string[];
      attribution: string;
    };
    expect(basemap.tiles).toEqual(['pa-tiles://basemap/{z}/{x}/{y}']);
    expect(basemap.attribution).toBe(BASEMAP_ATTRIBUTION);
    expect(BASEMAP_ATTRIBUTION).toMatch(/OpenStreetMap/);
  });

  it('draws district names above every other label so they claim space first', () => {
    const ids = styleFor().layers.map((l) => l.id);
    // Only the PIAA region numbers (shown in that colouring alone) come later.
    expect(ids.at(-1)).toBe(PA_LAYER.piaaLabels);
    expect(ids.at(-2)).toBe(PA_LAYER.districtLabels);
    expect(ids.indexOf(PA_LAYER.districtFill)).toBeLessThan(
      ids.indexOf(PA_LAYER.water),
    );
    expect(ids.indexOf(PA_LAYER.roadHighway)).toBeLessThan(
      ids.indexOf(PA_LAYER.districtBorder),
    );
  });

  it('maps the settings onto the district layers', () => {
    const props = (changes: Partial<Settings>) =>
      dynamicProperties({
        settings: { ...DEFAULT_SETTINGS, ...changes },
        selectedId: null,
      });
    expect(
      districtFillOpacity({ ...DEFAULT_SETTINGS, countryOpacity: 1 }),
    ).toBeGreaterThan(districtFillOpacity(DEFAULT_SETTINGS));
    expect(
      props({ textCase: 'upper' })[PA_LAYER.districtLabels].layout![
        'text-transform'
      ],
    ).toBe('uppercase');
    expect(
      props({ showLabels: false })[PA_LAYER.districtLabels].filter,
    ).toBeTruthy();
    expect(
      props({ showLabels: true })[PA_LAYER.districtLabels].filter,
    ).toBeNull();
    // Labels never drop below 13 px, even at the small setting.
    expect(JSON.stringify(props({ textSize: 'small' }))).not.toMatch(
      /"text-size":(?:1[0-2]|[0-9])(?:\.\d+)?[,}]/,
    );
  });

  it('colours districts by the chosen PIAA fact, keeping the washes by default', () => {
    const fill = (mode: Settings['paColourBy']) =>
      dynamicProperties({
        settings: { ...DEFAULT_SETTINGS, paColourBy: mode },
        selectedId: 3,
      })[PA_LAYER.districtFill].paint!;
    // Default: the 12 washes, madder when selected, translucent.
    expect(JSON.stringify(fill('default')['fill-color'])).toContain('"c"');
    expect(fill('default')['fill-opacity']).toEqual(
      expect.arrayContaining(['case']),
    );
    // A data colouring reads its tile property and stays its colour when selected.
    expect(JSON.stringify(fill('football')['fill-color'])).toContain('"f"');
    expect(JSON.stringify(fill('piaa')['fill-color'])).toContain('"p"');
    expect(JSON.stringify(fill('enrollment')['fill-color'])).toContain('"e"');
    expect(JSON.stringify(fill('football')['fill-color'])).not.toContain(
      'selected',
    );
    expect(fill('football')['fill-opacity']).toBe(0.8);
  });

  it('shows the hatch, the PIAA numbers and the second name line only in their modes', () => {
    const props = (mode: Settings['paColourBy']) =>
      dynamicProperties({
        settings: { ...DEFAULT_SETTINGS, paColourBy: mode },
        selectedId: null,
      });
    expect(props('football')[PA_LAYER.districtHatch].layout!.visibility).toBe(
      'visible',
    );
    expect(props('piaa')[PA_LAYER.districtHatch].layout!.visibility).toBe(
      'none',
    );
    expect(props('piaa')[PA_LAYER.piaaLabels].layout!.visibility).toBe(
      'visible',
    );
    expect(props('default')[PA_LAYER.piaaLabels].layout!.visibility).toBe(
      'none',
    );
    expect(
      props('default')[PA_LAYER.districtLabels].layout!['text-field'],
    ).toEqual(['get', 'n']);
    expect(
      JSON.stringify(
        props('football')[PA_LAYER.districtLabels].layout!['text-field'],
      ),
    ).toContain('"sf"');
    expect(
      JSON.stringify(
        props('enrollment')[PA_LAYER.districtLabels].layout!['text-field'],
      ),
    ).toContain('"se"');
    // Ink, not madder, on a data colouring's darkest steps.
    expect(
      props('football')[PA_LAYER.districtLabels].paint!['text-color'],
    ).toBe(PA_COLOR.ink);
  });
});

describe('Pennsylvania Modern-textbook style', () => {
  const both = (
    changes: Partial<Settings> = {},
    selectedId: number | null = null,
    origin = '',
  ) =>
    (['classic', 'textbook'] as const).map((theme) =>
      createPaStyle(origin, {
        settings: { ...DEFAULT_SETTINGS, ...changes },
        selectedId,
        theme,
      }),
    );
  const layer = (style: ReturnType<typeof styleFor>, id: string) =>
    style.layers.find((l) => l.id === id)!;
  const visibility = (style: ReturnType<typeof styleFor>, id: string) =>
    (layer(style, id).layout as { visibility?: string } | undefined)
      ?.visibility ?? 'visible';

  it('is valid, with the same layers as Classic, in every settings combination', () => {
    for (const changes of [{}, { projectorText: true }, { showLabels: false }])
      for (const selected of [null, 3]) {
        const [a, b] = both(changes, selected);
        expect(
          validateStyleMin(both(changes, selected, 'http://127.0.0.1')[1]),
        ).toEqual([]);
        expect(checkStyleFontstacks(b, manifest)).toEqual([]);
        expect(b.layers.map((l) => l.id)).toEqual(a.layers.map((l) => l.id));
      }
  });

  it('keeps the street basemap: streets, highways and names stay visible in B', () => {
    const [, b] = both();
    for (const id of [
      PA_LAYER.roadMinor,
      PA_LAYER.roadMajor,
      PA_LAYER.roadHighway,
      PA_LAYER.streetLabels,
      PA_LAYER.roadLabels,
      PA_LAYER.towns,
    ])
      expect(visibility(b, id)).toBe('visible');
    // The district wash stays thin enough for the streets under it.
    expect(
      districtFillOpacity(DEFAULT_SETTINGS, 'textbook'),
    ).toBeLessThanOrEqual(districtFillOpacity(DEFAULT_SETTINGS, 'classic'));
  });

  it('marks the selection with a hatch and casing in B, A’s band in Classic', () => {
    const [a, b] = both({}, 3);
    expect(visibility(b, PA_LAYER.selectedHatch)).toBe('visible');
    expect(visibility(b, PA_LAYER.districtCasing)).toBe('visible');
    expect(visibility(b, PA_LAYER.districtBand)).toBe('none');
    expect(visibility(a, PA_LAYER.selectedHatch)).toBe('none');
    expect(visibility(a, PA_LAYER.districtBand)).toBe('visible');
  });

  it('takes district fills from the one theme-aware palette', () => {
    const [a, b] = both();
    const fill = (s: typeof a) =>
      JSON.stringify(
        (layer(s, PA_LAYER.districtFill).paint as Record<string, unknown>)[
          'fill-color'
        ],
      );
    expect(fill(b)).toContain(JSON.stringify(districtFill('textbook')));
    expect(fill(a)).toContain(JSON.stringify(districtFill('classic')));
    expect(districtPalette('textbook').fills).toHaveLength(12);
    expect(districtPalette('textbook').fills[0]).toBe('#F6B9A6');
  });
});

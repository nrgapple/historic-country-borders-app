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
  PA_LAYER,
  PA_SOURCE,
} from '../paStyle';

const require = createRequire(import.meta.url);
const { checkStyleFontstacks } = require(
  path.resolve('../scripts/lib/map-fonts.js'),
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
    expect(ids.at(-1)).toBe(PA_LAYER.districtLabels);
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
});

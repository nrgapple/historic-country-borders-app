import type { LayerSpecification } from 'maplibre-gl';
import { LAYER, styledLayers, styleOptions } from '../../adapters/mapStyle';
import { TEXTBOOK_LAYER } from '../../adapters/textbookStyle';
import { WASHES, COLOR } from '../classic/tokens';
import { DEFAULT_SETTINGS } from '../settings';
import { TEXTBOOK_WASHES } from '../../styles/tokens';
import {
  buildPalette,
  evaluate,
  parseColor,
  PALETTE_ROWS,
  UnsupportedExpression,
  type PaintSource,
} from './paint';

const hex = (rgba: number[]) =>
  `#${rgba
    .slice(0, 3)
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`.toUpperCase();

/** The paint the overlay reads, from a theme's real layer list. */
function paintOf(theme: 'classic' | 'textbook'): PaintSource {
  const layers = styledLayers(theme, styleOptions(DEFAULT_SETTINGS, false));
  const layer = (id: string) =>
    layers.find((l) => l.id === id) as LayerSpecification & {
      paint: Record<string, unknown>;
      layout?: Record<string, unknown>;
    };
  const shown = (id: string) => layer(id).layout?.visibility !== 'none';
  const casing = layer(TEXTBOOK_LAYER.borderCasing);
  const band = layer(LAYER.edgeBand);
  return {
    land: layer(LAYER.land).paint['background-color'],
    fillColor: layer(LAYER.territoryFill).paint['fill-color'],
    fillOpacity: layer(LAYER.territoryFill).paint['fill-opacity'],
    lineColor: layer(LAYER.border).paint['line-color'],
    lineWidth: layer(LAYER.border).paint['line-width'],
    lineOpacity: layer(LAYER.border).paint['line-opacity'],
    casing: shown(TEXTBOOK_LAYER.borderCasing)
      ? {
          color: casing.paint['line-color'],
          width: casing.paint['line-width'],
        }
      : null,
    band: shown(LAYER.edgeBand)
      ? {
          color: band.paint['line-color'],
          width: band.paint['line-width'],
          offset: band.paint['line-offset'],
          opacity: band.paint['line-opacity'],
        }
      : null,
  };
}

const ctx = (
  properties: Record<string, unknown> = {},
  featureState: Record<string, unknown> = {},
  zoom = 3,
) => ({ properties, featureState, zoom });

describe('parseColor', () => {
  it('reads the colour forms the styles use', () => {
    expect(parseColor('#FF8000')).toEqual([1, 128 / 255, 0, 1]);
    expect(parseColor('#f80')).toEqual([1, 136 / 255, 0, 1]);
    expect(parseColor('#00000080')[3]).toBeCloseTo(0.5, 2);
    expect(parseColor('rgba(247, 240, 222, 0.92)')).toEqual([
      247 / 255,
      240 / 255,
      222 / 255,
      0.92,
    ]);
    expect(parseColor('rgb(0 0 0)')).toEqual([0, 0, 0, 1]);
    expect(parseColor('white')).toEqual([1, 1, 1, 1]);
  });

  it('refuses what it cannot read (the change then snaps)', () => {
    expect(() => parseColor('hsl(10, 20%, 30%)')).toThrow(
      UnsupportedExpression,
    );
    expect(() => parseColor(42)).toThrow(UnsupportedExpression);
  });
});

describe('evaluate', () => {
  it('handles case, match, get, feature-state and coalesce', () => {
    const expr = [
      'case',
      ['boolean', ['feature-state', 'selected'], false],
      'sel',
      ['==', ['get', 'dep'], 1],
      ['match', ['coalesce', ['get', 'oc'], -1], [0, 1], 'dep-a', 'dep-b'],
      'own',
    ];
    expect(evaluate(expr, ctx({}, { selected: true }))).toBe('sel');
    expect(evaluate(expr, ctx({ dep: 1, oc: 1 }))).toBe('dep-a');
    expect(evaluate(expr, ctx({ dep: 1 }))).toBe('dep-b');
    expect(evaluate(expr, ctx({ c: 2 }))).toBe('own');
  });

  it('interpolates numbers and colours by zoom', () => {
    const width = ['interpolate', ['linear'], ['zoom'], 2, 1, 6, 3];
    expect(evaluate(width, ctx({}, {}, 1))).toBe(1);
    expect(evaluate(width, ctx({}, {}, 4))).toBe(2);
    expect(evaluate(width, ctx({}, {}, 9))).toBe(3);
    const colour = evaluate(
      ['interpolate', ['linear'], ['zoom'], 0, '#000000', 10, '#FFFFFF'],
      ctx({}, {}, 5),
    ) as number[];
    expect(colour[0]).toBeCloseTo(0.5);
    expect(
      evaluate(['step', ['zoom'], 'a', 3, 'b', 5, 'c'], ctx({}, {}, 4)),
    ).toBe('b');
  });

  it('throws on operators it does not know', () => {
    expect(() =>
      evaluate(
        ['interpolate', ['exponential', 2], ['zoom'], 0, 1, 1, 2],
        ctx(),
      ),
    ).toThrow(UnsupportedExpression);
    expect(() => evaluate(['distance', {}], ctx())).toThrow(
      UnsupportedExpression,
    );
  });
});

describe('buildPalette from the real styles', () => {
  const keys = Uint16Array.from([1, 2, 3]);
  const props: Array<Record<string, number>> = [
    { c: 3 },
    { c: 7 },
    { dep: 1, ov: 0, oc: 3 },
  ];
  const none = () => ({});

  it.each(['classic', 'textbook'] as const)(
    'evaluates every %s paint the overlay needs',
    (theme) => {
      const paint = paintOf(theme);
      const palette = buildPalette(paint, props, keys, 4, none, 3);
      expect(palette.rows.length).toBe(4 * PALETTE_ROWS * 4);
      expect(palette.lineWidth).toBeGreaterThan(0);
      if (theme === 'classic') {
        expect(paint.band).not.toBeNull();
        expect(paint.casing).toBeNull();
        expect(palette.bandWidth).toBeGreaterThan(0);
      } else {
        expect(paint.band).toBeNull();
        expect(paint.casing).not.toBeNull();
        expect(palette.casingWidth).toBeGreaterThan(palette.lineWidth);
      }
    },
  );

  it('composites the fill over the land exactly as the fill layer does', () => {
    const paint = paintOf('classic');
    const palette = buildPalette(paint, props, keys, 4, none, 3);
    const texel = (row: number, key: number) =>
      Array.from(
        palette.rows.slice((row * 4 + key) * 4, (row * 4 + key) * 4 + 4),
      );
    // Key 0 is bare land.
    expect(hex(texel(0, 0).map((v) => v / 255))).toBe(COLOR.land);
    // The opacity of the default settings over the land.
    const opacity = evaluate(paint.fillOpacity, ctx()) as number;
    const land = parseColor(COLOR.land);
    const wash = parseColor(WASHES[3].fill);
    const expected = land.map((v, i) => v + (wash[i] - v) * opacity);
    texel(0, 1)
      .slice(0, 3)
      .forEach((v, i) => expect(v).toBeCloseTo(expected[i] * 255, -0.5));
    // The border: ink at the style's opacity.
    expect(hex(texel(1, 1).map((v) => v / 255))).toBe(COLOR.ink);
    expect(texel(1, 1)[3] / 255).toBeCloseTo(0.72, 2);
    // The edge band: the wash's edge pigment.
    expect(hex(texel(3, 1).map((v) => v / 255))).toBe(WASHES[3].edge);
  });

  it("uses Modern textbook's colours and same-hue borders", () => {
    const palette = buildPalette(paintOf('textbook'), props, keys, 4, none, 3);
    const texel = (row: number, key: number) =>
      Array.from(
        palette.rows.slice((row * 4 + key) * 4, (row * 4 + key) * 4 + 4),
      );
    expect(hex(texel(1, 2).map((v) => v / 255))).toBe(TEXTBOOK_WASHES[7].edge);
    expect(hex(texel(2, 2).map((v) => v / 255))).toBe('#FFFFFF');
  });

  it('paints the selection from feature-state', () => {
    const paint = paintOf('classic');
    const plain = buildPalette(paint, props, keys, 4, none, 3);
    const selected = buildPalette(
      paint,
      props,
      keys,
      4,
      (id) => ({ selected: id === 1 }),
      3,
    );
    const fill = (p: typeof plain, key: number) =>
      Array.from(p.rows.slice(key * 4, key * 4 + 3));
    expect(fill(selected, 2)).not.toEqual(fill(plain, 2));
    expect(fill(selected, 1)).toEqual(fill(plain, 1));
  });
});

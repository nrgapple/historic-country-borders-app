import { describe, expect, it } from 'vitest';
import { expression } from '@maplibre/maplibre-gl-style-spec';
import {
  colourLegend,
  colourSearch,
  COLOUR_BY,
  COLOUR_BY_CONTRAST_PAIRS,
  edgeColour,
  ENROLLMENT_BREAKS,
  enrollmentBin,
  enrollmentRangeLabel,
  fillColour,
  hatchImage,
  isColourBy,
  NO_FOOTBALL_FILTER,
  PA_COLOUR_PALETTES as P,
  parseColourBy,
  piaaName,
} from '../colourBy';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../../atlas/settings';

/** Evaluates a data expression for one feature, as MapLibre would. */
const evaluate = (expr: unknown, properties: Record<string, unknown>) => {
  const parsed = expression.createExpression(expr, {
    type: 'color',
    'property-type': 'data-driven',
    expression: { interpolated: false, parameters: ['zoom', 'feature'] },
  } as never);
  if (parsed.result !== 'success')
    throw new Error(JSON.stringify(parsed.value));
  const colour = parsed.value.evaluate({ zoom: 8 }, {
    type: 'Polygon',
    properties,
  } as never) as unknown;
  // Literal outputs come back as written; computed ones as a Color.
  if (typeof colour === 'string') return colour.toUpperCase();
  const { r, g, b } = colour as { r: number; g: number; b: number };
  const hex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
};

describe('Colour districts by', () => {
  it('keeps the default washes and returns expressions for each data mode', () => {
    expect(fillColour('default')).toBeNull();
    expect(edgeColour('default')).toBeNull();
    for (const mode of ['football', 'piaa', 'enrollment'] as const) {
      expect(fillColour(mode)).not.toBeNull();
      expect(edgeColour(mode)).not.toBeNull();
    }
  });

  it('ramps football class 1A light to 6A dark, with a neutral for none', () => {
    const fill = fillColour('football');
    expect(evaluate(fill, { f: 1 })).toBe(P.football[0]);
    expect(evaluate(fill, { f: 6 })).toBe(P.football[5]);
    expect(evaluate(fill, { f: 0 })).toBe(P.noFootball.fill);
    expect(evaluate(fill, {})).toBe(P.noFootball.fill);
    // Ordered: each step darker than the last.
    const lum = (hex: string) =>
      [1, 3, 5].reduce((n, i) => n + parseInt(hex.slice(i, i + 2), 16), 0);
    for (let i = 1; i < 6; i += 1)
      expect(lum(P.football[i])).toBeLessThan(lum(P.football[i - 1]));
  });

  it('gives each PIAA district its own colour', () => {
    const fill = fillColour('piaa');
    expect(new Set(P.piaa).size).toBe(12);
    for (let p = 1; p <= 12; p += 1)
      expect(evaluate(fill, { p })).toBe(P.piaa[p - 1]);
    expect(evaluate(fill, { p: 0 })).toBe(P.unknown);
  });

  it('bins enrollment at the published breaks', () => {
    const fill = fillColour('enrollment');
    expect(evaluate(fill, { e: 1 })).toBe(P.enrollment[0]);
    expect(evaluate(fill, { e: ENROLLMENT_BREAKS[0] - 1 })).toBe(
      P.enrollment[0],
    );
    expect(evaluate(fill, { e: ENROLLMENT_BREAKS[0] })).toBe(P.enrollment[1]);
    expect(evaluate(fill, { e: 99_999 })).toBe(P.enrollment[5]);
    expect(evaluate(fill, { e: 0 })).toBe(P.unknown);
    expect(evaluate(fill, {})).toBe(P.unknown);
    expect(enrollmentBin(0)).toBe(-1);
    expect(enrollmentBin(ENROLLMENT_BREAKS[4])).toBe(5);
    expect(enrollmentRangeLabel(0)).toBe(`Under ${ENROLLMENT_BREAKS[0]}`);
    expect(enrollmentRangeLabel(5)).toBe(
      `${ENROLLMENT_BREAKS[4].toLocaleString('en-US')} or more`,
    );
  });

  it('hatches only districts without football', () => {
    const filter = expression.createExpression(NO_FOOTBALL_FILTER, {
      type: 'boolean',
      'property-type': 'data-driven',
      expression: { interpolated: false, parameters: ['zoom', 'feature'] },
    } as never);
    if (filter.result !== 'success') throw new Error('bad filter');
    const test = (properties: Record<string, unknown>) =>
      filter.value.evaluate({ zoom: 8 }, {
        type: 'Polygon',
        properties,
      } as never);
    expect(test({ f: 0 })).toBe(true);
    expect(test({})).toBe(true);
    expect(test({ f: 3 })).toBe(false);
    const image = hatchImage(16);
    expect(image.data).toHaveLength(16 * 16 * 4);
    expect([...image.data].some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
  });

  it('builds legends with district counts', () => {
    const values = [
      { f: 6, p: 3, e: 2000 },
      { f: 6, p: 3, e: 1600 },
      { f: 1, p: 9, e: 120 },
      { f: 0, p: 0, e: 0 },
    ];
    expect(colourLegend('default', values)).toBeNull();
    const football = colourLegend('football', values, '2026-27 and 2027-28')!;
    expect(football.title).toBe('PIAA football class');
    expect(football.note).toMatch(/^2026-27 and 2027-28\. /);
    expect(football.entries.map((e) => [e.label, e.count])).toEqual([
      ['6A', '2 districts'],
      ['5A', '0 districts'],
      ['4A', '0 districts'],
      ['3A', '0 districts'],
      ['2A', '0 districts'],
      ['1A', '1 district'],
      ['No PIAA football', '1 district'],
    ]);
    expect(football.entries.at(-1)!.hatch).toBe(P.noFootball.hatch);
    const piaa = colourLegend('piaa', values)!;
    expect(piaa.columns).toBe(2);
    expect(piaa.entries.find((e) => e.id === 'III')!.count).toBe('2');
    expect(piaa.entries.at(-1)!.label).toBe('Unknown');
    const enrollment = colourLegend('enrollment', values)!;
    expect(enrollment.entries[0].count).toBe('2 districts');
    expect(enrollment.entries.at(-1)).toMatchObject({
      label: 'No PIAA data',
      count: '1 district',
    });
  });

  it('shares the mode in ?colour= and validates it', () => {
    expect(parseColourBy('?colour=football')).toBe('football');
    expect(parseColourBy('?colour=nonsense')).toBeUndefined();
    expect(parseColourBy('')).toBeUndefined();
    expect(colourSearch('?place=Pittsburgh', 'piaa')).toBe(
      '?place=Pittsburgh&colour=piaa',
    );
    expect(colourSearch('?colour=piaa&zoom=8', 'default')).toBe('?zoom=8');
    expect(colourSearch('?colour=piaa', 'default')).toBe('');
    expect(COLOUR_BY.every(isColourBy)).toBe(true);
  });

  it('stores the mode with the other settings, falling back to default', () => {
    expect(DEFAULT_SETTINGS.paColourBy).toBe('default');
    expect(sanitizeSettings({ paColourBy: 'enrollment' }).paColourBy).toBe(
      'enrollment',
    );
    expect(sanitizeSettings({ paColourBy: 'size' }).paColourBy).toBe('default');
  });

  it('names PIAA districts in Roman numerals', () => {
    expect(piaaName(3)).toBe('District III');
    expect(piaaName(12)).toBe('District XII');
  });

  it('lists a contrast pair for every fill that carries a district name', () => {
    expect(COLOUR_BY_CONTRAST_PAIRS).toHaveLength(6 + 1 + 12 + 6 + 1);
  });
});

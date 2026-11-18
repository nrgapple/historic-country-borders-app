import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COLOR,
  CONTRAST_PAIRS,
  ERA_TINTS,
  TEXTBOOK_COLOR,
  TEXTBOOK_CONTRAST_PAIRS,
  TEXTBOOK_ERA_TINTS,
  TEXTBOOK_WASHES,
  THEME_TOKENS,
  WASHES,
} from './tokens';
import { COLOUR_BY_CONTRAST_PAIRS } from '../pa/colourBy';

/** WCAG 2.2 relative luminance and contrast ratio (as design/living-atlas/tools/contrast.cjs). */
const luminance = (hex: string) => {
  const [r, g, b] = (hex.match(/[0-9a-f]{2}/gi) ?? []).map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('Direction A tokens', () => {
  it('matches the spec values quoted in design/living-atlas/README.md', () => {
    expect(COLOR.paper).toBe('#F1E9D6');
    expect(COLOR.sheet).toBe('#FBF6EA');
    expect(COLOR.ink).toBe('#2A2017');
    expect(COLOR.ink2).toBe('#554536');
    expect(COLOR.water).toBe('#BFD2D0');
    expect(ERA_TINTS.medieval.ink).toBe('#8B2A2A');
    expect(WASHES).toHaveLength(12);
    expect(contrast(COLOR.ink, COLOR.paper)).toBeCloseTo(13.2, 0);
    expect(contrast(COLOR.ink2, COLOR.paper)).toBeCloseTo(7.6, 0);
  });

  it.each(CONTRAST_PAIRS)('%s passes WCAG AA', (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  // Pennsylvania's "Colour districts by" palettes carry district names too.
  it.each(COLOUR_BY_CONTRAST_PAIRS)('%s passes WCAG AA', (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the generated tokens.css in sync with tokens.ts', () => {
    // Vitest runs from the repository root.
    const script = path.resolve('scripts/build-tokens.mjs');
    expect(() =>
      execFileSync(process.execPath, [script, '--check'], { stdio: 'pipe' }),
    ).not.toThrow();
    const css = fs.readFileSync(path.resolve('src/styles/tokens.css'), 'utf8');
    expect(css).toContain('color-scheme: light dark only;');
    expect(css).not.toMatch(/\b100vh\b/);
    // B switches the same custom properties, and Projector text still wins.
    const b = css.indexOf(":root[data-theme='textbook']");
    const projector = css.indexOf(":root[data-text='projector']");
    expect(b).toBeGreaterThan(0);
    expect(projector).toBeGreaterThan(b);
    expect(css.slice(b, projector)).toContain('--paper: #FFFFFF;');
    expect(css.slice(b, projector)).toContain('--era-medieval: #1B5CA6;');
  });
});

describe('Direction B tokens (Modern textbook)', () => {
  it('matches the spec values quoted in design/living-atlas/README.md', () => {
    expect(TEXTBOOK_COLOR.ink).toBe('#14202B');
    expect(TEXTBOOK_COLOR.ink2).toBe('#47535F');
    expect(TEXTBOOK_COLOR.water).toBe('#BCDDEB');
    expect(TEXTBOOK_COLOR.waterInk).toBe('#1A5675');
    expect(TEXTBOOK_ERA_TINTS.medieval.ink).toBe('#1B5CA6');
    expect(TEXTBOOK_WASHES).toHaveLength(12);
    expect(contrast(TEXTBOOK_COLOR.ink, '#FFFFFF')).toBeCloseTo(16.5, 0);
    expect(contrast(TEXTBOOK_COLOR.ink2, '#FFFFFF')).toBeCloseTo(7.9, 0);
  });

  it('gives every A colour token a B value', () => {
    expect(Object.keys(TEXTBOOK_COLOR).sort()).toEqual(
      Object.keys(COLOR).sort(),
    );
    expect(Object.keys(THEME_TOKENS).sort()).toEqual(['classic', 'textbook']);
  });

  it.each(TEXTBOOK_CONTRAST_PAIRS)('%s passes WCAG AA', (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

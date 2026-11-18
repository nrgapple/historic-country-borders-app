import fs from 'fs';
import path from 'path';
import {
  AA_LARGE_OR_GRAPHIC,
  allPairs,
  checkPairs,
  composite,
  contrastRatio,
  describeResult,
  parseColor,
  readTokens,
  resolveToken,
  type ContrastPair,
} from '../test/contrast';

const read = (file: string) =>
  fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

/**
 * Checks every pair; pairs listed in `knownGaps` must still fail, so a fix
 * forces the list (and docs/product/SCORECARD.md) to be updated.
 */
const expectAA = (
  tokens: Record<string, string>,
  pairs: ContrastPair[],
  knownGaps: string[] = [],
) => {
  const results = checkPairs(tokens, pairs);
  const key = (r: ContrastPair) => `${r.foreground} on ${r.background}`;
  const failing = results.filter((r) => !r.passes);
  expect(
    failing.filter((r) => !knownGaps.includes(key(r))).map(describeResult),
    'pairs below WCAG AA',
  ).toEqual([]);
  expect(
    knownGaps.filter((gap) => !failing.some((r) => key(r) === gap)),
    'known gaps that now pass: remove them from the list',
  ).toEqual([]);
  return results;
};

describe('contrast helpers', () => {
  it('computes WCAG ratios', () => {
    expect(contrastRatio(parseColor('#000'), parseColor('#fff'))).toBeCloseTo(
      21,
    );
    expect(
      contrastRatio(parseColor('#767676'), parseColor('#ffffff')),
    ).toBeCloseTo(4.54, 2);
  });

  it('parses colours and composites translucency', () => {
    expect(parseColor('rgba(163, 52, 31, 0.1)')).toEqual({
      r: 163,
      g: 52,
      b: 31,
      a: 0.1,
    });
    expect(parseColor('#ff000080').a).toBeCloseTo(0.5, 2);
    expect(
      composite(parseColor('rgba(0, 0, 0, 0.5)'), parseColor('#ffffff')),
    ).toEqual({ r: 127.5, g: 127.5, b: 127.5, a: 1 });
  });

  it('reads :root tokens and resolves var() references', () => {
    const tokens = readTokens(`
      /* comment */
      :root { --a: #111; --b: var(--a); --c: var(--b, red); }
      .x { --a: #fff; }
    `);
    expect(resolveToken(tokens, 'c')).toBe('#111');
    expect(() => resolveToken(tokens, 'missing')).toThrow(/Unknown token/);
  });

  it('requires a backdrop for translucent colours', () => {
    const tokens = readTokens(':root { --soft: rgba(0,0,0,.1); --bg: #fff; }');
    expect(() =>
      checkPairs(tokens, [{ foreground: '#000', background: 'soft' }]),
    ).toThrow(/translucent/);
    expect(
      checkPairs(tokens, [
        { foreground: '#000', background: 'soft over bg' },
      ])[0].passes,
    ).toBe(true);
  });
});

describe('Direction A tokens (design/living-atlas/a-classic-atlas.html)', () => {
  // Until the remaster's token file exists, the Direction A mock is the
  // source of truth. Point this at the token file when T5 adds it.
  const tokens = readTokens(read('design/living-atlas/a-classic-atlas.html'));
  const eras = ['prehistory', 'ancient', 'medieval', 'early-modern', 'modern'];
  const grounds = ['paper', 'paper-2', 'sheet'];

  it('meets WCAG AA for ink on every ground and era wash', () => {
    expectAA(
      tokens,
      allPairs(
        ['ink', 'ink-2'],
        [...grounds, ...eras.map((era) => `era-${era}-wash`)],
      ),
    );
  });

  it('meets WCAG AA for each era accent where the UI uses it', () => {
    // The era of the year sets --accent: era labels and the panel eyebrow sit
    // on paper, the active era band on its own wash, and the primary button
    // is sheet on the accent.
    expectAA(
      tokens,
      eras.flatMap((era) => [
        ...allPairs([`era-${era}`], [...grounds, `era-${era}-wash`]),
        { foreground: 'sheet', background: `era-${era}` },
      ]),
      // Observed 2026-11-17: the design spike checked only the Medieval
      // accent. Prehistory and Ancient fall short on their own washes and
      // Prehistory on the recessed fact box (4.02, 4.33 and 4.37:1).
      [
        'era-prehistory on paper-2',
        'era-prehistory on era-prehistory-wash',
        'era-ancient on era-ancient-wash',
      ],
    );
  });

  it('meets 3:1 for the focus ring', () => {
    expectAA(tokens, allPairs(['focus'], grounds, AA_LARGE_OR_GRAPHIC));
  });
});

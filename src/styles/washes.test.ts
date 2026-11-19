import { describe, expect, it } from 'vitest';
import { deltaE2000, deltaE2000Lab, hexToLab } from './colorDifference';
import { THEME_IDS, THEME_TOKENS, type ThemeId } from './tokens';
import {
  dependencyTint,
  FALLBACK_WASH,
  WASHES as MAP_WASHES,
} from '../atlas/classic/tokens';
import { textbookDependencyTint } from '../adapters/textbookStyle';

describe('deltaE2000', () => {
  // Sharma, Wu and Dalal (2005), "The CIEDE2000 color-difference formula",
  // test data pairs 1, 2, 7, 13 (hue wrap), 17 and 25.
  it.each([
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  ] as const)('matches the published pair %j %j', (a, b, expected) => {
    expect(deltaE2000Lab(a, b)).toBeCloseTo(expected, 3);
    expect(deltaE2000Lab(b, a)).toBeCloseTo(expected, 3);
  });

  it('converts sRGB hex to CIELAB', () => {
    expect(hexToLab('#FFFFFF')[0]).toBeCloseTo(100, 2);
    expect(hexToLab('#000000')[0]).toBeCloseTo(0, 2);
    expect(deltaE2000('#BFD2D0', '#BFD2D0')).toBe(0);
  });
});

/*
 * Territory colours must not read as water. Observed on 2026-11-18: A's
 * verditer (ΔE 3.3 from A's water) and smalt (12.6), and B's aqua (11.0) and
 * cornflower (10.5) made territories such as Safavid Persia look like part of
 * the Caspian. Their replacements sit 24.7–28.5 from water.
 *
 * Every territory fill keeps at least WASH_MIN from its style's water. A's sap
 * green (11.7, a yellow-green, not a blue) is the one fill below it; it was
 * not part of the approved change, so it is held to the lower DILUTED_MIN
 * floor instead of being hidden by weakening the check for every wash. Do not
 * add to WASH_EXCEPTIONS without an owner decision.
 *
 * Dependency tints (40% bare land) and the "unknown" fallback are paler and
 * greyer by design, so they are held to DILUTED_MIN.
 */
const WASH_MIN = 15;
const DILUTED_MIN = 11;
const WASH_EXCEPTIONS: Record<ThemeId, readonly string[]> = {
  classic: ['sap green'],
  textbook: [],
};
/** Washes must also stay apart: no closer than the closest pre-existing pair (A sap green–olive 4.4, B sand–apricot 5.75). */
const NEIGHBOUR_MIN: Record<ThemeId, number> = { classic: 4.3, textbook: 5.7 };

const dependencyTintFor = (theme: ThemeId) =>
  theme === 'classic' ? dependencyTint : textbookDependencyTint;

describe.each(THEME_IDS)('%s territory washes', (theme) => {
  const { color, washes, fallbackWash } = THEME_TOKENS[theme];

  it.each(washes.map((w) => [w.name, w.fill] as const))(
    '%s (%s) does not read as water',
    (name, fill) => {
      const min = WASH_EXCEPTIONS[theme].includes(name)
        ? DILUTED_MIN
        : WASH_MIN;
      expect(deltaE2000(fill, color.water)).toBeGreaterThanOrEqual(min);
    },
  );

  it('keeps dependency tints and the fallback wash away from water', () => {
    for (const w of washes) {
      const tint = dependencyTintFor(theme)(w);
      expect(
        deltaE2000(tint, color.water),
        `${w.name} dependency tint ${tint}`,
      ).toBeGreaterThanOrEqual(DILUTED_MIN);
    }
    expect(deltaE2000(fallbackWash.fill, color.water)).toBeGreaterThanOrEqual(
      DILUTED_MIN,
    );
  });

  it('keeps every pair of washes distinguishable', () => {
    washes.forEach((a, i) =>
      washes.slice(i + 1).forEach((b) => {
        expect(
          deltaE2000(a.fill, b.fill),
          `${a.name} and ${b.name}`,
        ).toBeGreaterThanOrEqual(NEIGHBOUR_MIN[theme]);
      }),
    );
  });

  it('gives every wash a darker edge of its own hue', () => {
    for (const w of washes) {
      const [Lf, af, bf] = hexToLab(w.fill);
      const [Le, ae, be] = hexToLab(w.edge);
      expect(Lf - Le, w.name).toBeGreaterThan(25);
      const hue = (a: number, b: number) => (Math.atan2(b, a) * 180) / Math.PI;
      const dh = Math.abs(hue(ae, be) - hue(af, bf));
      expect(Math.min(dh, 360 - dh), w.name).toBeLessThan(15);
    }
  });
});

it('draws the Classic map with the same washes as the UI tokens', () => {
  expect(MAP_WASHES).toEqual(THEME_TOKENS.classic.washes);
  expect(FALLBACK_WASH).toEqual(THEME_TOKENS.classic.fallbackWash);
});

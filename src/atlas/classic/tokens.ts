/**
 * Direction A ("Classic atlas") map tokens, from `design/living-atlas/README.md`
 * and `a-classic-atlas.html`. UI tokens (paper, sheet, era pigments) belong to
 * the app shell; only colours the map draws are here.
 */
import {
  FALLBACK_WASH as UI_FALLBACK_WASH,
  WASHES as UI_WASHES,
} from '../../styles/tokens';

export interface Wash {
  /** Pigment name, for docs and the legend. */
  name: string;
  fill: string;
  /** Darker edge of the same pigment, for the inner edge band. */
  edge: string;
}

/**
 * The 12 hand-tinted washes, each paired with a darker edge, and the wash for
 * a missing or out-of-range index: the same values as the UI tokens (one
 * source, so the map, the legend and the CSS cannot drift).
 */
export const WASHES: readonly Wash[] = UI_WASHES;
export const FALLBACK_WASH: Wash = UI_FALLBACK_WASH;

/** T1 publishes the wash index `c` (and `oc`) as 0–11, one per wash. */
export const WASH_SLOTS = WASHES.length;

export const COLOR = {
  ink: '#2A2017',
  land: '#F1E8D0',
  sheet: '#FBF6EA',
  water: '#BFD2D0',
  /** Sea and river names: 4.9:1 on `water`. */
  waterInk: '#2F5960',
  /** Coast stroke, lake shore and graticule. */
  coast: '#3F5F61',
  waterline: '#5F8A8C',
  river: '#4F8187',
  /** Medieval madder; the selection always uses it, whatever the era accent. */
  accent: '#8B2A2A',
  selectedFill: '#E4ADA0',
  /** Selected territory name: 5.7:1 on the selected fill. */
  selectedInk: '#6E1F1F',
  stateHalo: 'rgba(247, 240, 222, 0.92)',
  placeHalo: 'rgba(247, 240, 222, 0.95)',
  riverHalo: 'rgba(241, 232, 208, 0.9)',
} as const;

/** Per-channel mix of two `#RRGGBB` colours in sRGB; `t` is the share of `b`. */
export function mix(a: string, b: string, t: number): string {
  const ch = (hex: string, i: number) =>
    parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) =>
    Math.round(ch(a, i) * (1 - t) + ch(b, i) * t),
  );
  return `#${out
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

/**
 * A dependency (colony, protectorate, vassal) is washed in a lighter tint of
 * its overlord's pigment: the wash diluted with this share of bare land.
 */
export const DEPENDENCY_DILUTION = 0.4;
export const dependencyTint = (wash: Wash) =>
  mix(wash.fill, COLOR.land, DEPENDENCY_DILUTION);

/** Dependencies of the selected territory: a light madder, quieter than the selection. */
export const OVERLORD_SELECTED_FILL = mix(COLOR.selectedFill, COLOR.land, 0.45);

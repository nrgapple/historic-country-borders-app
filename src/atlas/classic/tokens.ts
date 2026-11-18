/**
 * Direction A ("Classic atlas") map tokens, from `design/living-atlas/README.md`
 * and `a-classic-atlas.html`. UI tokens (paper, sheet, era pigments) belong to
 * the app shell; only colours the map draws are here.
 */

export interface Wash {
  /** Pigment name, for docs and the legend. */
  name: string;
  fill: string;
  /** Darker edge of the same pigment, for the inner edge band. */
  edge: string;
}

/** The 12 hand-tinted washes, each paired with a darker edge. */
export const WASHES: readonly Wash[] = [
  { name: 'madder', fill: '#E3B9A0', edge: '#A2573A' },
  { name: 'sap green', fill: '#BFD3B2', edge: '#5E7F4C' },
  { name: 'gamboge', fill: '#E8CF95', edge: '#A07A27' },
  { name: 'lilac', fill: '#C9C0DC', edge: '#6E5E95' },
  { name: 'verditer', fill: '#B5CFD3', edge: '#4E7D86' },
  { name: 'rose', fill: '#E6BFC6', edge: '#A05866' },
  { name: 'umber', fill: '#D7C7A4', edge: '#86714A' },
  { name: 'olive', fill: '#C4D7A6', edge: '#6F8B3D' },
  { name: 'orange ochre', fill: '#EBC79F', edge: '#AE7135' },
  { name: 'smalt', fill: '#BBC7DE', edge: '#55688F' },
  { name: 'mauve', fill: '#DCC9D9', edge: '#866083' },
  { name: 'straw green', fill: '#D9DBA8', edge: '#868A3C' },
];

/** Used for a missing or out-of-range wash index. */
export const FALLBACK_WASH: Wash = {
  name: 'unknown',
  fill: '#E2D8C0',
  edge: '#9C8B66',
};

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

/**
 * Direction A, "Classic atlas": the single source of design tokens.
 *
 * `src/styles/tokens.css` is generated from this file by
 * `yarn remaster:tokens` (scripts/build-tokens.mjs) and checked at build, and
 * the map style reads the same values, so the CSS and the map palette cannot
 * drift. Values come from design/living-atlas/README.md and the A mock.
 *
 * Keep this file free of imports: Node strips its types and imports it
 * directly when generating CSS.
 */

export type EraId =
  'prehistory' | 'ancient' | 'medieval' | 'early-modern' | 'modern';

export interface EraTint {
  /** Engraved ink of the era pigment: UI accent, active ruler label. */
  ink: string;
  /** Watercolour wash of the same pigment: era band ground. */
  wash: string;
  /**
   * The pigment darkened just enough for AA text on its own wash (the active
   * era label). The design spike checked only Medieval; Prehistory (4.0:1)
   * and Ancient (4.3:1) failed with `ink`.
   */
  onWash: string;
}

export const ERA_TINTS: Record<EraId, EraTint> = {
  prehistory: { ink: '#8A5A1E', wash: '#E7D3AE', onWash: '#7B501B' },
  ancient: { ink: '#9A4024', wash: '#EBC9B5', onWash: '#8F3C21' },
  medieval: { ink: '#8B2A2A', wash: '#E6C2BC', onWash: '#8B2A2A' },
  'early-modern': { ink: '#2F6455', wash: '#C6DACF', onWash: '#2E6253' },
  modern: { ink: '#2C4B73', wash: '#C7D3E2', onWash: '#2C4B73' },
};

export const COLOR = {
  /** Timeline ground and page. */
  paper: '#F1E9D6',
  /** Recessed paper: the fact box, hover. */
  paper2: '#E8DDC4',
  /** Panel, cartouche and input sheet. */
  sheet: '#FBF6EA',
  /** Text, borders, rules: 13.2:1 on paper. */
  ink: '#2A2017',
  /** Secondary text: 7.6:1 on paper. */
  ink2: '#554536',
  /** Hairline rules. */
  hair: 'rgba(42, 32, 23, 0.28)',
  focus: '#1F4FB5',
  water: '#BFD2D0',
  /** Sea and river names: 4.9:1 on water. */
  waterInk: '#2F5960',
  land: '#F1E8D0',
  selectedFill: '#E4ADA0',
  /** Selected territory name: 5.7:1 on the selected fill. */
  selectedInk: '#6E1F1F',
  /** Error banner ground (madder wash) and its text. */
  alertWash: '#F3D9D3',
  alertInk: '#6E1F1F',
} as const;

/**
 * The 12 hand-tinted map washes, each with a darker edge of the same pigment.
 * The year data's colour slot `c` (0-29, legacy source colours) folds onto
 * them with `c % 12`; slot 30 (unknown) uses `FALLBACK_WASH`.
 */
export const WASHES = [
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
] as const;
export const FALLBACK_WASH = {
  name: 'unknown',
  fill: '#E2D8C0',
  edge: '#9C8B66',
};

/**
 * UI font stacks (T3, docs/FONTS.md "Web fonts"). "Historic Borders Scripts"
 * is T3's Noto subset for the scripts in published names.
 */
export const FONT = {
  serif: '"Alegreya", "Historic Borders Scripts", Georgia, serif',
  smallCaps:
    '"Alegreya SC", "Alegreya", "Historic Borders Scripts", Georgia, serif',
  /** "Projector text" setting: replaces both stacks above. */
  projector:
    '"Atkinson Hyperlegible Next", "Historic Borders Scripts", system-ui, sans-serif',
} as const;

/** Layout constants shared by CSS and camera padding. */
export const LAYOUT = {
  /** Side panel width on tablets and desktops. */
  panelWidth: 420,
  /** At or below this width the panel is a bottom sheet (A's phone layout). */
  phoneMax: 699,
  /** At or below this width the header splits into two rows (§2.3). */
  twoRowMax: 860,
  /** Below this width the place finder collapses to a button (§2.3). */
  finderCollapseMax: 1279,
  /** Map frame inset (the double-ruled plate edge). */
  frameInset: 14,
  frameInsetPhone: 8,
} as const;

/** Text and background pairs that must pass WCAG AA (4.5:1). */
export const CONTRAST_PAIRS: Array<[name: string, fg: string, bg: string]> = [
  ['ink on paper', COLOR.ink, COLOR.paper],
  ['ink on sheet', COLOR.ink, COLOR.sheet],
  ['ink-2 on paper', COLOR.ink2, COLOR.paper],
  ['ink-2 on fact box', COLOR.ink2, COLOR.paper2],
  ['ink-2 on sheet', COLOR.ink2, COLOR.sheet],
  ['sea and river names on water', COLOR.waterInk, COLOR.water],
  ['state names on land', COLOR.ink, COLOR.land],
  ['selected name on selected fill', COLOR.selectedInk, COLOR.selectedFill],
  ['alert text on alert wash', COLOR.alertInk, COLOR.alertWash],
  ...Object.entries(ERA_TINTS).flatMap(
    ([era, tint]): Array<[string, string, string]> => [
      [`${era} accent on paper`, tint.ink, COLOR.paper],
      [`${era} accent on sheet`, tint.ink, COLOR.sheet],
      [`${era} label on its wash`, tint.onWash, tint.wash],
      [`ink on ${era} wash`, COLOR.ink, tint.wash],
      [`sheet on ${era} accent (button)`, COLOR.sheet, tint.ink],
    ],
  ),
  ...WASHES.map((w): [string, string, string] => [
    `state names on ${w.name}`,
    COLOR.ink,
    w.fill,
  ]),
];

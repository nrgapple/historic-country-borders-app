/**
 * The single source of design tokens for both map styles: Direction A,
 * "Classic atlas" (the default), and Direction B, "Modern textbook"
 * (`TEXTBOOK`, under `<html data-theme="textbook">`).
 *
 * `src/styles/tokens.css` is generated from this file by
 * `yarn remaster:tokens` (scripts/build-tokens.mjs) and checked at build, and
 * the map styles read the same values, so the CSS and the map palettes cannot
 * drift. Values come from design/living-atlas/README.md and the A and B mocks.
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

/** The two map styles (Settings → "Map style"). */
export type ThemeId = 'classic' | 'textbook';
export const THEME_IDS: readonly ThemeId[] = ['classic', 'textbook'];

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

/* ---- Direction B, "Modern textbook" --------------------------------------
 * Crisp white pages, colour-coded era chapters, an editorial sans
 * (Atkinson Hyperlegible Next) with a reading serif (Literata). Every key of
 * `COLOR` has a B value, so tokens.css can switch the same custom properties
 * under `:root[data-theme='textbook']` and components need no fork.
 */

export type ColorTokens = { [K in keyof typeof COLOR]: string };

/** Era chapter colours (white text on them) and their washes (era-coloured text). */
export const TEXTBOOK_ERA_TINTS: Record<EraId, EraTint> = {
  prehistory: { ink: '#8C5300', wash: '#F7EBD9', onWash: '#8C5300' },
  ancient: { ink: '#B0362A', wash: '#F8E3E0', onWash: '#B0362A' },
  medieval: { ink: '#1B5CA6', wash: '#E2ECF8', onWash: '#1B5CA6' },
  'early-modern': { ink: '#23743A', wash: '#E0F1E4', onWash: '#23743A' },
  modern: { ink: '#94335F', wash: '#F6E3EC', onWash: '#94335F' },
};

export const TEXTBOOK_COLOR: ColorTokens = {
  /** Page and timeline ground. */
  paper: '#FFFFFF',
  /** Surface grey: the timeline track, hover, skeletons. */
  paper2: '#F3F5F7',
  /** Panels, the map key and inputs. */
  sheet: '#FFFFFF',
  /** Text: 16.5:1 on white. */
  ink: '#14202B',
  /** Secondary text: 7.9:1 on white, 7.2:1 on the surface grey. */
  ink2: '#47535F',
  /** Rules and control outlines (B's `--line`). */
  hair: '#D3DAE1',
  /** B's amber focus ring, paired with an ink ring in CSS (both 3:1 somewhere). */
  focus: '#F2A900',
  water: '#BCDDEB',
  /** Sea and river names: 5.6:1 on water. */
  waterInk: '#1A5675',
  land: '#F4F1EA',
  /** B marks the selection with a hatch over the territory's own tint. */
  selectedFill: '#D6E4F5',
  /** Selected territory name (the map accent). */
  selectedInk: '#1B5CA6',
  alertWash: '#FCE8E6',
  alertInk: '#8F2A1E',
};

/** Stronger rules and graded ticks (B's `--line-strong`); graphics only. */
export const TEXTBOOK_LINE_STRONG = '#9AA6B2';

/** The map accent: selection hatch, outline, label and capital star (Medieval blue). */
export const TEXTBOOK_MAP_ACCENT = '#1B5CA6';

/** The 12 textbook pastels, each with a darker border of the same hue. */
export const TEXTBOOK_WASHES = [
  { name: 'coral', fill: '#F6B9A6', edge: '#B4553A' },
  { name: 'leaf', fill: '#B4DDA4', edge: '#4E8A3A' },
  { name: 'sunflower', fill: '#F5D77E', edge: '#9C7A12' },
  { name: 'iris', fill: '#C8BCEB', edge: '#6A58A8' },
  { name: 'aqua', fill: '#9FD7D3', edge: '#2F8580' },
  { name: 'pink', fill: '#F3B3C8', edge: '#B2486D' },
  { name: 'sand', fill: '#E9CBA1', edge: '#9A6E33' },
  { name: 'lime', fill: '#D2E79A', edge: '#7A9330' },
  { name: 'apricot', fill: '#F8C590', edge: '#B86A1E' },
  { name: 'cornflower', fill: '#B3CBEF', edge: '#4C6FA8' },
  { name: 'orchid', fill: '#E3BFE3', edge: '#93529A' },
  { name: 'sage', fill: '#CFE3C4', edge: '#5F8A50' },
] as const;
export const TEXTBOOK_FALLBACK_WASH = {
  name: 'unknown',
  fill: '#E4E0D6',
  edge: '#8E877A',
};

/**
 * B's type: Atkinson Hyperlegible Next for the UI (in the `--font-serif` and
 * `--font-sc` slots, which every component already uses) and Literata for
 * the year, titles and reading text (`--font-display`).
 */
export const TEXTBOOK_FONT = {
  ui: '"Atkinson Hyperlegible Next", "Historic Borders Scripts", system-ui, sans-serif',
  display: '"Literata", "Historic Borders Scripts", Georgia, serif',
} as const;

/** Every token a theme-aware component or map style reads, per theme. */
export const THEME_TOKENS: Record<
  ThemeId,
  {
    color: ColorTokens;
    eraTints: Record<EraId, EraTint>;
    washes: ReadonlyArray<{ name: string; fill: string; edge: string }>;
    fallbackWash: { name: string; fill: string; edge: string };
  }
> = {
  classic: {
    color: COLOR,
    eraTints: ERA_TINTS,
    washes: WASHES,
    fallbackWash: FALLBACK_WASH,
  },
  textbook: {
    color: TEXTBOOK_COLOR,
    eraTints: TEXTBOOK_ERA_TINTS,
    washes: TEXTBOOK_WASHES,
    fallbackWash: TEXTBOOK_FALLBACK_WASH,
  },
};

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

/** B's text pairs (WCAG AA, 4.5:1), from the B column of the design README. */
export const TEXTBOOK_CONTRAST_PAIRS: Array<
  [name: string, fg: string, bg: string]
> = [
  ['B ink on white', TEXTBOOK_COLOR.ink, TEXTBOOK_COLOR.paper],
  ['B ink on surface', TEXTBOOK_COLOR.ink, TEXTBOOK_COLOR.paper2],
  ['B ink-2 on white', TEXTBOOK_COLOR.ink2, TEXTBOOK_COLOR.paper],
  ['B ink-2 on surface', TEXTBOOK_COLOR.ink2, TEXTBOOK_COLOR.paper2],
  [
    'B sea and river names on water',
    TEXTBOOK_COLOR.waterInk,
    TEXTBOOK_COLOR.water,
  ],
  ['B state names on land', TEXTBOOK_COLOR.ink, TEXTBOOK_COLOR.land],
  [
    'B alert text on alert wash',
    TEXTBOOK_COLOR.alertInk,
    TEXTBOOK_COLOR.alertWash,
  ],
  [
    'B map accent on white (selected name halo)',
    TEXTBOOK_MAP_ACCENT,
    '#FFFFFF',
  ],
  ...Object.entries(TEXTBOOK_ERA_TINTS).flatMap(
    ([era, tint]): Array<[string, string, string]> => [
      [`B white on ${era} chapter colour`, '#FFFFFF', tint.ink],
      [`B ${era} accent on white`, tint.ink, TEXTBOOK_COLOR.paper],
      [`B ${era} label on its wash`, tint.onWash, tint.wash],
      [`B ink on ${era} wash`, TEXTBOOK_COLOR.ink, tint.wash],
      [`B ink-2 on ${era} wash (fact labels)`, TEXTBOOK_COLOR.ink2, tint.wash],
    ],
  ),
  ...TEXTBOOK_WASHES.map((w): [string, string, string] => [
    `B state names on ${w.name}`,
    TEXTBOOK_COLOR.ink,
    w.fill,
  ]),
];

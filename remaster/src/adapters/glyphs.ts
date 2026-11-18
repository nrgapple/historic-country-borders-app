/**
 * T3 ADAPTER: map label fonts as self-hosted SDF glyph PBFs (plan §5).
 *
 * Contract: `/…/{fontstack}/{range}.pbf` for every stack below, each merged
 * with Noto fallback ranges for the scripts in published names.
 *
 * STAND-IN: `scripts/build-standins.mjs` extracts the design spike's glyph
 * bundles (Latin, Latin Extended, punctuation) into /glyphs-standin/ and adds
 * Noto Sans ranges from the spike's SSD cache when present.
 * SWITCH when T3 lands: set GLYPHS_URL to T3's path (for example
 * '/glyphs/{fontstack}/{range}.pbf'). The UI WOFF2 files are the second T3
 * switch: `scripts/sync-public.mjs` and `src/styles/fonts.css`.
 */
export const GLYPHS_URL = '/glyphs-standin/{fontstack}/{range}.pbf';

/** Every map fontstack, named as in plan §5. */
export const FONTSTACK = {
  stateMedium: 'Alegreya SC Medium',
  stateBold: 'Alegreya SC Bold',
  seaItalic: 'Alegreya Medium Italic',
  riverItalic: 'Alegreya Italic',
  city: 'Alegreya Regular',
  /** "Projector text": loaded only when the setting is on. */
  projectorMedium: 'Atkinson Hyperlegible Next Medium',
  projectorBold: 'Atkinson Hyperlegible Next Bold',
} as const;

/**
 * T3 ADAPTER: map label fonts (plan §5), integrated with
 * `t3/self-host-fonts-glyphs` (docs/FONTS.md). The glyph URL and CSS paths
 * come from data/map-fonts.json through the small src/data/fonts.json that
 * scripts/sync-public.mjs writes, so a new glyph build needs no code change.
 *
 * Each fontstack is used as a single-element `text-font` array: fallback
 * scripts are already merged into every stack, and a multi-name array would
 * request a combined directory that does not exist.
 */
import fonts from '../data/fonts.json';

export const GLYPHS_URL = fonts.glyphsUrl;

/** The published fontstacks, named as T6's style uses them. */
export const FONTSTACK = {
  stateMedium: 'Alegreya SC Medium',
  stateBold: 'Alegreya SC Bold',
  seaItalic: 'Alegreya Medium Italic',
  riverItalic: 'Alegreya Italic',
  city: 'Alegreya Regular',
  /** "Projector text": requested only while the setting is on. */
  projectorMedium: 'Atkinson Hyperlegible Next Medium',
  projectorBold: 'Atkinson Hyperlegible Next Bold',
  /** "Modern textbook" water and ruins names; requested only in that style. */
  textbookItalic: 'Literata Italic',
} as const;

/**
 * UI and map-alias CSS (docs/FONTS.md): default on every page, map on map
 * pages, projector with Projector text or Modern textbook, textbook
 * (Literata) with Modern textbook only.
 */
export const FONT_CSS = fonts.css as {
  default: string;
  map: string;
  projector: string;
  textbook: string;
};

/** Each family's OFL license file, for the About dialog. */
export const FONT_LICENSES = fonts.licenses as Array<{
  font: string;
  href: string;
}>;

if (import.meta.env.DEV) {
  const missing = Object.values(FONTSTACK).filter(
    (s) => !fonts.fontstacks.includes(s),
  );
  if (missing.length)
    console.warn(`Fontstacks not published by T3: ${missing.join(', ')}`);
}

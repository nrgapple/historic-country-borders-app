import { FONT_CSS } from '../adapters/glyphs';
import { THEME_IDS, type ThemeId } from '../styles/tokens';
import { PROJECTOR_CSS_ID } from './settings';

export type { ThemeId };

/**
 * The map style ("theme"): Direction A, "Classic atlas", or Direction B,
 * "Modern textbook". It is set on `<html data-theme>`; tokens.css switches
 * the custom properties and the map controllers build the matching MapLibre
 * style through the adapters.
 *
 * Each page family remembers its own choice, so choosing a style on the
 * Pennsylvania map never changes the historical atlas, and the PA default
 * (Modern textbook: the districts are a present-day street map, not a
 * historical plate) never leaks into the year pages. The choice is a
 * per-viewer preference in localStorage, like the other settings; it is not
 * part of the shareable URL contract.
 */
export type ThemeScope = 'atlas' | 'pa';

export const THEME_DEFAULTS: Record<ThemeScope, ThemeId> = {
  atlas: 'classic',
  pa: 'textbook',
};

export const THEME_STORAGE_KEYS: Record<ThemeScope, string> = {
  atlas: 'historic-borders-theme',
  pa: 'historic-borders-theme:pa',
};

export const THEME_LABELS: Record<ThemeId, string> = {
  classic: 'Classic atlas',
  textbook: 'Modern textbook',
};

export const isTheme = (value: unknown): value is ThemeId =>
  typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);

/** A stored value if it is a known theme, else the scope's default. */
export const resolveTheme = (stored: unknown, scope: ThemeScope): ThemeId =>
  isTheme(stored) ? stored : THEME_DEFAULTS[scope];

export const readStoredTheme = (scope: ThemeScope): ThemeId => {
  try {
    return resolveTheme(
      window.localStorage.getItem(THEME_STORAGE_KEYS[scope]),
      scope,
    );
  } catch {
    return THEME_DEFAULTS[scope];
  }
};

export const storeTheme = (scope: ThemeScope, theme: ThemeId) => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEYS[scope], theme);
  } catch {
    // Private browsing or full storage: the style still applies for this visit.
  }
};

/**
 * B's web fonts: Atkinson (projector.css, shared with Projector text) and
 * Literata (textbook.css). Each file downloads only the faces a page draws.
 */
export const TEXTBOOK_CSS_ID = 'textbook-fonts';
const fontLinks = (): Array<[id: string, href: string]> => [
  [PROJECTOR_CSS_ID, FONT_CSS.projector],
  [TEXTBOOK_CSS_ID, FONT_CSS.textbook],
];

export const loadThemeFonts = (theme: ThemeId) => {
  if (theme !== 'textbook') return;
  for (const [id, href] of fontLinks()) {
    if (document.getElementById(id)) continue;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.append(link);
  }
};

/**
 * Runs inline in <head> before first paint: the server renders the scope's
 * default on `<html data-theme>`, and this swaps in a stored choice and adds
 * B's font CSS, so neither the colours nor the type flash. Self-contained.
 */
export const themeBootScript = (scope: ThemeScope) =>
  `try{var r=document.documentElement,t=localStorage.getItem(${JSON.stringify(
    THEME_STORAGE_KEYS[scope],
  )});if(${JSON.stringify(THEME_IDS)}.indexOf(t)>=0)r.dataset.theme=t;if(r.dataset.theme==='textbook'){${JSON.stringify(
    fontLinks(),
  )}.forEach(function(f){if(document.getElementById(f[0]))return;var l=document.createElement('link');l.id=f[0];l.rel='stylesheet';l.href=f[1];document.head.appendChild(l)})}}catch(e){}`;

/**
 * Map display settings: the values, their validation, and persistence.
 * Ported from contexts/SettingsContext.tsx (same storage key and ranges, so a
 * returning visitor keeps their choices), plus the new "Projector text".
 */

export type TextSize = 'small' | 'medium' | 'large';
export type TextCase = 'regular' | 'upper';

export interface Settings {
  textSize: TextSize;
  textCase: TextCase;
  /** Fill opacity for territories, 0.1–1. */
  countryOpacity: number;
  /** Border width preference, 0–4. */
  borderThickness: number;
  showLabels: boolean;
  /**
   * Atkinson Hyperlegible Next for every UI string and map label, with larger
   * label sizes: for projectors and low vision (plan §2.1, item 3).
   */
  projectorText: boolean;
}

export const STORAGE_KEY = 'historic-borders-settings';

export const DEFAULT_SETTINGS: Settings = {
  textSize: 'medium',
  textCase: 'regular',
  countryOpacity: 0.7,
  borderThickness: 2,
  showLabels: true,
  projectorText: false,
};

const inRange = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && value >= min && value <= max;

/** Accepts only known, in-range values; anything else falls back to defaults. */
export const sanitizeSettings = (value: unknown): Settings => {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<
    string,
    unknown
  >;
  return {
    textSize: ['small', 'medium', 'large'].includes(raw.textSize as string)
      ? (raw.textSize as TextSize)
      : DEFAULT_SETTINGS.textSize,
    textCase: ['regular', 'upper'].includes(raw.textCase as string)
      ? (raw.textCase as TextCase)
      : DEFAULT_SETTINGS.textCase,
    countryOpacity: inRange(raw.countryOpacity, 0.1, 1)
      ? (raw.countryOpacity as number)
      : DEFAULT_SETTINGS.countryOpacity,
    borderThickness: inRange(raw.borderThickness, 0, 4)
      ? (raw.borderThickness as number)
      : DEFAULT_SETTINGS.borderThickness,
    showLabels:
      typeof raw.showLabels === 'boolean'
        ? raw.showLabels
        : DEFAULT_SETTINGS.showLabels,
    projectorText:
      typeof raw.projectorText === 'boolean'
        ? raw.projectorText
        : DEFAULT_SETTINGS.projectorText,
  };
};

export const readStoredSettings = (): Settings => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? sanitizeSettings(JSON.parse(stored)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const storeSettings = (settings: Settings) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing or full storage: settings still apply for this visit.
  }
};

/**
 * Runs inline in <head> before first paint so the projector font is applied
 * without a flash of the default font. Must stay self-contained.
 */
export const PROJECTOR_TEXT_BOOT = `try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)})||'{}');if(s&&s.projectorText===true)document.documentElement.dataset.text='projector'}catch(e){}`;

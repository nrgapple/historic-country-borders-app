/**
 * Inputs to the Classic-atlas style. `MapSettings` is structurally identical
 * to the app's `Settings` (`contexts/SettingsContext.tsx`), so the ported
 * Settings panel can pass its value straight through.
 */

export type TextSize = 'small' | 'medium' | 'large';
export type TextCase = 'regular' | 'upper';

export interface MapSettings {
  textSize: TextSize;
  textCase: TextCase;
  /** Fill opacity preference, 0.1–1. */
  countryOpacity: number;
  /** Border width preference, 0–4. */
  borderThickness: number;
  showLabels: boolean;
}

export const DEFAULT_SETTINGS: MapSettings = {
  textSize: 'medium',
  textCase: 'regular',
  countryOpacity: 0.7,
  borderThickness: 2,
  showLabels: true,
};

export interface Selection {
  /** Feature id in the year's borders source. */
  id: number;
  /** Territory name, as in the labels source's name attribute. */
  name: string;
}

export interface ClassicStyleOptions {
  settings: MapSettings;
  /** The selected territory, or null. */
  selected: Selection | null;
  /** Drop the decorations listed in `LOW_POWER_HIDDEN` (see `lowPower.ts`). */
  lowPower: boolean;
  /** "Projector text": Atkinson Hyperlegible Next, uppercase states, larger labels. */
  projectorText: boolean;
}

export const DEFAULT_OPTIONS: ClassicStyleOptions = {
  settings: DEFAULT_SETTINGS,
  selected: null,
  lowPower: false,
  projectorText: false,
};

export const withDefaults = (
  partial: Partial<ClassicStyleOptions> = {},
): ClassicStyleOptions => ({
  ...DEFAULT_OPTIONS,
  ...partial,
  settings: { ...DEFAULT_SETTINGS, ...partial.settings },
});

/**
 * The ported components used two React contexts (SettingsContext and
 * ChromeContext). Both now live in the single atlas store; these hooks keep
 * the old shapes so the components port with an import change only.
 */
import { actions, useAtlas, type Overlay } from './store';
import type { Settings } from './settings';

export type { Overlay };

export const useSettings = () => ({
  settings: useAtlas((s) => s.settings),
  theme: useAtlas((s) => s.theme),
  setTheme: actions.setTheme,
  updateSettings: actions.updateSettings as (
    changes: Partial<Settings>,
  ) => void,
  resetToDefaults: actions.resetSettings,
});

export const useChrome = () => ({
  focusMode: useAtlas((s) => s.focusMode),
  overlay: useAtlas((s) => s.overlay),
  toggleFocusMode: actions.toggleFocusMode,
  openOverlay: actions.openOverlay,
  closeOverlay: actions.closeOverlay,
});

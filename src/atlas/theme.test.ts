import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetStore, actions, getState } from './store';
import {
  readStoredTheme,
  resolveTheme,
  storeTheme,
  TEXTBOOK_CSS_ID,
  THEME_DEFAULTS,
  THEME_STORAGE_KEYS,
  themeBootScript,
} from './theme';
import { PROJECTOR_CSS_ID } from './settings';

const root = document.documentElement;
const resetDocument = () => {
  delete root.dataset.theme;
  delete root.dataset.text;
  document.getElementById(PROJECTOR_CSS_ID)?.remove();
  document.getElementById(TEXTBOOK_CSS_ID)?.remove();
};

describe('map style (theme) resolution', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDocument();
  });

  it('defaults the year pages to Classic and Pennsylvania to Modern textbook', () => {
    expect(THEME_DEFAULTS).toEqual({ atlas: 'classic', pa: 'textbook' });
    expect(readStoredTheme('atlas')).toBe('classic');
    expect(readStoredTheme('pa')).toBe('textbook');
  });

  it('accepts only known themes from storage', () => {
    expect(resolveTheme('textbook', 'atlas')).toBe('textbook');
    expect(resolveTheme('classic', 'pa')).toBe('classic');
    expect(resolveTheme('museum', 'atlas')).toBe('classic');
    expect(resolveTheme(null, 'pa')).toBe('textbook');
  });

  it('keeps each page family’s choice under its own key', () => {
    storeTheme('pa', 'classic');
    expect(window.localStorage.getItem(THEME_STORAGE_KEYS.pa)).toBe('classic');
    expect(readStoredTheme('pa')).toBe('classic');
    expect(readStoredTheme('atlas')).toBe('classic');
    storeTheme('atlas', 'textbook');
    expect(readStoredTheme('atlas')).toBe('textbook');
    expect(readStoredTheme('pa')).toBe('classic');
  });

  it('boot script applies a stored choice and B’s fonts before first paint', () => {
    window.localStorage.setItem(THEME_STORAGE_KEYS.atlas, 'textbook');
    root.dataset.theme = THEME_DEFAULTS.atlas;
    new Function(themeBootScript('atlas'))();
    expect(root.dataset.theme).toBe('textbook');
    expect(document.getElementById(TEXTBOOK_CSS_ID)).not.toBeNull();
    expect(document.getElementById(PROJECTOR_CSS_ID)).not.toBeNull();
  });

  it('boot script keeps the server default without a stored choice, and ignores junk', () => {
    root.dataset.theme = THEME_DEFAULTS.pa;
    new Function(themeBootScript('pa'))();
    expect(root.dataset.theme).toBe('textbook');
    resetDocument();
    window.localStorage.setItem(THEME_STORAGE_KEYS.atlas, '"><script>');
    root.dataset.theme = THEME_DEFAULTS.atlas;
    new Function(themeBootScript('atlas'))();
    expect(root.dataset.theme).toBe('classic');
    expect(document.getElementById(TEXTBOOK_CSS_ID)).toBeNull();
  });
});

describe('map style in the store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDocument();
    __resetStore();
    window.history.replaceState(null, '', '/year/1492');
  });
  afterEach(() => __resetStore());

  it('starts each page family in its stored or default theme', () => {
    actions.init(1492);
    expect(getState().theme).toBe('classic');
    expect(root.dataset.theme).toBe('classic');
    __resetStore();
    actions.init(2010, { themeScope: 'pa' });
    expect(getState().theme).toBe('textbook');
    expect(root.dataset.theme).toBe('textbook');
  });

  it('switching on the Pennsylvania page never changes the year pages', () => {
    actions.init(2010, { themeScope: 'pa' });
    actions.setTheme('classic');
    expect(getState().theme).toBe('classic');
    expect(readStoredTheme('pa')).toBe('classic');
    expect(window.localStorage.getItem(THEME_STORAGE_KEYS.atlas)).toBeNull();
    expect(readStoredTheme('atlas')).toBe('classic');
  });

  it('switching on a year page persists, and Reset restores the page default', () => {
    actions.init(1492);
    actions.setTheme('textbook');
    expect(root.dataset.theme).toBe('textbook');
    expect(readStoredTheme('atlas')).toBe('textbook');
    expect(readStoredTheme('pa')).toBe('textbook');
    expect(window.localStorage.getItem(THEME_STORAGE_KEYS.pa)).toBeNull();
    actions.resetSettings();
    expect(getState().theme).toBe('classic');
    expect(readStoredTheme('atlas')).toBe('classic');
  });

  it('keeps settings and selection when the theme changes', () => {
    window.history.replaceState(null, '', '/year/1492?place=Castile');
    actions.init(1492);
    actions.updateSettings({ textSize: 'large' });
    const settings = getState().settings;
    actions.setTheme('textbook');
    expect(getState().settings).toBe(settings);
    expect(getState().place).toBe('Castile');
  });
});

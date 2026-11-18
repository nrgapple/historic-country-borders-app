import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetStore, actions, getState, parseYearPath, subscribe } from './store';
import { STORAGE_KEY } from './settings';

const go = (url: string) => window.history.replaceState(null, '', url);
const back = async () => {
  const popped = new Promise((resolve) =>
    window.addEventListener('popstate', resolve, { once: true }),
  );
  window.history.back();
  await popped;
};

describe('atlas store and URL contract', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetStore();
    go('/year/1492');
  });
  afterEach(() => __resetStore());

  it('parses only published years from the path', () => {
    expect(parseYearPath('/year/1492')).toBe(1492);
    expect(parseYearPath('/year/-500')).toBe(-500);
    expect(parseYearPath('/year/1493')).toBeUndefined();
    expect(parseYearPath('/year/abc')).toBeUndefined();
    expect(parseYearPath('/')).toBeUndefined();
  });

  it('starts from the prerendered year and the shared place', () => {
    go('/year/1492?lng=30&lat=40&zoom=4&place=Ottoman%20Empire');
    actions.init(1492);
    expect(getState()).toMatchObject({
      year: 1492,
      place: 'Ottoman Empire',
      status: 'loading',
    });
    // The shared link is left untouched until the data proves the place exists.
    expect(window.location.search).toBe(
      '?lng=30&lat=40&zoom=4&place=Ottoman%20Empire',
    );
  });

  it('pushes a history entry per year and keeps the camera and place', () => {
    go('/year/1492?lng=10.0000&lat=45.0000&zoom=4.00&place=France');
    actions.init(1492);
    actions.setYear(1500, 'step');
    expect(window.location.pathname).toBe('/year/1500');
    expect(window.location.search).toBe(
      '?lng=10.0000&lat=45.0000&zoom=4.00&place=France',
    );
    expect(getState()).toMatchObject({ year: 1500, status: 'loading' });
  });

  it('steps back and forward through visited years', async () => {
    actions.init(1492);
    actions.setYear(1500);
    actions.setYear(1530);
    await back();
    expect(getState().year).toBe(1500);
    expect(window.location.pathname).toBe('/year/1500');
    await back();
    expect(getState().year).toBe(1492);
  });

  it('ignores unknown and unchanged years', () => {
    actions.init(1492);
    const length = window.history.length;
    actions.setYear(1492);
    actions.setYear(1493);
    expect(window.history.length).toBe(length);
    expect(getState().year).toBe(1492);
  });

  it('round-trips ?place= and removes it when cleared', () => {
    go('/year/1492?lng=1&lat=2&zoom=3');
    actions.init(1492);
    actions.select('Ottoman Empire');
    expect(new URLSearchParams(window.location.search).get('place')).toBe(
      'Ottoman Empire',
    );
    expect(window.location.search).toContain('lng=1');
    actions.select(null);
    expect(window.location.search).toBe('?lng=1&lat=2&zoom=3');
    expect(getState().place).toBeNull();
  });

  it('restores the place carried by a history entry', async () => {
    actions.init(1492);
    actions.select('Castile');
    actions.setYear(1500);
    actions.select(null);
    await back();
    expect(getState()).toMatchObject({ year: 1492, place: 'Castile' });
  });

  it('writes the camera without notifying React subscribers', () => {
    actions.init(1492);
    let notified = 0;
    subscribe(() => (notified += 1));
    actions.writeView({ longitude: 12.5, latitude: 41.9, zoom: 5 });
    expect(window.location.search).toBe('?lng=12.5000&lat=41.9000&zoom=5.00');
    expect(notified).toBe(0);
  });

  it('persists settings, including projector text, and validates them', () => {
    actions.init(1492);
    actions.updateSettings({ projectorText: true, countryOpacity: 5 });
    expect(getState().settings.projectorText).toBe(true);
    expect(getState().settings.countryOpacity).toBe(0.7);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toMatchObject(
      { projectorText: true },
    );
    expect(document.documentElement.dataset.text).toBe('projector');
    actions.resetSettings();
    expect(getState().settings.projectorText).toBe(false);
    expect(document.documentElement.dataset.text).toBeUndefined();
  });

  it('restores stored settings on start', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ textSize: 'large', projectorText: true }),
    );
    actions.init(1492);
    expect(getState().settings).toMatchObject({
      textSize: 'large',
      projectorText: true,
    });
  });

  it('sets the era accent on the document', () => {
    actions.init(1492);
    expect(document.documentElement.dataset.era).toBe('medieval');
    actions.setYear(1914);
    expect(document.documentElement.dataset.era).toBe('modern');
  });

  it('opens one overlay at a time and focus mode closes them', () => {
    actions.init(1492);
    actions.openOverlay('settings');
    actions.openOverlay('about');
    expect(getState().overlay).toBe('about');
    actions.openOverlay('about');
    expect(getState().overlay).toBeNull();
    actions.openOverlay('feedback');
    actions.toggleFocusMode();
    expect(getState()).toMatchObject({ focusMode: true, overlay: null });
  });

  it('numbers frame requests so the same place can be framed twice', () => {
    actions.init(1492);
    actions.frame([1, 2, 3, 4]);
    const first = getState().frame;
    actions.frame([1, 2, 3, 4]);
    expect(getState().frame?.id).toBe((first?.id ?? 0) + 1);
  });
});

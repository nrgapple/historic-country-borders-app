import { afterEach, describe, expect, it } from 'vitest';
import {
  formatMapView,
  hasMapView,
  mapViewSearch,
  parseMapView,
  WORLD_VIEW,
  writeMapView,
} from '../mapView';

describe('map view URL state', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('parses shared positions and clamps out-of-range values', () => {
    expect(parseMapView('?lng=12.5&lat=41.9&zoom=5')).toEqual({
      longitude: 12.5,
      latitude: 41.9,
      zoom: 5,
    });
    expect(parseMapView('?lng=999&lat=-99&zoom=40')).toEqual({
      longitude: 180,
      latitude: -85,
      zoom: 22,
    });
  });

  it('falls back for missing or malformed values', () => {
    expect(parseMapView('')).toEqual(WORLD_VIEW);
    expect(parseMapView('?lng=abc&lat=&zoom=2')).toEqual({
      ...WORLD_VIEW,
      zoom: 2,
    });
    expect(hasMapView('?lng=1&lat=2')).toBe(true);
    expect(hasMapView('?zoom=2')).toBe(false);
  });

  it('formats compact coordinates and preserves unrelated params', () => {
    expect(
      formatMapView({ longitude: 1.234567, latitude: -2, zoom: 3.14159 }),
    ).toEqual({ lng: '1.2346', lat: '-2.0000', zoom: '3.14' });
    expect(
      mapViewSearch('?ref=class', { longitude: 0, latitude: 0, zoom: 2 }),
    ).toBe('?ref=class&lng=0.0000&lat=0.0000&zoom=2.00');
  });

  it('writes the URL without dropping Next history state', () => {
    window.history.replaceState(
      { __N: true, as: '/year/1492' },
      '',
      '/year/1492',
    );
    writeMapView({ longitude: 10, latitude: 20, zoom: 3 });
    expect(window.location.pathname).toBe('/year/1492');
    expect(window.location.search).toBe('?lng=10.0000&lat=20.0000&zoom=3.00');
    expect(window.history.state).toEqual({
      __N: true,
      as: '/year/1492?lng=10.0000&lat=20.0000&zoom=3.00',
    });
  });
});

import { describe, expect, it } from 'vitest';
import type { Feature } from 'geojson';
import {
  featureBounds,
  featuresNamed,
  focusPadding,
  MAX_RESULTS,
  normalizeSearchText,
  paddingOffset,
  PlaceOption,
  placeOptionsFromFeatures,
  searchPlaces,
} from '../places';

const option = (label: string, keywords: string[] = []): PlaceOption => ({
  name: label,
  label,
  keywords,
});

const square = (name: string, west: number, south: number, size = 1) =>
  ({
    type: 'Feature',
    properties: { NAME: name },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [west, south],
          [west + size, south],
          [west + size, south + size],
          [west, south + size],
          [west, south],
        ],
      ],
    },
  }) as Feature;

describe('place search', () => {
  it('ignores case, diacritics, and extra spaces', () => {
    expect(normalizeSearchText('  Kraków  Voivodeship ')).toBe(
      'krakow voivodeship',
    );
    expect(searchPlaces([option('Kraków')], 'KRAKOW')).toHaveLength(1);
    expect(searchPlaces([option('Ilkhanate')], 'İlk')).toHaveLength(1);
  });

  it('ranks prefixes, then word prefixes, then substrings', () => {
    const options = [
      option('Holy Roman Empire'),
      option('Byzantine Empire'),
      option('Romania'),
      option('Aromanians'),
      option('Rome'),
    ];
    expect(searchPlaces(options, 'rom').map((o) => o.label)).toEqual([
      'Romania',
      'Rome',
      'Holy Roman Empire',
      'Aromanians',
    ]);
  });

  it('matches keywords below labels', () => {
    const options = [
      option('Northampton Area School District', ['Northampton County']),
      option('Pen Argyl Area School District', ['Northampton County']),
      option('Bangor Area School District', ['Northampton County']),
      option('Abington School District', ['Montgomery County']),
    ];
    expect(searchPlaces(options, 'northampton').map((o) => o.label)).toEqual([
      'Northampton Area School District',
      'Bangor Area School District',
      'Pen Argyl Area School District',
    ]);
  });

  it(`shows at most ${MAX_RESULTS} results and nothing for blank input`, () => {
    const options = Array.from({ length: 20 }, (_, i) => option(`Place ${i}`));
    expect(searchPlaces(options, 'place')).toHaveLength(MAX_RESULTS);
    expect(searchPlaces(options, '   ')).toEqual([]);
  });

  it('builds one option per distinct name', () => {
    const features = [
      square('Steppe Hunters', 0, 0),
      square('Steppe Hunters', 5, 5),
      square('Fixture Country', 0, 0),
      { ...square('', 0, 0), properties: {} } as Feature,
    ];
    const options = placeOptionsFromFeatures(features, {
      detail: (properties) => `Detail for ${properties.NAME}`,
    });
    expect(options.map((o) => o.name)).toEqual([
      'Steppe Hunters',
      'Fixture Country',
    ]);
    expect(options[0].detail).toBe('Detail for Steppe Hunters');
    expect(featuresNamed(features, 'Steppe Hunters')).toHaveLength(2);
  });
});

describe('feature bounds', () => {
  it('unions every part of a territory', () => {
    expect(featureBounds([square('A', 0, 0), square('A', 5, -3, 2)])).toEqual([
      [0, -3],
      [7, 1],
    ]);
    expect(featureBounds([])).toBeUndefined();
  });

  it('frames the short way across the antimeridian', () => {
    expect(
      featureBounds([square('Russia', 170, 60, 9), square('Russia', -179, 60)]),
    ).toEqual([
      [170, 60],
      [182, 69],
    ]);
  });

  it('keeps the place clear of the panel and top bar', () => {
    expect(
      focusPadding({ width: 1280, height: 720, topbarBottom: 120 }),
    ).toEqual({ top: 144, right: 72, bottom: 56, left: 424 });
    const phone = focusPadding({ width: 390, height: 800, topbarBottom: 110 });
    expect(phone.left).toBe(24);
    expect(phone.bottom).toBeGreaterThan(400);
    // Never leaves less than a sliver of map to frame into.
    const tiny = focusPadding({ width: 300, height: 200, topbarBottom: 150 });
    expect(tiny.left + tiny.right).toBeLessThanOrEqual(220);
    expect(tiny.top + tiny.bottom).toBeLessThanOrEqual(120);
  });

  it('offsets the camera toward the open part of the map', () => {
    expect(
      paddingOffset({ top: 144, right: 72, bottom: 56, left: 424 }),
    ).toEqual([176, 44]);
  });
});

import { describe, expect, it } from 'vitest';
import historicalManifest from '../../data/historical-manifest.json';
import {
  eraOf,
  eraSpans,
  formatYear,
  formatYearLong,
  parseYearParam,
  yearParts,
  yearPath,
} from '../years';

describe('year formatting', () => {
  it('formats BC and AD years compactly and unambiguously', () => {
    expect(formatYear(1492)).toBe('1492');
    expect(formatYear(-500)).toBe('500 BC');
    expect(formatYear(-123000)).toBe('123,000 BC');
    expect(formatYearLong(1492)).toBe('1492 AD');
    expect(formatYearLong(-1)).toBe('1 BC');
    expect(yearParts(-10000)).toEqual({ value: '10,000', suffix: 'BC' });
    expect(yearPath(-323)).toBe('/year/-323');
  });

  it('parses only known integer year params', () => {
    const years = [-500, 1492];
    expect(parseYearParam('1492', years)).toBe(1492);
    expect(parseYearParam(['-500'], years)).toBe(-500);
    expect(parseYearParam('1493', years)).toBeUndefined();
    expect(parseYearParam('14.92', years)).toBeUndefined();
    expect(parseYearParam('bc500', years)).toBeUndefined();
    expect(parseYearParam(undefined, years)).toBeUndefined();
  });
});

describe('eras', () => {
  it('assigns conventional eras', () => {
    expect(eraOf(-10000).id).toBe('prehistory');
    expect(eraOf(-3000).id).toBe('ancient');
    expect(eraOf(499).id).toBe('ancient');
    expect(eraOf(1492).id).toBe('medieval');
    expect(eraOf(1500).id).toBe('early-modern');
    expect(eraOf(2010).id).toBe('modern');
  });

  it('groups the published years into contiguous spans covering every year', () => {
    const spans = eraSpans(historicalManifest.years);
    expect(spans.map((span) => span.era.id)).toEqual([
      'prehistory',
      'ancient',
      'medieval',
      'early-modern',
      'modern',
    ]);
    expect(spans.reduce((total, span) => total + span.count, 0)).toBe(
      historicalManifest.years.length,
    );
    spans.slice(1).forEach((span, index) => {
      expect(span.start).toBe(spans[index].start + spans[index].count);
    });
  });
});

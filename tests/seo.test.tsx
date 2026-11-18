import { describe, expect, it } from 'vitest';
import historicalManifest from '../data/historical-manifest.json';
import {
  generateCanonicalUrl,
  generatePageTitle,
  SEO_CONFIG,
  yearPageDescription,
  yearPageTitle,
} from '../config/seo';

describe('SEO configuration', () => {
  it('describes the real published range', () => {
    expect(SEO_CONFIG.siteName).toBe('Historic Borders');
    expect(SEO_CONFIG.siteUrl).toBe('https://historicborders.app');
    expect(SEO_CONFIG.defaultDescription).toContain('123,000 BC');
    const last = historicalManifest.years[historicalManifest.years.length - 1];
    expect(SEO_CONFIG.defaultDescription).toContain(`${last} AD`);
  });

  it('builds titles and descriptions for year pages', () => {
    expect(generatePageTitle()).toBe(SEO_CONFIG.defaultTitle);
    expect(generatePageTitle(yearPageTitle(-500))).toBe(
      'World borders in 500 BC · Historic Borders',
    );
    const description = yearPageDescription(1492);
    expect(description).toContain('1492 AD');
    expect(description).not.toMatch(/years ago/);
    expect(description.split('1492 AD')).toHaveLength(2);
  });

  it('builds canonical URLs without query strings or trailing slashes', () => {
    expect(generateCanonicalUrl()).toBe('https://historicborders.app');
    expect(generateCanonicalUrl('/')).toBe('https://historicborders.app');
    expect(generateCanonicalUrl('/year/1500/')).toBe(
      'https://historicborders.app/year/1500',
    );
    expect(generateCanonicalUrl('year/-100?lng=1&lat=2')).toBe(
      'https://historicborders.app/year/-100',
    );
  });
});

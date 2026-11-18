import historicalManifest from '../data/historical-manifest.json';
import { formatYearLong } from '../lib/years';

const years = historicalManifest.years;
const firstYear = formatYearLong(years[0]);
const lastYear = formatYearLong(years[years.length - 1]);

export const SEO_CONFIG = {
  siteName: 'Historic Borders',
  siteUrl: 'https://historicborders.app',
  defaultTitle: 'Historic Borders — an interactive atlas of world history',
  defaultDescription: `Explore how the world’s political borders changed from ${firstYear} to ${lastYear} on an interactive historical map.`,
  defaultOgImage: 'https://historicborders.app/og-image.png',
  themeColor: '#F6F3EC',
  language: 'en',
  locale: 'en_US',
  author: 'Historic Borders',
};

export const generatePageTitle = (title?: string) =>
  title ? `${title} · ${SEO_CONFIG.siteName}` : SEO_CONFIG.defaultTitle;

export const generateCanonicalUrl = (path?: string) => {
  const clean = (path ?? '').split(/[?#]/)[0].replace(/^\/?/, '/');
  return clean === '/'
    ? SEO_CONFIG.siteUrl
    : `${SEO_CONFIG.siteUrl}${clean.replace(/\/$/, '')}`;
};

export const yearPageTitle = (year: number) =>
  `World borders in ${formatYearLong(year)}`;

export const yearPageDescription = (year: number) =>
  `Interactive map of political borders around ${formatYearLong(year)}: empires, kingdoms, and territories as reconstructed by the historical-basemaps project. Move through ${years.length} snapshots from ${firstYear} to ${lastYear}.`;

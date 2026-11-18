import historicalManifest from '@repo/data/historical-manifest.json';
import { formatYearLong } from './years';

const years = historicalManifest.years;
const firstYear = formatYearLong(years[0]);
const lastYear = formatYearLong(years[years.length - 1]);

export const SEO_CONFIG = {
  siteName: 'Historic Borders',
  siteUrl: 'https://historicborders.app',
  defaultTitle: 'Historic Borders — an interactive atlas of world history',
  defaultDescription: `Explore how the world’s political borders changed from ${firstYear} to ${lastYear} on an interactive historical map.`,
  defaultOgImage: 'https://historicborders.app/og-image.png',
  themeColor: '#F1E9D6',
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

export const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: SEO_CONFIG.siteName,
  url: SEO_CONFIG.siteUrl,
  description: SEO_CONFIG.defaultDescription,
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Any',
  browserRequirements: 'Requires JavaScript and WebGL 2',
  isAccessibleForFree: true,
  inLanguage: SEO_CONFIG.language,
};

/** The sitemap, identical in shape to scripts/generate-sitemap.js. */
export const sitemapXml = (
  paths: Array<{ path: string; priority: string }>,
) => {
  const lastModified = historicalManifest.source.commitDate;
  const entries = paths
    .map(
      ({ path, priority }) => `  <url>
    <loc>${SEO_CONFIG.siteUrl}${path}</loc>
    <lastmod>${lastModified}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
};

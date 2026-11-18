import type { APIRoute } from 'astro';
import historicalManifest from '@repo/data/historical-manifest.json';
import { sitemapXml } from '../lib/seo';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(
    sitemapXml([
      { path: '/', priority: '1.0' },
      // The Astro PA page (P5).
      { path: '/pa/school-districts', priority: '0.8' },
      ...historicalManifest.years.map((year) => ({
        path: `/year/${year}`,
        priority: '0.8',
      })),
    ]),
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );

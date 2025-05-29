import { GetServerSideProps } from 'next';
import { Octokit } from '@octokit/core';
import { throttling } from '@octokit/plugin-throttling';
import { getYearFromFile, githubToken } from '../util/constants';
import { Endpoints } from '@octokit/types';

const OctokitThrottled = Octokit.plugin(throttling);

function generateSiteMap(years: number[]) {
  const baseUrl = 'https://historicborders.app';
  
  return `<?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
     <!-- Homepage -->
     <url>
       <loc>${baseUrl}</loc>
       <lastmod>${new Date().toISOString()}</lastmod>
       <changefreq>daily</changefreq>
       <priority>1.0</priority>
     </url>
     
     <!-- Year pages -->
     ${years
       .map((year) => {
         return `
       <url>
           <loc>${baseUrl}/year/${year}</loc>
           <lastmod>${new Date().toISOString()}</lastmod>
           <changefreq>weekly</changefreq>
           <priority>0.8</priority>
       </url>`;
       })
       .join('')}
   </urlset>
 `;
}

function SiteMap() {
  // getServerSideProps will do the heavy lifting
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  try {
    // Fetch years data (similar to what's done in index.tsx)
    const octokit = new OctokitThrottled({
      auth: githubToken,
      throttle: {
        onRateLimit: (retryAfter: number, options: any) => {
          console.warn(
            `Request quota exhausted for request ${options.method} ${options.url}`,
          );
          if (options.request.retryCount === 0) {
            console.log(`Retrying after ${retryAfter} seconds!`);
            return true;
          }
        },
        onSecondaryRateLimit: (retryAfter: number, options: any) => {
          console.warn(
            `SecondaryRateLimit detected for request ${options.method} ${options.url}`,
          );
        },
      },
    });

    const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: 'aourednik',
      repo: 'historical-basemaps',
      path: 'geojson',
    });

    const files = data as Endpoints['GET /repos/{owner}/{repo}/contents/{path}']['response']['data'];
    
    if (!Array.isArray(files)) {
      throw new Error('Invalid response format');
    }

    const years = files
      .map((f: any) => getYearFromFile(f.name))
      .filter((year): year is number => year !== null && !isNaN(year) && isFinite(year))
      .sort((a, b) => a - b);

    console.log(`Generated sitemap with ${years.length} year pages`);

    // Generate the XML sitemap
    const sitemap = generateSiteMap(years);

    res.setHeader('Content-Type', 'text/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate');
    res.write(sitemap);
    res.end();

    return {
      props: {},
    };
  } catch (error) {
    console.error('Error generating sitemap:', error);
    
    // Generate a basic sitemap with just the homepage if there's an error
    const basicSitemap = generateSiteMap([]);
    
    res.setHeader('Content-Type', 'text/xml');
    res.write(basicSitemap);
    res.end();

    return {
      props: {},
    };
  }
};

export default SiteMap; 
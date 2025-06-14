import { MetadataRoute } from 'next';
import { Octokit } from '@octokit/core';
import { throttling } from '@octokit/plugin-throttling';
import { getYearFromFile, githubToken } from '../util/constants';
import { Endpoints } from '@octokit/types';

const OctokitThrottled = Octokit.plugin(throttling);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://historicborders.app';
  
  try {
    // Fetch years data
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

    const now = new Date();
    
    // Generate sitemap entries
    const sitemap: MetadataRoute.Sitemap = [
      // Homepage
      {
        url: baseUrl,
        lastModified: now,
        changeFrequency: 'daily',
        priority: 1.0,
      },
      // Year pages
      ...years.map((year) => ({
        url: `${baseUrl}/year/${year}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
    ];

    return sitemap;
  } catch (error) {
    console.error('Error generating sitemap:', error);
    
    // Return basic sitemap with just the homepage if there's an error
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1.0,
      },
    ];
  }
} 
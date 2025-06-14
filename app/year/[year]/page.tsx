import { Octokit } from '@octokit/core';
import { throttling } from '@octokit/plugin-throttling';
import { getYearFromFile, githubToken } from '../../../util/constants';
import { ConfigType, GithubFileInfoType } from '../../../util/types';
import { Endpoints } from '@octokit/types';
import Viewer from '../../../components/Viewer';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

const OctokitThrottled = Octokit.plugin(throttling);

export interface DataProps {
  years: number[];
  user: string;
  id: string;
  config: ConfigType;
  currentYear: string;
}

type GetGithubFilesResp =
  Endpoints['GET /repos/{owner}/{repo}/contents/{path}']['response'];

type GetBranchResp =
  Endpoints['GET /repos/{owner}/{repo}/branches/{branch}']['response'];

const octokit = new OctokitThrottled({
  auth: githubToken,
  throttle: {
    onRateLimit: (retryAfter: any, options: any, octokit: any) => {
      console.warn(
        `Request quota exhausted for request ${options.method} ${options.url}`,
      );

      if (options.request.retryCount === 0) {
        // only retries once
        console.info(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
    },
    onSecondaryRateLimit: (retryAfter: any, options: any, octokit: any) => {
      // does not retry, only logs a warning
      console.warn(
        `SecondaryRateLimit detected for request ${options.method} ${options.url}`,
      );
    },
  },
});

// Generate metadata for each year page
export async function generateMetadata(props: {
  params: Promise<{ year: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const year = params.year;
  
  const title = `Historic Country Borders - Year ${year}`;
  const description = `Explore how country borders looked in the year ${year}. Interactive historical map showing political boundaries and territories as they existed ${year < '0' ? Math.abs(parseInt(year)) + ' BC' : year + ' AD'}.`;
  const url = `https://historicborders.app/year/${year}`;
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'Historic Country Borders',
      images: [
        {
          url: 'https://historicborders.app/og-image.png',
          width: 1200,
          height: 630,
          alt: `Historic borders visualization for year ${year}`,
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['https://historicborders.app/og-image.png'],
      creator: '@historicborders',
    },
    alternates: {
      canonical: url,
    },
    robots: {
      index: true,
      follow: true,
    },
    keywords: [
      'historic borders',
      'historical maps',
      'country boundaries',
      'political geography',
      'historical visualization',
      'timeline',
      'cartography',
      year.toString(),
    ],
  };
}

async function getYearData(currentYear: string): Promise<DataProps> {
  const user = 'aourednik';
  const repo = 'historical-basemaps';
  
  try {
    const fileResp = (await octokit.request(
      `/repos/${user}/${repo}/contents/geojson`,
    )) as GetGithubFilesResp;
    const { data: branch } = (await octokit.request(
      `/repos/${user}/${repo}/branches/master`,
    )) as GetBranchResp;
    const config: ConfigType = {
      name: 'Historic Borders',
      description: 'example.',
      commitDate: branch.commit.commit.committer?.date,
    };
    const files = fileResp.data as GithubFileInfoType[];
    const years = files
      .filter((x) => x.name.endsWith('.geojson'))
      .map((x) => getYearFromFile(x.name))
      .sort((a, b) => a - b)
      .filter((x) => !isNaN(x));

    // Validate that the requested year exists
    if (!years.includes(parseInt(currentYear))) {
      notFound();
    }

    return {
      years,
      user: user,
      id: repo,
      config,
      currentYear,
    } as DataProps;
  } catch (e) {
    console.error(e);
    return {
      years: [-500],
      user,
      id: repo,
      config: {
        name: 'Error',
      },
      currentYear,
    } as DataProps;
  }
}

// Next.js 15 App Router with async params
export default async function YearPage(props: {
  params: Promise<{ year: string }>;
}) {
  const params = await props.params;
  const currentYear = params.year;
  
  const data = await getYearData(currentYear);
  
  return <Viewer {...data} />;
}

// Generate static params for known years
export async function generateStaticParams() {
  const user = 'aourednik';
  const repo = 'historical-basemaps';
  
  try {
    const fileResp = (await octokit.request(
      `/repos/${user}/${repo}/contents/geojson`,
    )) as GetGithubFilesResp;
    
    const files = fileResp.data as GithubFileInfoType[];
    const years = files
      .filter((x) => x.name.endsWith('.geojson'))
      .map((x) => getYearFromFile(x.name))
      .sort((a, b) => a - b)
      .filter((x) => !isNaN(x));

    return years.map((year) => ({
      year: year.toString(),
    }));
  } catch (e) {
    console.error(e);
    return [];
  }
} 
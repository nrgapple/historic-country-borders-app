import { Octokit } from '@octokit/core';
import { throttling } from '@octokit/plugin-throttling';
import { GetStaticProps } from 'next';
import { getYearFromFile, githubToken } from '../util/constants';
import { ConfigType, GithubFileInfoType } from '../util/types';
import { Endpoints } from '@octokit/types';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const OctokitThrottled = Octokit.plugin(throttling);

export interface DataProps {
  years: number[];
  user: string;
  id: string;
  config: ConfigType;
}

// Helper function to get a random year from the available years
const getRandomYear = (years: number[]): string => {
  if (!years || years.length === 0) return '';
  const randomIndex = Math.floor(Math.random() * years.length);
  return years[randomIndex].toString();
};

const IndexPage = ({ years }: DataProps) => {
  const router = useRouter();

  useEffect(() => {
    // Redirect to a random year when accessing the root
    if (years && years.length > 0 && router.isReady) {
      const randomYear = getRandomYear(years);
      router.replace(`/year/${randomYear}`);
    }
  }, [years, router]);

  // Show loading state while redirecting
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      fontFamily: "'Times New Roman', serif",
      fontSize: '18px',
      color: '#654321'
    }}>
      Loading historic borders...
    </div>
  );
};

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

export const getStaticProps: GetStaticProps<DataProps> = async () => {
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
    return {
      props: {
        years,
        user: user,
        id: repo,
        config,
      } as DataProps,
      revalidate: 86400, // Revalidate once per day (24 hours)
    };
  } catch (e) {
    console.error(e);
  }
  return {
    props: {
      years: [-500],
      user,
      id: repo,
      config: {
        name: 'Error',
      },
    } as DataProps,
    revalidate: 86400, // Revalidate once per day (24 hours)
  };
};

export default IndexPage;

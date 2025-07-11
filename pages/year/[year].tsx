import { Octokit } from '@octokit/core';
import { throttling } from '@octokit/plugin-throttling';
import { GetStaticProps, GetStaticPaths } from 'next';
import { getYearFromFile, githubToken } from '../../util/constants';
import { ConfigType, GithubFileInfoType } from '../../util/types';
import { Endpoints } from '@octokit/types';
import Viewer from '../../components/Viewer';

const OctokitThrottled = Octokit.plugin(throttling);

export interface DataProps {
  years: number[];
  user: string;
  id: string;
  config: ConfigType;
  currentYear: string;
}

const YearPage = (props: DataProps) => {
  return <Viewer {...props} />;
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

export const getStaticPaths: GetStaticPaths = async () => {
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

    const paths = years.map((year) => ({
      params: { year: year.toString() },
    }));

    return {
      paths,
      fallback: 'blocking', // Generate pages on-demand for unknown years
    };
  } catch (e) {
    console.error(e);
    return {
      paths: [],
      fallback: 'blocking',
    };
  }
};

export const getStaticProps: GetStaticProps<DataProps> = async ({ params }) => {
  const user = 'aourednik';
  const repo = 'historical-basemaps';
  const currentYear = params?.year as string;
  
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
      return {
        notFound: true,
      };
    }

    return {
      props: {
        years,
        user: user,
        id: repo,
        config,
        currentYear,
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
      currentYear,
    } as DataProps,
    revalidate: 86400, // Revalidate once per day (24 hours)
  };
};

export default YearPage; 
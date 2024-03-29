import { Octokit } from '@octokit/core';
import { throttling } from '@octokit/plugin-throttling';
import { GetServerSideProps } from 'next';
import { getYearFromFile, githubToken } from '../util/constants';
import { ConfigType, GithubFileInfoType } from '../util/types';
import { Endpoints } from '@octokit/types';
import Viewer from '../components/Viewer';

const OctokitThrottled = Octokit.plugin(throttling);
export interface DataProps {
  years: number[];
  user: string;
  id: string;
  config: ConfigType;
}

const IndexPage = (props: DataProps) => {
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

export const getServerSideProps: GetServerSideProps<DataProps> = async ({
  query,
}) => {
  const { user: customUser, repo: customRepo } =
    (query as { user: string; repo: string }) ?? {};
  const user = customUser ?? 'aourednik';
  const repo = customRepo ?? 'historical-basemaps';
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
  };
};

export default IndexPage;

import { Octokit } from '@octokit/core';
import { GetServerSideProps } from 'next';
import { getYearFromFile, githubToken } from '../util/constants';
import { ConfigType, GithubFileInfoType } from '../util/types';
import Viewer from './timeline/[user]/[id]';
import { Endpoints } from '@octokit/types';

export interface DataProps {
  years: number[];
  user: string;
  id: string;
  config: ConfigType;
  isGlobe: boolean;
}

const IndexPage = (props: DataProps) => {
  return <Viewer {...props} />;
};

type GetGithubFilesResp =
  Endpoints['GET /repos/{owner}/{repo}/contents/{path}']['response'];

type GetBranchResp =
  Endpoints['GET /repos/{owner}/{repo}/branches/{branch}']['response'];

export const getServerSideProps: GetServerSideProps<DataProps> = async ({
  query,
}) => {
  const user = 'aourednik';
  const id = 'historical-basemaps';
  const isGlobe = query?.view === 'globe' ? true : false;
  try {
    const octokit = new Octokit({ auth: githubToken });
    const fileResp = (await octokit.request(
      `/repos/${user}/${id}/contents/geojson`,
    )) as GetGithubFilesResp;
    const { data: branch } = (await octokit.request(
      `/repos/${user}/${id}/branches/master`,
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
        id: id,
        config,
        isGlobe,
      } as DataProps,
    };
  } catch (e) {
    console.log(e);
  }
  return {
    props: {
      isGlobe,
    } as DataProps,
  };
};

export default IndexPage;

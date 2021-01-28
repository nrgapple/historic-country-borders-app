import { Octokit } from '@octokit/core';
import { GetServerSideProps } from 'next';
import { getYearFromFile } from '../util/constants';
import { ConfigType, GithubFileInfoType } from '../util/types';
import Viewer from './timeline/[user]/[id]';

interface DataProps {
  years: number[];
  user: string;
  id: string;
  config: ConfigType;
}

const IndexPage = ({ years, user, id, config }: DataProps) => {
  return <Viewer user={user} id={id} config={config} years={years} />;
};

export const getServerSideProps: GetServerSideProps<DataProps> = async () => {
  const user = 'nrgapple';
  const id = 'timeline-example';
  try {
    const octokit = new Octokit();
    const configRes = await fetch(
      `https://raw.githubusercontent.com/${user}/historicborders-${id}/main/config.json`,
    );
    const config: ConfigType = await configRes.json();
    const fileResp = await octokit.request(
      `/repos/${user}/historicborders-${id}/contents/years`,
    );
    const files: GithubFileInfoType[] = fileResp.data;
    const years = files
      .map((x) => getYearFromFile(x.name))
      .sort((a, b) => a - b);
    return {
      props: {
        years,
        user: user,
        id: id,
        config,
      } as DataProps,
    };
  } catch (e) {
    console.log(e);
  }
  return {
    props: {} as DataProps,
  };
};

export default IndexPage;

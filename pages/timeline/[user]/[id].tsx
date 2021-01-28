import MapContainer from '../../../components/ViewerMap';
import React, { useEffect, useState } from 'react';
import ReactGA from 'react-ga';
import {
  convertYearString,
  getYearFromFile,
  mapBCFormat,
  mod,
} from '../../../util/constants';
import Footer from '../../../components/Footer';
import NavBar from '../../../components/NavBar';
import Timeline from '../../../components/Timeline';
import ReactTooltip from 'react-tooltip';
import useKeyPress from '../../../hooks/useKeyPress';
import { GetServerSideProps } from 'next';
import { Octokit } from '@octokit/core';
import { ConfigType, GithubFileInfoType } from '../../../util/types';
import Layout from '../../../components/Layout';

ReactGA.initialize('UA-188190791-1');

interface DataProps {
  years: number[];
  user: string;
  id: string;
  config: ConfigType;
}

const Viewer = ({ years, user, id, config }: DataProps) => {
  const [index, setIndex] = useState(0);
  const [hide, setHide] = useState(false);
  const [help, setHelp] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isMobile =
    typeof window !== 'undefined'
      ? /Mobi|Android/i.test(navigator.userAgent)
      : false;
  const aPress = useKeyPress('a');
  const dPress = useKeyPress('d');

  useEffect(() => {
    if ([user, id].some((x) => !x)) {
      ReactGA.pageview(`/no-data`);
    } else {
      ReactGA.pageview(`/timeline/${user}/${id}`);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (dPress) {
      setIndex(mod(index + 1, years.length));
    }
  }, [dPress]);

  useEffect(() => {
    if (aPress) {
      setIndex(mod(index - 1, years.length));
    }
  }, [aPress]);

  if ([years, user, id, config].some((x) => !x))
    return <div>Not a valid timeline. Check your url.</div>;

  return (
    <>
      <Layout
        title={config.name}
        url={`https://historyborders.app/timeline/${user}/${id}`}
        description={config.description}
      >
        {mounted && (
          <ReactTooltip
            resizeHide={false}
            id="fullscreenTip"
            place="left"
            effect="solid"
            globalEventOff={isMobile ? 'click' : undefined}
          >
            {hide ? 'Show Timeline' : 'Hide Timeline'}
          </ReactTooltip>
        )}
        <div
          data-tip
          data-for="fullscreenTip"
          data-delay-show="300"
          className="fullscreen"
          onClick={() => setHide(!hide)}
          style={{ top: hide ? '16px' : '165px' }}
        >
          <div className="noselect">🔭</div>
        </div>
        <div className={`${hide ? 'app-large' : 'app'}`}>
          {!hide && (
            <>
              <NavBar
                onHelp={() => setHelp(!help)}
                showHelp={help}
                title={config.name}
              />
              <Timeline index={index} onChange={setIndex} years={years} />
            </>
          )}
          <MapContainer
            year={convertYearString(mapBCFormat, years[index])}
            fullscreen={hide}
            user={user}
            id={id}
          />
          {!hide && (
            <Footer
              dataUrl={`https://github.com/${user}/historicborders-${id}`}
            />
          )}
        </div>
      </Layout>
    </>
  );
};

export default Viewer;

export const getServerSideProps: GetServerSideProps<DataProps> = async (
  context,
) => {
  if (context.params && context.params.user && context.params.id) {
    try {
      const octokit = new Octokit();
      const configRes = await fetch(
        `https://raw.githubusercontent.com/${context.params.user}/historicborders-${context.params.id}/main/config.json`,
      );
      const config: ConfigType = await configRes.json();
      const fileResp = await octokit.request(
        `/repos/${context.params.user}/historicborders-${context.params.id}/contents/years`,
      );
      const files: GithubFileInfoType[] = fileResp.data;
      const years = files
        .map((x) => getYearFromFile(x.name))
        .sort((a, b) => a - b);
      return {
        props: {
          years,
          user: context.params.user,
          id: context.params.id,
          config,
        } as DataProps,
      };
      // }
    } catch (e) {
      console.log(e);
    }
  }
  return {
    props: {} as DataProps,
  };
};

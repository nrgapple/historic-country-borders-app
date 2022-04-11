import MapContainer from '../../../components/ViewerMap';
import React, { useEffect, useMemo, useState } from 'react';
import ReactGA from 'react-ga';
import {
  convertYearString,
  getYearFromFile,
  githubToken,
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
import { useRouter } from 'next/router';
import { DataProps } from '../..';

ReactGA.initialize('UA-188190791-1');

const Viewer = ({
  years,
  user,
  id,
  config,
  isGlobe: isGlobeProp,
}: DataProps) => {
  const [hide, setHide] = useState(false);
  const [help, setHelp] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isMobile =
    typeof window !== 'undefined'
      ? /Mobi|Android/i.test(navigator.userAgent)
      : false;
  const aPress = useKeyPress('a');
  const dPress = useKeyPress('d');
  const router = useRouter();
  const { query } = router;
  const index = useMemo(() => {
    const i = years.findIndex((y) => y.toString() === query?.year);
    return i === -1 ? 0 : i;
  }, [years, query]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (dPress) {
      router.push({
        query: {
          year: years[mod(index + 1, years.length)],
        },
      });
    }
  }, [dPress]);

  useEffect(() => {
    if (aPress) {
      router.push({
        query: {
          year: years[mod(index - 1, years.length)],
        },
      });
    }
  }, [aPress]);

  useEffect(() => {
    ReactGA.pageview(`/?year=${query?.year}`);
  }, []);

  if (!(years && user && id && config))
    return <div>Not a valid timeline. Check your url.</div>;

  return (
    <>
      <Layout title={config.name} url={`https://historyborders.app`}>
        {mounted && (
          <>
            <ReactTooltip
              resizeHide={false}
              id="fullscreenTip"
              place="left"
              effect="solid"
              globalEventOff={isMobile ? 'click' : undefined}
            >
              {hide ? 'Show Timeline' : 'Hide Timeline'}
            </ReactTooltip>
          </>
        )}
        <div
          data-tip
          data-for="fullscreenTip"
          data-delay-show="300"
          className="fullscreen"
          onClick={() => setHide(!hide)}
          style={{ top: hide ? '16px' : '95px' }}
        >
          <div className="noselect">🔭</div>
        </div>
        <div className={`${hide ? 'app-large' : 'app'}`}>
          {!hide && (
            <>
              <div className="timeline-container">
                <Timeline
                  globe={false}
                  index={index}
                  onChange={(v) =>
                    router.push({
                      query: {
                        year: years[v],
                      },
                    })
                  }
                  years={years}
                />
              </div>
            </>
          )}
          <MapContainer
            year={convertYearString(mapBCFormat, years[index])}
            fullscreen={hide}
            user={user}
            id={id}
            threeD={false}
          />
          {!hide && (
            <Footer
              dataUrl={`https://github.com/aourednik/historical-basemaps`}
              lastCommit={
                config.commitDate ? new Date(config.commitDate) : undefined
              }
            />
          )}
        </div>
      </Layout>
    </>
  );
};

export default Viewer;

export const getServerSideProps: GetServerSideProps<DataProps> = async ({
  query,
  params,
}) => {
  const isGlobe = query?.view === 'globe' ? true : false;
  if (params && params.user && params.id) {
    try {
      const octokit = new Octokit({ auth: githubToken });
      const configRes = await fetch(
        `https://raw.githubusercontent.com/${params.user}/historicborders-${params.id}/main/config.json`,
      );
      var config: ConfigType = await configRes.json();
      config.default = false;
      const fileResp = await octokit.request(
        `/repos/${params.user}/historicborders-${params.id}/contents/years`,
      );
      const files: GithubFileInfoType[] = fileResp.data;
      const years = files
        .map((x) => getYearFromFile(x.name))
        .sort((a, b) => a - b);
      return {
        props: {
          years,
          user: params.user,
          id: params.id,
          config,
          isGlobe,
        } as DataProps,
      };
    } catch (e) {
      console.log(e);
    }
  }
  return {
    props: {
      isGlobe,
    } as DataProps,
  };
};

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
import Timeline from '../../../components/Timeline';
import ReactTooltip from 'react-tooltip';
import useKeyPress from '../../../hooks/useKeyPress';
import { GetServerSideProps } from 'next';
import { Octokit } from '@octokit/core';
import { ConfigType, GithubFileInfoType } from '../../../util/types';
import Layout from '../../../components/Layout';
import { useRouter } from 'next/router';
import { DataProps } from '../..';
import toast, { Toaster } from 'react-hot-toast';
import { useQuery } from '../../../hooks/useQuery';

ReactGA.initialize('UA-188190791-1');

const Viewer = ({ years, user, id, config }: DataProps) => {
  const [hide, setHide] = useState(false);
  const [help, setHelp] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isMobile =
    typeof window !== 'undefined'
      ? /Mobi|Android/i.test(navigator.userAgent)
      : false;
  const aPress = useKeyPress('a');
  const dPress = useKeyPress('d');
  const { query, setQuery } = useQuery();
  const [year, setYear] = useState(query?.year);
  const index = useMemo(() => {
    const i = years.findIndex((y) => y.toString() === year);
    return i === -1 ? 0 : i;
  }, [years]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (dPress) {
      const year = years[mod(index + 1, years.length)].toString();
      setQuery({ year });
      setYear(year);
    }
  }, [dPress, query]);

  useEffect(() => {
    if (aPress) {
      const year = years[mod(index - 1, years.length)].toString();
      setQuery({ year });
      setYear(year);
    }
  }, [aPress, query]);

  useEffect(() => {
    ReactGA.pageview(`/?year=${query?.year}`);
  }, []);

  useEffect(() => {
    toast(
      (t) => (
        <span>
          If you enjoy using Historic Boarders please share it with your
          friends!
        </span>
      ),
      { icon: '📲', duration: 3000, position: 'bottom-right' },
    );
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
                  onChange={(v) => {
                    const year = years[v].toString();
                    setQuery({ year });
                    setYear(year);
                  }}
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
      <Toaster />
    </>
  );
};

export default Viewer;

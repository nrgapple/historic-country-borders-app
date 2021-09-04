import MapContainer from '../../components/ViewerMap';
import React, { useEffect, useMemo, useState } from 'react';
import ReactGA from 'react-ga';
import {
  amphitheaterDataSetup,
  convertYearString,
  getYearFromFile,
  githubToken,
  mapBCFormat,
  mod,
} from '../../util/constants';
import Footer from '../../components/Footer';
import NavBar from '../../components/NavBar';
import Timeline from '../../components/Timeline';
import ReactTooltip from 'react-tooltip';
import useKeyPress from '../../hooks/useKeyPress';
import { GetServerSideProps } from 'next';
import { Octokit } from '@octokit/core';
import { ConfigType, GithubFileInfoType, Theater } from '../../util/types';
import Layout from '../../components/Layout';
import { useRouter } from 'next/router';
import { FeatureCollection } from 'geojson';
import { useRomeData } from '../../hooks/useRomeData';
import RomeMap from '../../components/RomeMap';

ReactGA.initialize('UA-188190791-1');

interface DataProps {
  theaters: Theater[];
}

const Viewer = ({ theaters }: DataProps) => {
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
  const router = useRouter();
  const years = useMemo(
    () =>
      theaters
        ? Array.from(
            new Set(
              theaters.filter((x) => x.created).map((x) => x.created as number),
            ),
          ).sort((a, b) => a - b)
        : [],
    [theaters],
  );
  const data = useRomeData(years[index], theaters);

  console.log('year', years);

  useEffect(() => {
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

  useEffect(() => {
    ReactGA.pageview(`/rome}`);
  }, []);

  if (!years) return <div>Not a valid timeline. Check your url.</div>;

  return (
    <>
      <Layout
        title={'roman - amphitheaters'}
        url={`https://historyborders.app/rome`}
      >
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
                title={'Historic Roman Amphitheaters'}
              />
              <Timeline index={index} onChange={setIndex} years={years} />
            </>
          )}
          <RomeMap layers={data} fullscreen={hide} />
          {!hide && (
            <Footer
              dataUrl={`https://githubhttps://github.com/sfsheath/roman-amphitheaters.com/aourednik/historical-basemaps`}
            />
          )}
        </div>
      </Layout>
    </>
  );
};

export default Viewer;

export const getServerSideProps: GetServerSideProps<DataProps> = async ({}) => {
  try {
    const resp = await fetch(
      `https://raw.githubusercontent.com/roman-amphitheaters/roman-amphitheaters/main/roman-amphitheaters.geojson`,
    );
    if (resp.ok) {
      const data = await resp.json();
      const theaters = amphitheaterDataSetup(data as FeatureCollection);
      return {
        props: {
          theaters,
        } as DataProps,
      };
    }
  } catch (e) {
    console.log(e);
  }
  return {
    props: {} as DataProps,
  };
};

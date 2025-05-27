import MapContainer from './MapContainer';
import React, { useEffect, useMemo, useState } from 'react';
import {
  convertYearString,
  isMobile,
  mapBCFormat,
  mod,
} from '../util/constants';
import Footer from '../components/Footer';
import Timeline from '../components/Timeline';
import PersistentUIToggle from '../components/PersistentUIToggle';
import ReactTooltip from 'react-tooltip';
// import useKeyPress from '../hooks/useKeyPress';
import Layout from '../components/Layout';
import toast, { Toaster } from 'react-hot-toast';
import { useQuery } from '../hooks/useQuery';
import { DataProps } from '../pages';
import { useAppStateSetter, useAppStateValue } from '../hooks/useState';
import { ConfigType } from '../util/types';
import ReactGA4 from 'react-ga4';
import { toastMessages } from '../config/toasts';
import { useMounted } from '../hooks/useMounted';
import { disableBodyScroll } from 'body-scroll-lock';

export default function Viewer({ years, user, id, config }: DataProps) {
  const mounted = useMounted();
  const hide = useAppStateValue('hide');
  const setState = useAppStateSetter();

  // const aPress = useKeyPress('a');
  // const dPress = useKeyPress('d');
  const { query, setQuery } = useQuery();
  const [year, setYear] = useState(
    query?.year ?? years[0]?.toString() ?? '',
  );
  const index = useMemo(() => {
    const i = years?.findIndex((y) => y.toString() === year) ?? -1;
    return i === -1 ? 0 : i;
  }, [years, year]);

  const handleToggleUI = () => {
    setState((c) => void (c.hide = !hide));
  };

  useEffect(() => {
    disableBodyScroll(document.querySelector('body') as HTMLBodyElement, {
      allowTouchMove: (el: HTMLElement | Element) => {
        return false;
      },
    });
  }, []);

  useEffect(() => {
    ReactGA4.send({
      hitType: 'pageview',
      page: `${query?.year ? `/?year=${query?.year}` : '/'}`,
      title: `${query?.year ? `Year ${query?.year}` : 'Home'}`,
    });
  }, [query?.year]);

  useEffect(() => {
    toastMessages.forEach(({ message, opts }) => {
      toast(message, opts);
    });
  }, []);

  if (!(years && user && id && config))
    return <div>Not a valid timeline. Check your url.</div>;

  return (
    <>
      <Layout title={config.name} url={`https://historyborders.app`}>
        <Viewer.Timeline
          index={index}
          years={years}
          onChange={(y) => {
            setQuery({ year: y });
            setYear(y);
            ReactGA4.event({
              category: 'Timeline',
              action: 'Year Changed',
              label: `Year ${y}`,
            });
          }}
        />
        <Viewer.Map
          user={user}
          id={id}
          config={config}
          year={convertYearString(mapBCFormat, years[index])}
          onInteraction={() => {
            ReactGA4.event({
              category: 'Map',
              action: 'Interaction',
              label: `Year ${years[index]}`,
            });
          }}
        />
      </Layout>
      <PersistentUIToggle 
        isUIHidden={hide}
        onToggle={handleToggleUI}
      />
      <Toaster
        toastOptions={{
          className: 'react-hot-toast',
          style: {
            background: 'rgba(245, 245, 220, 0.95)',
            border: '2px solid #8B4513',
            borderRadius: '4px',
            color: '#654321',
            fontFamily: "'Times New Roman', serif",
            fontSize: '12px',
            fontWeight: 'normal',
            boxShadow: '2px 2px 8px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            padding: '12px 16px',
            maxWidth: '350px',
            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.1)',
            lineHeight: '1.4',
          },
          success: {
            className: 'react-hot-toast success',
            style: {
              background: 'rgba(240, 248, 240, 0.95)',
              borderColor: '#5A7C5A',
              color: '#2D4A2D',
            },
          },
          error: {
            className: 'react-hot-toast error',
            style: {
              background: 'rgba(248, 240, 240, 0.95)',
              borderColor: '#8B4A4A',
              color: '#5A2D2D',
            },
          },
          loading: {
            className: 'react-hot-toast loading',
            style: {
              background: 'rgba(245, 245, 220, 0.95)',
              borderColor: '#8B4513',
              color: '#654321',
            },
          },
        }}
      />
    </>
  );
}

Viewer.Map = (props: {
  user: string;
  id: string;
  config: ConfigType;
  year: string;
  onInteraction: () => void;
}) => {
  const hide = useAppStateValue('hide');
  const { config, user, id, year, onInteraction } = props;
  return (
    <div className={`${hide ? 'app-large' : 'app'}`} onClick={onInteraction}>
      <MapContainer year={year} user={user} id={id} />
      <Viewer.Footer config={config} />
    </div>
  );
};

Viewer.Footer = (props: { config: ConfigType }) => {
  const hide = useAppStateValue('hide');
  const { config } = props;

  return (
    <>
      {!hide && (
        <Footer
          dataUrl={`https://github.com/aourednik/historical-basemaps`}
          lastCommit={
            config.commitDate ? new Date(config.commitDate) : undefined
          }
          discussionUrl={`https://github.com/nrgapple/historic-country-borders-app/discussions`}
        />
      )}
    </>
  );
};

Viewer.Timeline = (props: {
  index: number;
  years: number[];
  onChange: (year: string) => void;
}) => {
  const hide = useAppStateValue('hide');
  return (
    <>
      {!hide && (
        <>
          <div className="timeline-container">
            <Timeline
              globe={false}
              index={props.index}
              onChange={(v) => {
                const year = props.years[v].toString();
                props.onChange(year);
              }}
              years={props.years}
            />
          </div>
        </>
      )}
    </>
  );
};



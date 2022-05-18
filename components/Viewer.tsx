import MapContainer from '../components/ViewerMap';
import React, { useEffect, useMemo, useState } from 'react';
import ReactGA from 'react-ga';
import { convertYearString, mapBCFormat, mod } from '../util/constants';
import Footer from '../components/Footer';
import Timeline from '../components/Timeline';
import ReactTooltip from 'react-tooltip';
import useKeyPress from '../hooks/useKeyPress';
import Layout from '../components/Layout';
import toast, { Toaster } from 'react-hot-toast';
import { useQuery } from '../hooks/useQuery';
import { DataProps } from '../pages';
import { useAppStateSetter, useAppStateValue } from '../hooks/useState';
import { ConfigType } from '../util/types';
import { Menu, MenuItem, MenuButton } from '@szhsin/react-menu';

ReactGA.initialize('UA-188190791-1');

const Viewer = ({ years, user, id, config }: DataProps) => {
  const [hide, setHide] = useState(false);
  const [mounted, setMounted] = useState(false);

  const aPress = useKeyPress('a');
  const dPress = useKeyPress('d');
  const { query, setQuery } = useQuery();
  const [year, setYear] = useState(query?.year);
  const index = useMemo(() => {
    const i = years?.findIndex((y) => y.toString() === year) ?? -1;
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
          You can now share your position, zoom and year with friends by copying
          the url!
        </span>
      ),
      { icon: '🚀', duration: 5000, position: 'bottom-right' },
    );
    toast(
      (t) => (
        <span>
          If you enjoy using Historic Boarders please share it with your
          friends!
        </span>
      ),
      { icon: '❤️', duration: 3000, position: 'bottom-right' },
    );
  }, []);

  if (!(years && user && id && config))
    return <div>Not a valid timeline. Check your url.</div>;

  return (
    <>
      <Layout title={config.name} url={`https://historyborders.app`}>
        <Viewer.MenuItem mounted={mounted} vPos={95} />
        {/* <Viewer.Projection mounted={mounted} vPos={150} /> */}
        <Viewer.Timeline
          index={index}
          years={years}
          onChange={(y) => {
            setQuery({ y });
            setYear(y);
          }}
        />
        <Viewer.Map
          user={user}
          id={id}
          config={config}
          year={convertYearString(mapBCFormat, years[index])}
        />
      </Layout>
      <Toaster />
    </>
  );
};

Viewer.Map = (props: {
  user: string;
  id: string;
  config: ConfigType;
  year: string;
}) => {
  const hide = useAppStateValue('hide');
  const { config, user, id, year } = props;
  return (
    <div className={`${hide ? 'app-large' : 'app'}`}>
      <MapContainer year={year} fullscreen={hide} user={user} id={id} />
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

Viewer.MenuItem = (props: { mounted: boolean; vPos: number }) => {
  const { mounted, vPos } = props;
  const hide = useAppStateValue('hide');
  const setState = useAppStateSetter();
  const isMobile =
    typeof window !== 'undefined'
      ? /Mobi|Android/i.test(navigator.userAgent)
      : false;
  return (
    <>
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
        onClick={() => setState((c) => void (c.hide = !hide))}
        style={{ top: hide ? `${vPos - 79}px` : `${vPos}px` }}
      >
        <div className="noselect">🔭</div>
      </div>
    </>
  );
};

Viewer.Projection = (props: { mounted: boolean; vPos: number }) => {
  const { mounted, vPos } = props;
  const hide = useAppStateValue('hide');
  const setState = useAppStateSetter();
  const [open, setOpen] = useState(false);
  const isMobile =
    typeof window !== 'undefined'
      ? /Mobi|Android/i.test(navigator.userAgent)
      : false;
  return (
    <>
      {mounted && (
        <>
          <ReactTooltip
            resizeHide={false}
            id="projectionTip"
            place="left"
            effect="solid"
            globalEventOff={isMobile ? 'click' : undefined}
          >
            Projection
          </ReactTooltip>
        </>
      )}
      <div
        data-tip
        data-for="projectionTip"
        data-delay-show="300"
        className="fullscreen"
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        style={{ top: hide ? `${vPos - 79}px` : `${vPos}px` }}
      >
        <Menu
          menuButton={
            <MenuButton className="menu-button">
              <div
                style={{ width: '100%', height: '100%' }}
                className="noselect"
              >
                🗺
              </div>
            </MenuButton>
          }
          className="menu"
        >
          <MenuItem className="menu-item">Map</MenuItem>
          <MenuItem className="menu-item">Globe</MenuItem>
        </Menu>
      </div>
    </>
  );
};

export default Viewer;

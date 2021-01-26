import './styles.css';
import MapContainer from './components/Map';
import React, { useEffect, useState } from 'react';
import ReactGA from 'react-ga';

import { convertYearString, dates, mapBCFormat, mod } from './util/constants';
import Footer from './components/Footer';
import NavBar from './components/NavBar';
import Timeline from './components/Timeline';
import ReactTooltip from 'react-tooltip';
import useKeyPress from './hooks/useKeyPress';

ReactGA.initialize('UA-188190791-1');

export default function App() {
  const [index, setIndex] = useState(0);
  const [hide, setHide] = useState(false);
  const [help, setHelp] = useState(false);
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const aPress = useKeyPress('a');
  const dPress = useKeyPress('d');

  useEffect(() => {
    ReactGA.pageview('/home');
  }, []);

  useEffect(() => {
    if (dPress) {
      setIndex(mod(index + 1, dates.length));
    }
  }, [dPress]);

  useEffect(() => {
    if (aPress) {
      setIndex(mod(index - 1, dates.length));
    }
  }, [aPress]);

  return (
    <>
      <div
        data-tip
        data-for="fullscreenTip"
        data-delay-show="300"
        className="fullscreen"
        onClick={() => setHide(!hide)}
        style={{ top: hide ? '16px' : '165px' }}
      >
        <div className="noselect">🔭</div>
        <ReactTooltip
          resizeHide={false}
          id="fullscreenTip"
          place="left"
          effect="solid"
          globalEventOff={isMobile ? 'click' : undefined}
        >
          {hide ? 'Show Timeline' : 'Hide Timeline'}
        </ReactTooltip>
      </div>
      <div className={`${hide ? 'app-large' : 'app'}`}>
        {!hide && (
          <>
            <NavBar onHelp={() => setHelp(!help)} showHelp={help} />
            <Timeline index={index} onChange={setIndex} />
          </>
        )}
        <MapContainer
          year={convertYearString(mapBCFormat, dates[index])}
          fullscreen={hide}
        />
        {!hide && <Footer />}
      </div>
    </>
  );
}

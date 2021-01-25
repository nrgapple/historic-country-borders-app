import './styles.css';
import MapContainer from './components/Map';
import React, { useState } from 'react';

import { convertYearString, dates, mapBCFormat } from './util/constants';
import Footer from './components/Footer';
import NavBar from './components/NavBar';
import Timeline from './components/Timeline';
import ReactTooltip from 'react-tooltip';

export default function App() {
  const [index, setIndex] = useState(0);
  const [hide, setHide] = useState(false);

  return (
    <>
      <div
        data-tip
        data-for="fullscreenTip"
        className="fullscreen"
        onClick={() => setHide(!hide)}
        style={{ top: hide ? '16px' : '165px' }}
      >
        <div>🔭</div>
      </div>
      <ReactTooltip id="fullscreenTip" place="top" effect="solid">
        {hide ? 'Show Timeline' : 'Hide Timeline'}
      </ReactTooltip>
      <div className={`${hide ? 'app-large' : 'app'}`}>
        {!hide && (
          <>
            <NavBar />
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

import './styles.css';
import MapContainer from './components/Map';
import React, { useState } from 'react';

import { convertYearString, dates, mapBCFormat } from './util/constants';
import Footer from './components/Footer';
import NavBar from './components/NavBar';
import Timeline from './components/Timeline';

export default function App() {
  const [index, setIndex] = useState(0);
  const [hide, setHide] = useState(false);

  return (
    <>
      {
        !hide &&
        <>
          <NavBar />
          <Timeline index={index} onChange={setIndex} />
        </>
      }
      <MapContainer year={convertYearString(mapBCFormat, dates[index])} />
      {
        !hide &&
        <Footer />
      }
    </>
  );
}

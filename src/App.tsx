import './styles.css';
import MapContainer from './components/Map';
import React, { useState } from 'react';
//@ts-ignore
import HorizontalTimeline from 'react-horizontal-timeline';
import {
  convertYearString,
  convertYearToMapString,
  dates,
  mapBCFormat,
  timelineBCFormat,
} from './util/constants';

export default function App() {
  const [index, setIndex] = useState(0);

  return (
    <>
      <div className="nav-bar">
        <div className="title drop">Historic Country Borders</div>
      </div>
      <div className="timeline">
        <div
          style={{
            width: '100%',
            height: '100px',
            fontSize: '15px',
          }}
          className="timeline"
        >
          <HorizontalTimeline
            styles={{
              background: '#252525',
              foreground: '#64dfdf',
              outline: '#6930c3',
            }}
            index={index}
            indexClick={(newIndex: number) => {
              setIndex(newIndex);
            }}
            getLabel={(date: any) =>
              convertYearString(
                timelineBCFormat,
                new Date(date, 0).getFullYear(),
              )
            }
            values={dates}
          />
        </div>
      </div>
      <div className="map-grid">
        <MapContainer year={convertYearString(mapBCFormat, dates[index])} />
      </div>
      <div className="footer">
        <div>
          This map uses data from{' '}
          <a href="https://github.com/aourednik/historical-basemaps">
            aourednik's historical map data
          </a>{' '}
          to show country borders over history.
        </div>
        <div>
          <a href="https://github.com/nrgapple/historic-country-borders-app">
            Star this on Github!
          </a>
        </div>
      </div>
    </>
  );
}

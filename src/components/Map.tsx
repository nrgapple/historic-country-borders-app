import React from 'react';
import ReactMapboxGl, { GeoJSONLayer } from 'react-mapbox-gl';
import { useData } from '../hooks/useData';

import 'mapbox-gl/dist/mapbox-gl.css';

interface MapContainerProps {
  year: string;
}

const Map = ReactMapboxGl({
  accessToken:
    'pk.eyJ1IjoibnJnYXBwbGUiLCJhIjoiY2trN2E1YnVvMGJ4OTJwbWptM25waHVmNyJ9.UxvOXdAatpV-H1AXQQ23Kg',
});

const MapContainer = ({ year }: MapContainerProps) => {
  const [isLoading, data] = useData(year);

  return (
    <Map
      className="map"
      style="mapbox://styles/nrgapple/ckk7nff4z0jzj17pitiuejlvt"
      zoom={[2]}
      onStyleLoad={(map) => {
        map.resize();
      }}
    >
      {data && (
        <>
          <GeoJSONLayer
            data={data.borders}
            fillPaint={{
              'fill-color': ['get', 'COLOR'],
              'fill-opacity': 0.5,
            }}
          />
          <GeoJSONLayer
            data={data.labels}
            symbolLayout={{
              'text-field': '{NAME}',
              'text-font': ['Lato Bold'],
              'text-size': {
                base: 1,
                stops: [
                  [12, 12],
                  [16, 16],
                ],
              },
              'text-padding': 3,
              'text-letter-spacing': 0.1,
              'text-max-width': 7,
              'text-transform': 'uppercase',
            }}
          />
        </>
      )}
    </Map>
  );
};

export default MapContainer;

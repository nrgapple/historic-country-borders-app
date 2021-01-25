import React, { Suspense, useEffect, useRef, useState } from 'react';
import { GeoJSONLayer } from 'react-mapbox-gl';
import { workerSet } from '../util/ReactMapBoxGl';
import MapboxGl from 'mapbox-gl';
import { useData } from '../hooks/useData';

import 'mapbox-gl/dist/mapbox-gl.css';

interface MapContainerProps {
  year: string;
  fullscreen?: boolean;
}

//@ts-ignore
const Map = React.lazy(() =>
  workerSet().then(() => import('../util/ReactMapBoxGl')),
);

const MapContainer = ({ year, fullscreen }: MapContainerProps) => {
  const [isLoading, data] = useData(year);
  const [zoomValue, setZoomValue] = useState(2);
  const mapRef = useRef<MapboxGl.Map | undefined>(undefined);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.resize();
    }
  }, [fullscreen]);

  return (
    <div className="map-grid">
      <Suspense fallback={<div></div>}>
        <Map
          className="map"
          zoom={[zoomValue]}
          style="mapbox://styles/nrgapple/ckk7nff4z0jzj17pitiuejlvt"
          onStyleLoad={(map: MapboxGl.Map) => {
            mapRef.current = map;
            map.resize();
          }}
          onZoomEnd={(map) => {
            setZoomValue(map.getZoom());
          }}
          onResize={(map) => {
            console.log('here');
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
      </Suspense>
    </div>
  );
};

export default MapContainer;

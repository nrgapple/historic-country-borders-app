import React, { useEffect, useRef, useState } from 'react';
import { GeoJSONLayer } from 'react-mapbox-gl';
import MapboxGl, { MapMouseEvent } from 'mapbox-gl';
import { useData } from '../hooks/useData';
import Map from '../util/ReactMapBoxGl';

import 'mapbox-gl/dist/mapbox-gl.css';
import { events } from 'react-mapbox-gl/lib/map-events';
import { FeatureCollection } from 'geojson';
import { mapEventPropertiesType } from '../util/types';

interface MapContainerProps {
  year: string;
  user: string;
  id: string;
  fullscreen?: boolean;
  mapEvents?: FeatureCollection;
  onClickMapEvent?: (props: mapEventPropertiesType | undefined) => void;
}

const MapContainer = ({
  year,
  fullscreen,
  user,
  id,
  mapEvents,
  onClickMapEvent,
}: MapContainerProps) => {
  const [, data] = useData(year, user, id);
  const [zoomValue, setZoomValue] = useState(2);
  const mapRef = useRef<MapboxGl.Map | undefined>(undefined);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.resize();
    }
  }, [fullscreen]);

  return (
    <div className="map-grid">
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
            {mapEvents && (
              <GeoJSONLayer
                data={mapEvents}
                symbolPaint={{
                  'text-opacity': {
                    stops: [
                      [6, 0],
                      [6, 1],
                    ],
                  },
                  //'icon-color': '#ffffff',
                }}
                symbolLayout={{
                  'icon-image': 'information-15',
                  'text-field': '{title}',
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
                  'text-max-width': 20,
                  'text-offset': [0, 1.5],
                }}
                symbolOnClick={(e: MapMouseEvent) => {
                  const features = mapRef.current!.queryRenderedFeatures(
                    e.point,
                  );
                  if (features.length > 0) {
                    onClickMapEvent &&
                      onClickMapEvent(
                        features[0].properties as mapEventPropertiesType,
                      );
                  }
                }}
              />
            )}
          </>
        )}
      </Map>
    </div>
  );
};

export default MapContainer;

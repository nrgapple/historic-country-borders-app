import React, { useEffect, useRef, useState, useMemo } from 'react';
import MapboxGl from 'mapbox-gl';
import { useData } from '../hooks/useData';
import toast from 'react-hot-toast';
import { useQuery } from '../hooks/useQuery';
import { CoordTuple } from '../util/types';
import { Source, Layer } from 'react-map-gl';
import PopupInfo, { Info } from './PopupInfo2';
import ReactGA4 from 'react-ga4';
import NewMap from '../util/newMap';

interface MapContainerProps {
  year: string;
  user: string;
  id: string;
  fullscreen?: boolean;
}

export default function MapContainer({
  year,
  fullscreen,
  user,
  id,
}: MapContainerProps) {
  const { data: { data, places } = {}, isLoading } = useData(year, user, id);
  const mapRef = useRef<MapboxGl.Map | undefined>(undefined);
  const [selectedInfo, setSelectedInfo] = useState<Info | undefined>();
  const { query, setQuery } = useQuery();
  const centerQuery: [number, number] = useMemo(() => {
    const { lng, lat } = query;
    if (lng && lat) {
      return [Number(lng), Number(lat)];
    }
    return [0, 0];
  }, [query]);
  const zoomQuery = useMemo(
    () => (!!query.zoom && !isNaN(Number(query.zoom)) ? Number(query.zoom) : 2),
    [query],
  );
  const [zoomValue, setZoomValue] = useState(zoomQuery);
  const [centerValue, setCenterValue] = useState<[number, number]>(centerQuery);

  useEffect(() => {
    const id = 'loading';
    if (isLoading) {
      toast.loading('Loading Borders...', { id, position: 'bottom-right' });
    } else {
      toast.dismiss(id);
    }
  }, [isLoading]);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.resize();
    }
  }, [fullscreen]);

  useEffect(() => {
    const [lng, lat] = centerValue;
    setQuery({
      lng: lng.toFixed(7),
      lat: lat.toFixed(7),
      zoom: zoomValue.toFixed(7),
    });
  }, [zoomValue, centerValue]);

  return (
    <div className="map-grid">
      {data && (
        <NewMap
          interactiveLayerIds={['borders']}
          onStyleData={({ target }) => {
            target.resize();
            target.setZoom(zoomValue);
          }}
          onZoomEnd={({ target }) => {
            setZoomValue(target.getZoom());
          }}
          onClick={({ originalEvent, features, lngLat }) => {
            if (!features?.length) {
              setSelectedInfo(undefined);
              return;
            }
            const feature = features[0];
            const place = feature.properties?.NAME;
            originalEvent.stopPropagation();
            setSelectedInfo(() => ({
              place,
              position: lngLat.toArray() as CoordTuple,
            }));
            try {
              ReactGA4.event({
                category: 'Country',
                action: `${place ? `clicked ${place}` : 'clicked unknown'}`,
                label: 'place',
              });
            } catch (e) {
              console.error(`ga error: ${e}`);
            }
          }}
          initialViewState={{
            latitude: centerValue[1],
            longitude: centerValue[0],
            zoom: zoomValue,
          }}
          onMoveEnd={({ target }) => {
            const lngLat = target.getCenter().toArray();
            const [lng, lat] = lngLat;
            setCenterValue([lng, lat]);
            try {
              ReactGA4.event({
                category: 'Move',
                action: `${
                  lngLat ? `moved to ${lngLat.toString()}` : 'moved to unknown'
                }`,
                label: 'location',
              });
            } catch (e) {
              console.error(`ga error: ${e}`);
            }
          }}
        >
          <PopupInfo
            info={selectedInfo}
            onClose={() => setSelectedInfo(undefined)}
          />
          <Source id="borders" type="geojson" data={data?.borders}>
            <Layer
              {...{
                id: 'borders',
                type: 'fill',
                paint: {
                  'fill-color': ['get', 'COLOR'],
                  'fill-opacity': 0.5,
                  'fill-outline-color': '#000000',
                },
              }}
            />
          </Source>
          <Source id="labels" type="geojson" data={data?.labels}>
            <Layer
              {...{
                id: 'labels',
                type: 'symbol',
                layout: {
                  'text-field': '{NAME}',
                  'text-font': ['Lato Bold'],
                  'text-size': {
                    base: 1,
                    stops: [
                      [4, 7],
                      [8, 18],
                    ],
                  },
                  'text-padding': 3,
                  'text-letter-spacing': 0.1,
                  'text-max-width': 7,
                  'text-transform': 'uppercase',
                },
              }}
            />
          </Source>
          <Source id="places" type="geojson" data={places}>
            <Layer
              {...{
                id: 'places',
                type: 'symbol',
                paint: {
                  'text-color': '#3d3d3d',
                },
                layout: {
                  'text-field': '{name}',
                  'text-font': ['Lato Bold'],
                  'text-size': {
                    base: 1,
                    stops: [
                      [3, 0.02],
                      [6, 12],
                    ],
                  },
                },
                'text-padding': 3,
                'text-letter-spacing': 0.1,
                'text-max-width': 7,
                'text-transform': 'uppercase',
                'text-offset': [0, 2],
                'icon-allow-overlap': true,
                'icon-image': 'circle',
                'icon-size': {
                  base: 1,
                  stops: [
                    [3, 0.02],
                    [8, 0.8],
                  ],
                },
              }}
            />
          </Source>
        </NewMap>
      )}
    </div>
  );
}

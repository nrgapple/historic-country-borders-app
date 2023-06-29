import React, { useEffect, useRef, useState, useMemo } from 'react';
import { GeoJSONLayer, Image } from 'react-mapbox-gl';
import MapboxGl from 'mapbox-gl';
import { useData } from '../hooks/useData';
import Map from '../util/ReactMapBoxGl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useWikiData } from '../hooks/useWiki';
import toast from 'react-hot-toast';
import { useQuery } from '../hooks/useQuery';
import ReactGA4 from 'react-ga4';
import { LngLat } from 'mapbox-gl';
import PopupInfo from './PopupInfo';
import { CoordTuple } from '../util/types';

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
  const [selectedPlace, setSelectedPlace] = useState('');
  const [popupPos, setPopupPos] = useState<CoordTuple>([0, 0]);
  const {
    info: wikiInfo,
    title: wikiTitle,
    isLoading: wikiLoading,
  } = useWikiData(selectedPlace);
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
      <Map
        className="map"
        // zoom={[zoomValue]}
        style="mapbox://styles/nrgapple/ckk7nff4z0jzj17pitiuejlvt"
        onStyleLoad={(map: MapboxGl.Map) => {
          mapRef.current = map;
          map.resize();
          map.setZoom(zoomValue);
        }}
        onZoomEnd={(map) => {
          const zoom = map.getZoom();
          setZoomValue(zoom);
        }}
        center={centerValue}
        onClick={(e) => setSelectedPlace('')}
        onMoveEnd={(map) => {
          const lngLat = [map.getCenter().lng, map.getCenter().lat] as [
            number,
            number,
          ];
          setCenterValue(lngLat);
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
        {data && (
          <>
            {selectedPlace && (
              <PopupInfo
                position={popupPos}
                title={wikiTitle}
                description={wikiInfo}
                isLoading={wikiLoading}
              />
            )}
            <GeoJSONLayer
              data={data.borders}
              fillPaint={{
                'fill-color': ['get', 'COLOR'],
                'fill-opacity': 0.5,
                'fill-outline-color': '#000000',
              }}
              fillOnClick={(e: any) => {
                const place = e.features[0]?.properties.NAME;
                const lngLat = e.lngLat as LngLat;
                setSelectedPlace(place);
                setPopupPos(() => [lngLat.lng, lngLat.lat]);
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
            />
            <GeoJSONLayer
              data={data.labels}
              symbolLayout={{
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
              }}
            />
            {places && (
              <GeoJSONLayer
                data={places}
                symbolPaint={{
                  'text-color': '#3d3d3d',
                }}
                symbolLayout={{
                  'text-field': '{name}',
                  'text-font': ['Lato Bold'],
                  'text-size': {
                    base: 1,
                    stops: [
                      [3, 0.02],
                      [6, 12],
                    ],
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
            )}
          </>
        )}
        <Image id={'circle'} url={'/circle.png'} />
      </Map>
    </div>
  );
}

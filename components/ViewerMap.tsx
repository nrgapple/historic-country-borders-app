import React, { useEffect, useRef, useState, useMemo } from 'react';
import { GeoJSONLayer, Popup, Image } from 'react-mapbox-gl';
import MapboxGl from 'mapbox-gl';
import { useData } from '../hooks/useData';
import Map from '../util/ReactMapBoxGl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useParentSize } from '../hooks/useParentSize';
import { useWikiData } from '../hooks/useWiki';
import toast from 'react-hot-toast';
import { useQuery } from '../hooks/useQuery';

interface MapContainerProps {
  year: string;
  user: string;
  id: string;
  fullscreen?: boolean;
  threeD: boolean;
}

const MapContainer = ({
  year,
  fullscreen,
  user,
  id,
  threeD = true,
}: MapContainerProps) => {
  const { data: { data, places } = {}, isLoading } = useData(year, user, id);
  const mapRef = useRef<MapboxGl.Map | undefined>(undefined);
  const globeRef = useRef<any>(undefined);
  const parentRef = useRef<HTMLDivElement>(null);
  const { height, width, refresh } = useParentSize(parentRef);
  const [selectedPlace, setSelectedPlace] = useState('');
  const [popupPos, setPopupPos] = useState([0, 0]);
  const wikiInfo = useWikiData(selectedPlace);
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
    if (globeRef.current) {
      refresh();
    }
  }, [fullscreen]);

  useEffect(() => {
    const [lng, lat] = centerValue;
    setQuery({
      lng: lng.toString(),
      lat: lat.toString(),
      zoom: zoomValue.toString(),
    });
  }, [zoomValue, centerValue]);

  return (
    <div className="map-grid" ref={parentRef}>
      <Map
        className="map"
        zoom={[zoomValue]}
        style="mapbox://styles/nrgapple/ckk7nff4z0jzj17pitiuejlvt"
        onStyleLoad={(map: MapboxGl.Map) => {
          mapRef.current = map;
          map.resize();
        }}
        onZoomEnd={(map) => {
          const zoom = map.getZoom();
          setZoomValue(zoom);
        }}
        center={centerValue}
        onClick={(e) => setSelectedPlace('')}
        onMoveEnd={(map) =>
          setCenterValue([map.getCenter().lng, map.getCenter().lat])
        }
      >
        {data && (
          <>
            {selectedPlace && (
              <Popup
                style={{
                  width: '250px',
                  height: '250px',
                }}
                coordinates={popupPos}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    color: 'black',
                    overflow: 'scroll',
                  }}
                >
                  {wikiInfo}
                </div>
              </Popup>
            )}
            <GeoJSONLayer
              data={data.borders}
              fillPaint={{
                'fill-color': ['get', 'COLOR'],
                'fill-opacity': 0.5,
              }}
              fillOnClick={(e: any) => {
                console.log(e);
                setSelectedPlace(e.features[0]?.properties.NAME);
                setPopupPos((curr) => [...(Object.values(e.lngLat) as any)]);
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
};

export default MapContainer;

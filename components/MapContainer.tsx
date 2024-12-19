import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from 'react';
import { Map } from 'mapbox-gl';
import { useData } from '../hooks/useData';
import toast from 'react-hot-toast';
import { useQuery } from '../hooks/useQuery';
import { CoordTuple } from '../util/types';
import PopupInfo, { Info } from './PopupInfo';
import ReactGA4 from 'react-ga4';
import MapboxDefaultMap from '../util/MapboxDefaultMap';
import MapSources from './MapSources';

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
  const mapRef = useRef<Map | undefined>(undefined);
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
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const id = 'loading';
    if (isLoading) {
      toast.loading('Loading Borders...', { id, position: 'bottom-right' });
    } else {
      toast.dismiss(id);
    }

    if (mapRef.current) {
      mapRef.current.resize();
    }
  }, [isLoading, fullscreen]);

  useEffect(() => {
    const [lng, lat] = centerValue;
    setQuery({
      lng: lng.toFixed(7),
      lat: lat.toFixed(7),
      zoom: zoomValue.toFixed(7),
    });
  }, [zoomValue, centerValue]);

  useEffect(() => {
    setSelectedInfo(undefined);
  }, [data]);

  const handleStyleData = useCallback(
    ({ target }) => {
      target.resize();
      target.setZoom(zoomValue);
    },
    [zoomValue],
  );

  const handleLoad = useCallback(() => {
    setMapReady(true);
    ReactGA4.event({
      category: 'Map',
      action: 'load',
      label: 'map loaded',
      value: 1,
    });
  }, []);

  const handleZoomEnd = useCallback(({ target }) => {
    const zoom = target.getZoom();
    setZoomValue(zoom);
    ReactGA4.event({
      category: 'Map',
      action: 'zoom',
      label: `zoomed to ${zoom}`,
      value: 1,
    });
  }, []);

  const handleClick = useCallback(({ originalEvent, features, lngLat }) => {
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
    ReactGA4.event({
      category: 'Country',
      action: 'click',
      label: place || 'unknown',
      value: 1,
    });
  }, []);

  const handleMoveEnd = useCallback(({ target }) => {
    const lngLat = target.getCenter().toArray();
    const [lng, lat] = lngLat;
    setCenterValue([lng, lat]);
    ReactGA4.event({
      category: 'Map',
      action: 'move',
      label: `moved to ${lngLat.toString()}`,
      value: 1,
    });
  }, []);

  const mapComponent = useMemo(
    () => (
      <MapboxDefaultMap
        interactiveLayerIds={['borders']}
        onStyleData={handleStyleData}
        onLoad={handleLoad}
        onZoomEnd={handleZoomEnd}
        onClick={handleClick}
        initialViewState={{
          latitude: centerValue[1],
          longitude: centerValue[0],
          zoom: zoomValue,
        }}
        onMoveEnd={handleMoveEnd}
      >
        <PopupInfo
          info={selectedInfo}
          onClose={() => setSelectedInfo(undefined)}
        />
        {mapReady && places && data && (
          <MapSources data={data} places={places} />
        )}
      </MapboxDefaultMap>
    ),
    [
      handleStyleData,
      handleLoad,
      handleZoomEnd,
      handleClick,
      handleMoveEnd,
      centerValue,
      zoomValue,
      selectedInfo,
      mapReady,
      data,
      places,
    ],
  );

  return <div className="map-grid">{mapComponent}</div>;
}

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactGA4 from 'react-ga4';
import toast from 'react-hot-toast';
import {
  MapboxEvent,
  MapLayerMouseEvent,
  MapStyleDataEvent,
} from 'react-map-gl';
import CountryInfo, { CountryInfoData } from './CountryInfo';
import MapSources from './MapSources';
import { useData } from '../hooks/useData';
import { useMapQuery } from '../hooks/useMapQuery';
import MapboxDefaultMap from '../util/MapboxDefaultMap';

interface MapContainerProps {
  year: string;
  user: string;
  id: string;
}

export default function MapContainer({ year, user, id }: MapContainerProps) {
  const { data: { data, places } = {}, isLoading } = useData(year, user, id);
  const [selectedInfo, setSelectedInfo] = useState<CountryInfoData>();
  const { viewState, updateMapView, isReady } = useMapQuery();
  const hasSetStyleRef = useRef(false);
  const mapRef = useRef<any>(null);
  const [isWaitingForStyleLoad, setIsWaitingForStyleLoad] = useState(false);

  useEffect(() => {
    const toastId = 'loading';
    if (isLoading) {
      toast.loading('Loading Borders...', {
        id: toastId,
        position: 'bottom-right',
      });
    } else {
      toast.dismiss(toastId);
    }
  }, [isLoading]);

  useEffect(() => setSelectedInfo(undefined), [data]);

  useEffect(() => {
    setIsWaitingForStyleLoad(false);
    hasSetStyleRef.current = false;
  }, [isReady, year, user, id]);

  const handleStyleLoad = useCallback(({ target }: MapboxEvent) => {
    setIsWaitingForStyleLoad(false);
    target.resize();
  }, []);

  useEffect(
    () => () => {
      if (mapRef.current?.getMap) {
        mapRef.current.getMap().off('style.load', handleStyleLoad);
      }
    },
    [handleStyleLoad],
  );

  const handleStyleData = useCallback((_event: MapStyleDataEvent) => {
    if (!hasSetStyleRef.current) {
      setIsWaitingForStyleLoad(false);
      hasSetStyleRef.current = true;
    }
  }, []);

  const handleClick = useCallback(
    ({ originalEvent, features }: MapLayerMouseEvent) => {
      if (!features?.length) {
        setSelectedInfo(undefined);
        return;
      }

      const place = features[0].properties?.NAME;
      originalEvent.stopPropagation();
      setSelectedInfo(place ? { place } : undefined);
      ReactGA4.event('country_select', {
        country_name: place || 'unknown',
        year,
        selection_method: 'map_click',
        mode: 'explore',
      });
    },
    [year],
  );

  return (
    <div
      className="map-grid"
      data-testid="map-container"
      data-data-state={isLoading ? 'loading' : data ? 'ready' : 'unavailable'}
      data-feature-count={data?.borders?.features.length ?? 0}
    >
      <MapboxDefaultMap
        key={isReady ? `ready-${user}-${id}` : 'loading'}
        interactiveLayerIds={['borders']}
        onStyleData={handleStyleData}
        onLoad={() => setIsWaitingForStyleLoad(false)}
        onClick={handleClick}
        initialViewState={viewState}
        onMove={({ viewState: nextViewState }) =>
          updateMapView(
            nextViewState.longitude,
            nextViewState.latitude,
            nextViewState.zoom,
          )
        }
        mapStyle="mapbox://styles/nrgapple1/cm4awphea01dn01s3ajotcscl"
        ref={(mapInstance) => {
          mapRef.current = mapInstance;
          if (mapInstance?.getMap) {
            const map = mapInstance.getMap();
            map.off('style.load', handleStyleLoad);
            map.on('style.load', handleStyleLoad);
          }
        }}
      >
        {places && data && !isWaitingForStyleLoad && (
          <MapSources
            data={data}
            places={places}
            selectedCountry={selectedInfo?.place}
          />
        )}
      </MapboxDefaultMap>

      {selectedInfo && (
        <CountryInfo
          info={selectedInfo}
          onClose={() => setSelectedInfo(undefined)}
        />
      )}
    </div>
  );
}

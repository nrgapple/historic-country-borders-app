import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useData } from '../hooks/useData';
import toast from 'react-hot-toast';
import CountryInfo, { CountryInfoData } from './CountryInfo';
import ReactGA4 from 'react-ga4';
import MapboxDefaultMap from '../util/MapboxDefaultMap';
import MapSources from './MapSources';
import { MapboxEvent, MapStyleDataEvent } from 'react-map-gl';
import { useMapQuery } from '../hooks/useMapQuery';

interface MapContainerProps {
  year: string;
  user: string;
  id: string;
}

export default function MapContainer({
  year,
  user,
  id,
}: MapContainerProps) {
  const { data: { data, places } = {}, isLoading } = useData(year, user, id);
  const [selectedInfo, setSelectedInfo] = useState<CountryInfoData | undefined>();
  const { viewState, updateMapView, isReady } = useMapQuery();
  const hasSetStyleRef = useRef(false);

  // Handle loading toast
  useEffect(() => {
    const id = 'loading';
    if (isLoading) {
      toast.loading('Loading Borders...', { id, position: 'bottom-right' });
    } else {
      toast.dismiss(id);
    }
  }, [isLoading]);

  // Clear selected info when data changes
  useEffect(() => {
    setSelectedInfo(undefined);
  }, [data]);

  const handleStyleData = useCallback(({ target }: MapStyleDataEvent) => {
    target.resize();
  }, []);

  const handleLoad = useCallback(({ target }: MapboxEvent) => {
    target.resize();
    
    ReactGA4.event({
      category: 'Map',
      action: 'load',
      label: 'map loaded',
      value: 1,
    });
    
    if (hasSetStyleRef.current || !target.isStyleLoaded()) {
      return;
    }
    
    const style = target.getStyle();
    if (!style) {
      console.error('No style found');
      return;
    }

    // Remove default country borders
    const filterDefaultBorderLayers = (l: any) => !l.id.includes('admin');
    hasSetStyleRef.current = true;
    
    const newStyle = {
      ...style,
      imports: [
        {
          //@ts-ignore
          ...style.imports[0],
          data: {
            //@ts-ignore
            ...style.imports[0].data,
            //@ts-ignore
            layers: style.imports[0].data.layers.filter(
              filterDefaultBorderLayers,
            ),
          },
        },
      ],
    };
    target.setStyle(newStyle);
  }, []);

  const handleViewStateChange = useCallback(({ viewState: newViewState }) => {
    // Use debounced update for smooth map movement
    updateMapView(
      newViewState.longitude, 
      newViewState.latitude, 
      newViewState.zoom
    );
  }, [updateMapView]);

  const handleClick = useCallback(({ originalEvent, features }) => {
    if (!features?.length) {
      setSelectedInfo(undefined);
      return;
    }
    
    const feature = features[0];
    const place = feature.properties?.NAME;
    originalEvent.stopPropagation();
    
    setSelectedInfo({
      place,
    });
    
    ReactGA4.event({
      category: 'Country',
      action: 'click',
      label: place || 'unknown',
      value: 1,
    });
  }, []);

  const closeCountryInfo = useCallback(() => {
    setSelectedInfo(undefined);
  }, []);

  return (
    <div className="map-grid">
      <MapboxDefaultMap
        key={isReady ? 'ready' : 'loading'}
        interactiveLayerIds={['borders']}
        onStyleData={handleStyleData}
        onLoad={handleLoad}
        onClick={handleClick}
        initialViewState={viewState}
        onMove={handleViewStateChange}
      >
        {places && data && <MapSources data={data} places={places} selectedCountry={selectedInfo?.place} />}
      </MapboxDefaultMap>
      <CountryInfo info={selectedInfo} onClose={closeCountryInfo} />
    </div>
  );
}

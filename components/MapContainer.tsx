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
  const mapRef = useRef<any>(null);
  const [isWaitingForStyleLoad, setIsWaitingForStyleLoad] = useState(false);

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

  // Reset style loading state when map key changes or data changes
  useEffect(() => {
    setIsWaitingForStyleLoad(false);
    hasSetStyleRef.current = false;
  }, [isReady, year, user, id]);

  const handleStyleLoad = useCallback(({ target }: MapboxEvent) => {
    // Use style.load event for reliable style loading detection
    setIsWaitingForStyleLoad(false);
    target.resize();
  }, [year]);

  // Cleanup effect to remove event listeners
  useEffect(() => {
    return () => {
      if (mapRef.current && mapRef.current.getMap) {
        const map = mapRef.current.getMap();
        map.off('style.load', handleStyleLoad);
      }
    };
  }, [handleStyleLoad]);

  const handleStyleData = useCallback(({ target }: MapStyleDataEvent) => {
    target.resize();
    
    // If style is loaded but we haven't set our custom style yet, proceed
    if (!hasSetStyleRef.current && target.isStyleLoaded()) {
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
      
      // Set the new style and wait for it to load
      target.setStyle(newStyle);
      setIsWaitingForStyleLoad(true);
      
      // Add a fallback timeout in case style.load event doesn't fire
      setTimeout(() => {
        setIsWaitingForStyleLoad(false);
      }, 1000);
    }
    
    // If we've already set the style and this is a subsequent styledata event,
    // it means the new style has loaded, so we can allow MapSources to render
    if (hasSetStyleRef.current && target.isStyleLoaded()) {
      setIsWaitingForStyleLoad(false);
    }
  }, [year]);

  const handleLoad = useCallback(({ target }: MapboxEvent) => {
    target.resize();
    
    ReactGA4.event({
      category: 'Map',
      action: 'load',
      label: 'map loaded',
      value: 1,
    });
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
        key={isReady ? `ready-${year}-${user}-${id}` : 'loading'}
        interactiveLayerIds={['borders']}
        onStyleData={handleStyleData}
        onLoad={handleLoad}
        onClick={handleClick}
        initialViewState={viewState}
        onMove={handleViewStateChange}
        // Use a ref to access the map instance for style.load event
        ref={(mapInstance) => {
          mapRef.current = mapInstance;
          if (mapInstance && mapInstance.getMap) {
            const map = mapInstance.getMap();
            // Remove any existing listener to prevent duplicates
            map.off('style.load', handleStyleLoad);
            // Add style.load event listener for reliable style loading detection
            map.on('style.load', handleStyleLoad);
          }
        }}
      >
        {/* Only render MapSources when style is ready and data is available */}
        {places && data && !isWaitingForStyleLoad && (
          <MapSources data={data} places={places} selectedCountry={selectedInfo?.place} />
        )}
      </MapboxDefaultMap>
      <CountryInfo info={selectedInfo} year={year} onClose={closeCountryInfo} />
    </div>
  );
}

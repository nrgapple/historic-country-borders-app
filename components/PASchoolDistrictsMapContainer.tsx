import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { usePASchoolDistricts } from '../hooks/usePASchoolDistricts';
import toast from 'react-hot-toast';
import DistrictInfo, { DistrictInfoData } from './DistrictInfo';
import ReactGA4 from 'react-ga4';
import MapboxDefaultMap from '../util/MapboxDefaultMap';
import PASchoolDistrictsMapSources from './PASchoolDistrictsMapSources';
import { MapboxEvent, MapStyleDataEvent } from 'react-map-gl';
import { useMapQuery } from '../hooks/useMapQuery';
import { useSettings } from '../contexts/SettingsContext';
import { Feature } from 'geojson';
import bbox from '@turf/bbox';

// Pennsylvania approximate bounds: [[minLng, minLat], [maxLng, maxLat]]
const PA_BOUNDS: [[number, number], [number, number]] = [
  [-80.5, 39.7], // Southwest corner
  [-74.7, 42.3], // Northeast corner
];

// Default view centered on Pennsylvania
const DEFAULT_PA_VIEW = {
  longitude: -77.6,
  latitude: 41.0,
  zoom: 6.5,
};

export default function PASchoolDistrictsMapContainer() {
  const { data: { data, places } = {}, isLoading } = usePASchoolDistricts();
  const [selectedInfo, setSelectedInfo] = useState<DistrictInfoData | undefined>();
  const { viewState, updateMapView, isReady } = useMapQuery();
  const { settings } = useSettings();
  const hasSetStyleRef = useRef(false);
  const mapRef = useRef<any>(null);
  const [isWaitingForStyleLoad, setIsWaitingForStyleLoad] = useState(true);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const [initialViewSet, setInitialViewSet] = useState(false);

  // Handle loading toast
  useEffect(() => {
    const id = 'loading';
    if (isLoading) {
      toast.loading('Loading School Districts...', { id, position: 'bottom-right' });
    } else {
      toast.dismiss(id);
    }
  }, [isLoading]);

  // Clear selected info when data changes
  useEffect(() => {
    setSelectedInfo(undefined);
  }, [data]);

  // Set initial view to fit PA when data is loaded AND style is loaded
  useEffect(() => {
    if (data?.borders && mapRef.current && !initialViewSet && isStyleLoaded) {
      try {
        const map = mapRef.current.getMap();
        if (map && map.isStyleLoaded()) {
          // Calculate bounding box from all districts
          const allFeatures = data.borders.features;
          if (allFeatures.length > 0) {
            // Create a feature collection from all districts to get overall bounds
            const bboxResult = bbox({
              type: 'FeatureCollection',
              features: allFeatures,
            });
            const [minLng, minLat, maxLng, maxLat] = bboxResult;
            
            // Fit map to bounds with padding (larger padding = more zoomed out)
            map.fitBounds(
              [[minLng, minLat], [maxLng, maxLat]],
              {
                padding: { top: 100, bottom: 100, left: 100, right: 100 },
                duration: 1000,
                essential: true,
              }
            );
            setInitialViewSet(true);
          }
        }
      } catch (error) {
        console.warn('Failed to set initial PA bounds, using default view:', error);
        // Fallback to default view
        if (mapRef.current?.getMap) {
          const map = mapRef.current.getMap();
          if (map.isStyleLoaded()) {
            map.setCenter([DEFAULT_PA_VIEW.longitude, DEFAULT_PA_VIEW.latitude]);
            map.setZoom(DEFAULT_PA_VIEW.zoom);
          }
        }
        setInitialViewSet(true);
      }
    }
  }, [data, initialViewSet, isStyleLoaded]);

  // Reset style loading state when map is ready
  useEffect(() => {
    setIsWaitingForStyleLoad(true);
    setIsStyleLoaded(false);
    hasSetStyleRef.current = false;
  }, [isReady]);

  const handleStyleLoad = useCallback(({ target }: MapboxEvent) => {
    setIsWaitingForStyleLoad(false);
    setIsStyleLoaded(true);
    target.resize();
  }, []);

  // Cleanup effect to remove event listeners
  useEffect(() => {
    return () => {
      if (mapRef.current && mapRef.current.getMap) {
        const map = mapRef.current.getMap();
        map.off('style.load', handleStyleLoad);
      }
    };
  }, [handleStyleLoad]);

  const handleStyleData = useCallback((e: MapStyleDataEvent) => {
    // Don't set style as loaded here - wait for style.load event
    if (!hasSetStyleRef.current) {
      hasSetStyleRef.current = true;
    }
  }, []);

  const handleLoad = useCallback(() => {
    // Map loaded, but style might still be loading
    // Don't set style as loaded here - wait for style.load event
  }, []);

  const handleViewStateChange = useCallback(({ viewState: newViewState }: { viewState: any }) => {
    // Use debounced update for smooth map movement
    updateMapView(
      newViewState.longitude, 
      newViewState.latitude, 
      newViewState.zoom
    );
  }, [updateMapView]);

  const handleClick = useCallback(({ originalEvent, features, lngLat }: { originalEvent: any; features?: any[]; lngLat: any }) => {
    if (!features?.length) {
      setSelectedInfo(undefined);
      return;
    }
    
    const feature = features[0];
    const districtName = feature.properties?.NAME;
    const properties = feature.properties;
    originalEvent.stopPropagation();
    
    if (districtName) {
      setSelectedInfo({
        districtName,
        properties,
      });
      
      ReactGA4.event('district_select', {
        district_name: districtName,
        selection_method: 'map_click',
      });
    }
  }, []);

  const closeDistrictInfo = useCallback(() => {
    setSelectedInfo(undefined);
  }, []);

  // Use default PA view if no viewState from query params
  const mapViewState = viewState && 
    typeof viewState.longitude === 'number' && 
    typeof viewState.latitude === 'number' && 
    !isNaN(viewState.longitude) && 
    !isNaN(viewState.latitude) 
    ? viewState 
    : DEFAULT_PA_VIEW;

  return (
    <div className="map-grid" data-testid="pa-school-districts-map-container">
      <MapboxDefaultMap
        key={isReady ? 'ready-pa-school-districts' : 'loading'}
        interactiveLayerIds={['districts']}
        onStyleData={handleStyleData}
        onLoad={handleLoad}
        onClick={handleClick}
        initialViewState={mapViewState}
        onMove={handleViewStateChange}
        maxBounds={PA_BOUNDS}
        minZoom={6}
        maxZoom={15}
        // Use a ref to access the map instance for style.load event
        ref={(mapInstance) => {
          mapRef.current = mapInstance;
          if (mapInstance && mapInstance.getMap) {
            try {
              const map = mapInstance.getMap();
              if (map) {
                // Remove any existing listener to prevent duplicates
                map.off('style.load', handleStyleLoad);
                // Add style.load event listener for reliable style loading detection
                map.on('style.load', handleStyleLoad);
              }
            } catch (error) {
              console.warn('Error setting up map style.load listener:', error);
            }
          }
        }}
      >
        {/* Only render MapSources when style is fully loaded and data is available */}
        {data && isStyleLoaded && (
          <PASchoolDistrictsMapSources 
            data={data} 
            selectedDistrict={selectedInfo?.districtName} 
          />
        )}
      </MapboxDefaultMap>
      
      {/* Show district info popup */}
      {selectedInfo && (
        <DistrictInfo 
          info={selectedInfo} 
          onClose={closeDistrictInfo}
        />
      )}
    </div>
  );
}


import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useData } from '../hooks/useData';
import toast from 'react-hot-toast';
import CountryInfo, { CountryInfoData } from './CountryInfo';
import ComparePopup, { CompareInfo } from './ComparePopup';
import ReactGA4 from 'react-ga4';
import MapboxDefaultMap from '../util/MapboxDefaultMap';
import MapSources from './MapSources';
import { MapboxEvent, MapStyleDataEvent } from 'react-map-gl';
import { useMapQuery } from '../hooks/useMapQuery';
import { useCompare } from '../contexts/CompareContext';
import { useSettings } from '../contexts/SettingsContext';
import { useYearRouting } from '../hooks/useYearRouting';
import { Feature, MultiPolygon } from 'geojson';
import bbox from '@turf/bbox';

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
  const [compareInfo, setCompareInfo] = useState<CompareInfo | undefined>();
  const { viewState, updateMapView, isReady } = useMapQuery();
  const { compareState, cancelCompare } = useCompare();
  const { settings } = useSettings();
  const { setYear } = useYearRouting();
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

  // Clear selected info when data changes, but keep compare info in compare mode
  useEffect(() => {
    setSelectedInfo(undefined);
    if (!compareState.isCompareMode) {
      setCompareInfo(undefined);
    }
  }, [data, compareState.isCompareMode]);

  // Clear compare info when AI Compare is disabled or compare mode is turned off
  useEffect(() => {
    if (!compareState.isCompareMode || !settings.aiCompareEnabled) {
      setCompareInfo(undefined);
    }
    
    // If AI Compare is disabled while in compare mode, fully exit compare mode
    if (!settings.aiCompareEnabled && compareState.isCompareMode) {
      cancelCompare();
    }
  }, [compareState.isCompareMode, settings.aiCompareEnabled, cancelCompare]);

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

  const handleStyleData = useCallback((e: MapStyleDataEvent) => {
    // Style data event fired, set flag to allow MapSources rendering
    if (!hasSetStyleRef.current) {
      setIsWaitingForStyleLoad(false);
      hasSetStyleRef.current = true;
    }
  }, []);

  const handleLoad = useCallback(() => {
    // Map is loaded, but style might still be loading
    setIsWaitingForStyleLoad(false);
  }, []);

  const handleViewStateChange = useCallback(({ viewState: newViewState }) => {
    // Use debounced update for smooth map movement
    updateMapView(
      newViewState.longitude, 
      newViewState.latitude, 
      newViewState.zoom
    );
  }, [updateMapView]);

  const handleClick = useCallback(({ originalEvent, features, lngLat }) => {
    if (!features?.length) {
      // Clear selections when clicking empty space, but only if not in compare mode
      if (!compareState.isCompareMode) {
        setSelectedInfo(undefined);
        setCompareInfo(undefined);
      }
      return;
    }
    
    const feature = features[0];
    const place = feature.properties?.NAME;
    originalEvent.stopPropagation();
    
    // Get coordinates for popup positioning
    const coordinates = lngLat.toArray() as [number, number];
    
    if (compareState.isCompareMode && settings.aiCompareEnabled) {
      // In compare mode, update compare info
      setCompareInfo({
        place,
        year,
        position: coordinates,
      });
      setSelectedInfo(undefined); // Clear normal info popup
      
      ReactGA4.event({
        category: 'AI Compare',
        action: 'country_clicked_in_compare_mode',
        label: place || 'unknown',
        value: 1,
      });
    } else {
      // Normal mode, update country info
      setSelectedInfo({
        place,
      });
      setCompareInfo(undefined); // Clear compare popup
      
      ReactGA4.event({
        category: 'Country',
        action: 'click',
        label: place || 'unknown',
        value: 1,
      });
    }
  }, [compareState.isCompareMode, settings.aiCompareEnabled, year]);

  const closeCountryInfo = useCallback(() => {
    setSelectedInfo(undefined);
  }, []);

  const closeComparePopup = useCallback(() => {
    setCompareInfo(undefined);
    // Also cancel compare mode when closing the popup
    if (compareState.isCompareMode) {
      cancelCompare();
    }
  }, [compareState.isCompareMode, cancelCompare]);

  const handleStartCompare = useCallback((countryName: string, year: string) => {
    // When starting compare from CountryInfo, switch to compare mode
    // The compare context will handle the state, but we need to position the popup
    if (selectedInfo) {
      // Use current viewport center for popup positioning
      const coordinates: [number, number] = viewState && 
        typeof viewState.longitude === 'number' && 
        typeof viewState.latitude === 'number' && 
        !isNaN(viewState.longitude) && 
        !isNaN(viewState.latitude) 
        ? [viewState.longitude, viewState.latitude] 
        : [10, 50]; // Default to somewhere in Europe instead of [0,0]
      
      setCompareInfo({
        place: countryName,
        year,
        position: coordinates,
      });
      setSelectedInfo(undefined);
    }
  }, [selectedInfo, viewState]);

  const handleCountryClick = useCallback((countryName: string, targetYear: string) => {
    // Navigate to the target year if different
    if (targetYear !== year) {
      setYear(targetYear);
    }

    // Find the country in the current data to center the map
    const findAndCenterCountry = (countryData: typeof data) => {
      if (!countryData || !mapRef.current) return;

      // Find the country feature in the borders data
      const countryFeature = countryData.borders.features.find(
        (feature: Feature) => feature.properties?.NAME === countryName
      );

      if (countryFeature && countryFeature.geometry) {
        try {
          // Calculate bounding box of the country
          const boundingBox = bbox(countryFeature);
          const [minLng, minLat, maxLng, maxLat] = boundingBox;

          // Get the map instance
          const map = mapRef.current.getMap();
          
          // Fit the map to the country bounds with some padding
          map.fitBounds(
            [[minLng, minLat], [maxLng, maxLat]],
            {
              padding: 50,
              duration: 1500,
              essential: true
            }
          );

          // Highlight the country by setting it as selected
          if (compareState.isCompareMode) {
            // In compare mode, update or create compareInfo to highlight the country
            setCompareInfo(prev => prev ? { ...prev, place: countryName } : {
              place: countryName,
              year: targetYear,
              position: [0, 0] // Will be updated if user clicks on map
            });
          } else {
            setSelectedInfo({ place: countryName });
          }

          ReactGA4.event({
            category: 'AI Compare',
            action: 'country_navigated_from_comparison',
            label: `${countryName}_${targetYear}`,
            value: 1,
          });
        } catch (error) {
          console.warn('Failed to center map on country:', countryName, error);
          
          // Fallback: just highlight the country without centering
          if (compareState.isCompareMode) {
            // In compare mode, update or create compareInfo to highlight the country
            setCompareInfo(prev => prev ? { ...prev, place: countryName } : {
              place: countryName,
              year: targetYear,
              position: [0, 0] // Will be updated if user clicks on map
            });
          } else {
            setSelectedInfo({ place: countryName });
          }
        }
      }
    };

    // If year is changing, we need to wait for new data to load
    if (targetYear !== year) {
      // The data will update automatically when year changes
      // We'll handle centering in a useEffect
      const timeoutId = setTimeout(() => {
        findAndCenterCountry(data);
      }, 500); // Wait a bit for data to load

      return () => clearTimeout(timeoutId);
    } else {
      // Same year, center immediately
      findAndCenterCountry(data);
    }
  }, [year, setYear, data, mapRef, compareState.isCompareMode]);

  // Effect to center on country when data changes (for year navigation)
  useEffect(() => {
    // This will be set by the handleCountryClick callback when year changes
    // We could store the target country in state, but for now we'll rely on
    // the timeout in handleCountryClick
  }, [data]);

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
          <MapSources 
            data={data} 
            places={places} 
            selectedCountry={selectedInfo?.place || compareInfo?.place} 
          />
        )}
      </MapboxDefaultMap>
      
      {/* Show normal country info popup only when not in compare mode */}
      {!compareState.isCompareMode && selectedInfo && (
        <CountryInfo 
          info={selectedInfo} 
          year={year} 
          onClose={closeCountryInfo}
          onStartCompare={handleStartCompare}
        />
      )}
      
      {/* Show compare popup when in compare mode and AI compare is enabled */}
      {compareState.isCompareMode && settings.aiCompareEnabled && (compareInfo || compareState.currentComparison) && (
        <ComparePopup 
          info={compareInfo} 
          onClose={closeComparePopup}
          onCountryClick={handleCountryClick}
        />
      )}
    </div>
  );
}

import React, {
  ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import Map, {
  MapLayerMouseEvent,
  MapRef,
  NavigationControl,
  ViewStateChangeEvent,
} from 'react-map-gl';
import type { StyleSpecification } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  hasMapView,
  MapView,
  parseMapView,
  writeMapView,
} from '../../lib/mapView';

export type FeatureProperties = Record<string, unknown>;

type Bounds = [[number, number], [number, number]];

interface MapCanvasProps {
  mapStyle: string | StyleSpecification;
  /** Used when the URL has no `lng`/`lat`. Bounds take precedence over a view. */
  fallbackView?: MapView;
  fallbackBounds?: Bounds;
  maxBounds?: Bounds;
  minZoom?: number;
  maxZoom?: number;
  interactiveLayerId: string;
  onFeatureClick: (properties: FeatureProperties | undefined) => void;
  customAttribution?: string | string[];
  /** Layers render only once the style is ready, avoiding style-loading races. */
  children: ReactNode;
}

const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function MapCanvas({
  mapStyle,
  fallbackView,
  fallbackBounds,
  maxBounds,
  minZoom = 1,
  maxZoom = 12,
  interactiveLayerId,
  onFeatureClick,
  customAttribution,
  children,
}: MapCanvasProps) {
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [cursor, setCursor] = useState<string>('');

  // Read the shared position once; afterwards the map owns its camera.
  const initialViewState = useMemo(() => {
    const search = typeof window === 'undefined' ? '' : window.location.search;
    if (!hasMapView(search) && fallbackBounds) {
      return { bounds: fallbackBounds, fitBoundsOptions: { padding: 32 } };
    }
    return parseMapView(search, fallbackView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoad = useCallback(() => setLoaded(true), []);

  const handleMoveEnd = useCallback((event: ViewStateChangeEvent) => {
    const { longitude, latitude, zoom } = event.viewState;
    writeMapView({ longitude, latitude, zoom });
  }, []);

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      onFeatureClick(
        feature?.properties
          ? (feature.properties as FeatureProperties)
          : undefined,
      );
    },
    [onFeatureClick],
  );

  if (!token) {
    return (
      <div className="map-canvas map-canvas--unavailable" role="alert">
        The map is unavailable because no Mapbox access token is configured.
      </div>
    );
  }

  return (
    <div className="map-canvas">
      <Map
        ref={mapRef}
        reuseMaps
        mapboxAccessToken={token}
        mapStyle={mapStyle}
        initialViewState={initialViewState}
        maxBounds={maxBounds}
        minZoom={minZoom}
        maxZoom={maxZoom}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
        interactiveLayerIds={loaded ? [interactiveLayerId] : []}
        cursor={cursor}
        onMouseEnter={() => setCursor('pointer')}
        onMouseLeave={() => setCursor('')}
        onLoad={handleLoad}
        onMoveEnd={handleMoveEnd}
        onClick={handleClick}
        customAttribution={customAttribution}
        style={{ position: 'absolute', inset: 0 }}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        {loaded && children}
      </Map>
    </div>
  );
}

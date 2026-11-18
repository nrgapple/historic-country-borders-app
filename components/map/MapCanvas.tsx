import React, {
  ReactNode,
  useCallback,
  useEffect,
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
  /** Zoom buttons; hidden in projector (focus) mode. */
  showNavigation?: boolean;
  /** Called once the map exists, for imperative camera moves. */
  onReady?: (map: MapRef) => void;
  /** Layers render only once the style is ready, avoiding style-loading races. */
  children: ReactNode;
}

const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * Mapbox GL needs WebGL. Some managed school devices and hardened browsers
 * disable it; without this check the map area would simply stay blank.
 */
export const supportsWebGL = (): boolean => {
  if (typeof document === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl'),
    );
  } catch {
    return false;
  }
};

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
  showNavigation = true,
  onReady,
  children,
}: MapCanvasProps) {
  const mapRef = useRef<MapRef | null>(null);
  const onReadyRef = useRef(onReady);
  const [loaded, setLoaded] = useState(false);
  const [cursor, setCursor] = useState<string>('');
  const [webgl] = useState(supportsWebGL);

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

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // Data layers need only a parsed style, not a fully rendered basemap.
  // 'style.load' fires before tiles arrive, so slow or blocked basemap tiles
  // (school networks, tests) never keep borders off the map. A reused map may
  // already have its style, so check before waiting. The map is also handed
  // over immediately: camera moves work before the style finishes.
  const attachMap = useCallback((ref: MapRef | null) => {
    mapRef.current = ref;
    if (!ref) return;
    onReadyRef.current?.(ref);
    const map = ref.getMap() as ReturnType<MapRef['getMap']> & {
      style?: { _loaded?: boolean };
    };
    if (map.style?._loaded) setLoaded(true);
    else map.once('style.load', () => setLoaded(true));
  }, []);

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

  if (!webgl) {
    return (
      <div className="map-canvas map-canvas--unavailable" role="alert">
        <p>
          <strong>This browser can’t draw the interactive map.</strong> It needs
          WebGL, which is turned off or unsupported on this device.
        </p>
        <p>
          Try another browser, turn on hardware acceleration, or ask your
          school’s IT team to allow WebGL. The timeline and place details still
          work.
        </p>
      </div>
    );
  }

  return (
    // `data-loaded` marks when the style is ready and data layers can mount.
    <div className="map-canvas" data-loaded={loaded || undefined}>
      <Map
        ref={attachMap}
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
        {showNavigation && (
          <NavigationControl position="bottom-right" showCompass={false} />
        )}
        {loaded && children}
      </Map>
    </div>
  );
}

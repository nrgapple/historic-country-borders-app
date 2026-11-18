import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapRef } from 'react-map-gl';
import { hasMapView, parsePlace, writePlace } from '../lib/mapView';
import { Bounds, focusPadding, paddingOffset } from '../lib/places';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

const fitMap = (map: MapRef, bounds: Bounds, maxZoom: number) => {
  const container = map.getContainer();
  const box = container.getBoundingClientRect();
  const topbar = document.querySelector('.topbar')?.getBoundingClientRect();
  const padding = focusPadding({
    width: container.clientWidth,
    height: container.clientHeight,
    topbarBottom: topbar ? Math.max(0, topbar.bottom - box.top) : 0,
  });
  const camera = map.cameraForBounds(bounds, { padding, maxZoom });
  if (!camera) return;
  // Move with `offset` rather than `padding`: Mapbox keeps padding on the
  // camera, which would skew the centre written to shared links.
  map.easeTo({
    ...camera,
    offset: paddingOffset(padding),
    duration: prefersReducedMotion() ? 0 : 900,
  });
};

/**
 * Frames places on the map. Pass `onMapReady` to the map; `focusBounds` can be
 * called before the map has loaded and is applied once it does.
 */
export function useMapFocus(maxZoom: number) {
  const mapRef = useRef<MapRef>();
  const pending = useRef<Bounds>();

  const onMapReady = useCallback(
    (map: MapRef) => {
      mapRef.current = map;
      if (pending.current) {
        fitMap(map, pending.current, maxZoom);
        pending.current = undefined;
      }
    },
    [maxZoom],
  );

  const focusBounds = useCallback(
    (bounds: Bounds | undefined) => {
      if (!bounds) return;
      if (mapRef.current) fitMap(mapRef.current, bounds, maxZoom);
      else pending.current = bounds;
    },
    [maxZoom],
  );

  return { onMapReady, focusBounds };
}

interface SharedPlaceOptions {
  /** True once the features a shared place could refer to have loaded. */
  ready: boolean;
  selectedName: string | undefined;
  /**
   * Selects a shared place if it exists in the loaded data. `frame` is true
   * when the link has no map position, so the place should be framed.
   */
  restore: (name: string, frame: boolean) => void;
  /** Rewrites `?place=` when this changes too, e.g. after a year change. */
  syncKey?: unknown;
}

/**
 * Keeps the selected place in `?place=`. The shared value is validated and
 * restored once the data is ready; until then the URL is left untouched so a
 * slow load cannot erase a shared link.
 */
export function useSharedPlace({
  ready,
  selectedName,
  restore,
  syncKey,
}: SharedPlaceOptions) {
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!ready || restored) return;
    const { search } = window.location;
    const name = parsePlace(search);
    if (name) restore(name, !hasMapView(search));
    setRestored(true);
  }, [ready, restored, restore]);

  useEffect(() => {
    if (restored) writePlace(selectedName);
  }, [restored, selectedName, syncKey]);
}

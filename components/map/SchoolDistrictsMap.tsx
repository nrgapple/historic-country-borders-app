import React from 'react';
import MapCanvas, { FeatureProperties } from './MapCanvas';
import BorderLayers from './BorderLayers';
import { useSettings } from '../../contexts/SettingsContext';
import { SCHOOL_MAP_STYLE_URL } from '../../lib/mapStyle';
import type { CountryData } from '../../util/types';

/** Pennsylvania with a margin: [[west, south], [east, north]]. */
export const PA_BOUNDS: [[number, number], [number, number]] = [
  [-80.6, 39.7],
  [-74.7, 42.3],
];
/**
 * Mapbox raises the zoom until the whole viewport fits inside maxBounds, so on
 * a tall 390 × 844 phone the bounds must span about 35°N–46.5°N for PA_BOUNDS
 * to fit (zoom ≈ 5.3). The margin also covers 320 px phones (zoom ≈ 4.9).
 */
export const MAX_BOUNDS: [[number, number], [number, number]] = [
  [-86.5, 34],
  [-68.8, 47.5],
];
/** Low enough for the state to fit on a 320 px phone. */
export const PA_MIN_ZOOM = 4.5;

interface SchoolDistrictsMapProps {
  data: CountryData | undefined;
  selectedName?: string;
  onSelect: (properties: FeatureProperties | undefined) => void;
}

export default function SchoolDistrictsMap({
  data,
  selectedName,
  onSelect,
}: SchoolDistrictsMapProps) {
  const { settings } = useSettings();

  return (
    <MapCanvas
      mapStyle={SCHOOL_MAP_STYLE_URL}
      fallbackBounds={PA_BOUNDS}
      maxBounds={MAX_BOUNDS}
      minZoom={PA_MIN_ZOOM}
      maxZoom={14}
      interactiveLayerId="districts"
      onFeatureClick={onSelect}
      customAttribution='Districts: <a href="https://www.pasda.psu.edu/" target="_blank" rel="noreferrer">PASDA / PennDOT</a>'
    >
      {data && (
        <BorderLayers
          id="districts"
          data={data}
          selectedName={selectedName}
          settings={settings}
          labelZoom={[6.5, 11]}
        />
      )}
    </MapCanvas>
  );
}

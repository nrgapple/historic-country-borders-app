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
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [-83.5, 38.2],
  [-71.8, 43.8],
];

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
      minZoom={5}
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

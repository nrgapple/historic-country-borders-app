import React from 'react';
import MapCanvas, { FeatureProperties } from './MapCanvas';
import BorderLayers from './BorderLayers';
import { useSettings } from '../../contexts/SettingsContext';
import { HISTORICAL_BASEMAP } from '../../lib/basemap';
import type { BordersEndpointData } from '../../util/types';

interface HistoricalMapProps {
  data: BordersEndpointData | undefined;
  selectedName?: string;
  onSelect: (properties: FeatureProperties | undefined) => void;
}

export default function HistoricalMap({
  data,
  selectedName,
  onSelect,
}: HistoricalMapProps) {
  const { settings } = useSettings();

  return (
    <MapCanvas
      mapStyle={HISTORICAL_BASEMAP}
      interactiveLayerId="borders"
      onFeatureClick={onSelect}
      maxZoom={10}
      customAttribution='Borders: <a href="https://github.com/aourednik/historical-basemaps" target="_blank" rel="noreferrer">historical-basemaps</a> (GPL-3.0)'
    >
      {data && (
        <BorderLayers
          id="borders"
          data={data.data}
          places={data.places}
          selectedName={selectedName}
          settings={settings}
          labelZoom={[2, 7]}
        />
      )}
    </MapCanvas>
  );
}

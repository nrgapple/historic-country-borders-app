import React from 'react';
import { Layer, Source, useMap } from 'react-map-gl';
import type { ExpressionSpecification } from 'mapbox-gl';
import type { FeatureCollection, Point } from 'geojson';
import type { Settings } from '../../contexts/SettingsContext';
import type { CountryData } from '../../util/types';
import {
  borderWidthExpression,
  fillColorExpression,
  fillOpacityExpression,
  HALO,
  INK,
  LABEL_FONT,
  labelSizeExpression,
  placeSizeExpression,
  SELECTED_STROKE,
  selectedWidthExpression,
} from '../../lib/mapStyle';

interface BorderLayersProps {
  /** Source/layer id prefix; the fill layer id equals the prefix. */
  id: string;
  data: CountryData;
  places?: FeatureCollection<Point>;
  selectedName?: string;
  settings: Settings;
  /** Zoom range over which label size interpolates. */
  labelZoom: [number, number];
}

/** Larger territories claim label space first. */
const labelSortKey = [
  '-',
  ['to-number', ['get', 'AREA'], 0],
] as unknown as ExpressionSpecification;

export default function BorderLayers({
  id,
  data,
  places,
  selectedName,
  settings,
  labelZoom,
}: BorderLayersProps) {
  const { current: map } = useMap();
  const transform = settings.textCase === 'upper' ? 'uppercase' : 'none';
  // Keep the selection outline beneath labels when they already exist.
  const labelsId = `${id}-labels`;
  const selectedBeforeId =
    settings.showLabels && map?.getLayer(labelsId) ? labelsId : undefined;

  return (
    <>
      <Source id={id} type="geojson" data={data.borders} tolerance={0.45}>
        <Layer
          id={id}
          type="fill"
          paint={{
            'fill-color': fillColorExpression,
            'fill-opacity': fillOpacityExpression(
              settings.countryOpacity,
              selectedName,
            ),
          }}
        />
        <Layer
          id={`${id}-outline`}
          type="line"
          layout={{ 'line-join': 'round' }}
          paint={{
            'line-color': INK,
            'line-opacity': 0.55,
            'line-width': borderWidthExpression(settings.borderThickness),
          }}
        />
        {selectedName && (
          <Layer
            id={`${id}-selected`}
            type="line"
            beforeId={selectedBeforeId}
            filter={['==', ['get', 'NAME'], selectedName]}
            layout={{ 'line-join': 'round' }}
            paint={{
              'line-color': SELECTED_STROKE,
              'line-width': selectedWidthExpression(settings.borderThickness),
            }}
          />
        )}
      </Source>

      {settings.showLabels && (
        <Source id={`${id}-labels`} type="geojson" data={data.labels}>
          <Layer
            id={`${id}-labels`}
            type="symbol"
            layout={{
              'text-field': ['get', 'NAME'],
              'text-font': LABEL_FONT,
              'text-size': labelSizeExpression(settings.textSize, labelZoom),
              'text-transform': transform,
              'text-letter-spacing':
                settings.textCase === 'upper' ? 0.12 : 0.04,
              'text-max-width': 8,
              'text-padding': 4,
              'symbol-sort-key': labelSortKey,
            }}
            paint={{
              'text-color': INK,
              'text-halo-color': HALO,
              'text-halo-width': 1.6,
              'text-halo-blur': 0.4,
            }}
          />
        </Source>
      )}

      {settings.showLabels && places && places.features.length > 0 && (
        <Source id={`${id}-places`} type="geojson" data={places}>
          <Layer
            id={`${id}-places-dot`}
            type="circle"
            minzoom={3.5}
            paint={{
              'circle-color': INK,
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                2.5,
                1.6,
                8,
                3.5,
              ],
              'circle-stroke-color': '#FFFDF8',
              'circle-stroke-width': 1,
            }}
          />
          <Layer
            id={`${id}-places-label`}
            type="symbol"
            minzoom={3.5}
            layout={{
              'text-field': ['get', 'name'],
              'text-font': LABEL_FONT,
              'text-size': placeSizeExpression(settings.textSize),
              'text-transform': transform,
              'text-anchor': 'top',
              'text-offset': [0, 0.5],
              'text-max-width': 7,
              'text-optional': true,
            }}
            paint={{
              'text-color': '#4A453E',
              'text-halo-color': HALO,
              'text-halo-width': 1.4,
            }}
          />
        </Source>
      )}
    </>
  );
}

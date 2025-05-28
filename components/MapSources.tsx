import React from 'react';
import { Source, Layer } from 'react-map-gl';
import { BordersEndpointData } from '../util/types';
import { invertColor } from '../util/constants';

interface MapSourcesProps {
  data: BordersEndpointData['data'];
  places: BordersEndpointData['places'];
  selectedCountry?: string;
}

export default function MapSources({ data, places, selectedCountry }: MapSourcesProps) {
  const renderBordersLayer = () => (
    <Source id="borders" type="geojson" data={data.borders}>
      <Layer
        {...{
          id: 'borders',
          type: 'fill',
          paint: {
            'fill-color': ['get', 'COLOR'],
            'fill-opacity': 0.85,
            'fill-outline-color': '#000000',
          },
        }}
      />
      <Layer
        {...{
          id: 'borders-outline',
          type: 'line',
          paint: {
            'line-color': selectedCountry 
              ? [
                  'case',
                  ['==', ['get', 'NAME'], selectedCountry],
                  '#000000', // Black outline for selected country
                  '#000000'  // Default black for others
                ]
              : '#000000',
            'line-width': [
              'interpolate',
              ['exponential', 1],
              ['zoom'],
              3, selectedCountry 
                ? [
                    'case',
                    ['==', ['get', 'NAME'], selectedCountry],
                    5,
                    1.2
                  ]
                : 1.2,
              8, selectedCountry 
                ? [
                    'case',
                    ['==', ['get', 'NAME'], selectedCountry],
                    10,
                    3
                  ]
                : 3
            ],
            'line-opacity': 1,
          },
        }}
      />
      {/* Add a bright inner border for selected country */}
      {selectedCountry && (
        <Layer
          {...{
            id: 'borders-selected-highlight',
            type: 'line',
            source: 'borders',
            filter: ['==', ['get', 'NAME'], selectedCountry],
            paint: {
              'line-color': '#00FFFF', // Bright cyan for high contrast
              'line-width': [
                'interpolate',
                ['exponential', 1],
                ['zoom'],
                3, 3,
                8, 6
              ],
              'line-opacity': 1,
            },
          }}
        />
      )}
    </Source>
  );

  const renderLabelsLayer = () => (
    <Source id="labels" type="geojson" data={data.labels}>
      <Layer
        {...{
          id: 'labels',
          type: 'symbol',
          paint: {
            'text-color': '#000000',
            'text-halo-color': '#FFFFFF',
            'text-halo-width': 2.5,
            'text-halo-blur': 0.5,
          },
          layout: {
            'text-field': '{NAME}',
            'text-font': ['Lato Bold'],
            'text-size': [
              'interpolate',
              ['exponential', 1],
              ['zoom'],
              4, 9,
              8, 22
            ],
            'text-padding': 5,
            'text-letter-spacing': 0.2,
            'text-max-width': 10,
            'text-transform': 'uppercase',
          },
        }}
      />
    </Source>
  );

  const renderPlacesLayer = () => (
    <Source id="places" type="geojson" data={places}>
      <Layer
        {...{
          id: 'places',
          type: 'symbol',
          paint: {
            'text-color': '#000000',
            'text-halo-color': '#FFFFFF',
            'text-halo-width': 2,
            'icon-color': '#FF0000',
            'icon-halo-color': '#FFFFFF',
            'icon-halo-width': 1.5,
          },
          layout: {
            'text-field': '{name}',
            'text-font': ['Lato Bold'],
            'text-size': [
              'interpolate',
              ['exponential', 1],
              ['zoom'],
              3, 0.02,
              6, 12
            ],
            'text-padding': 3,
            'text-letter-spacing': 0.1,
            'text-max-width': 7,
            'text-transform': 'uppercase',
            'text-offset': [0, 2],
            'icon-allow-overlap': true,
            'icon-image': 'circle',
            'icon-size': [
              'interpolate',
              ['exponential', 1],
              ['zoom'],
              3, 0.02,
              8, 0.7
            ],
          },
        }}
      />
    </Source>
  );

  return (
    <>
      {renderBordersLayer()}
      {renderLabelsLayer()}
      {renderPlacesLayer()}
    </>
  );
}

import React from 'react';
import { Source, Layer } from 'react-map-gl';
import { BordersEndpointData } from '../util/types';

interface MapSourcesProps {
  data: BordersEndpointData['data'];
  places: BordersEndpointData['places'];
}

export default function MapSources({ data, places }: MapSourcesProps) {
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
            'line-color': '#000000',
            'line-width': {
              base: 1,
              stops: [
                [3, 1.2],
                [8, 3],
              ],
            },
            'line-opacity': 1,
          },
        }}
      />
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
            'text-size': {
              base: 1,
              stops: [
                [4, 9],
                [8, 22],
              ],
            },
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
            'text-size': {
              base: 1,
              stops: [
                [3, 0.02],
                [6, 12],
              ],
            },
            'text-padding': 3,
            'text-letter-spacing': 0.1,
            'text-max-width': 7,
            'text-transform': 'uppercase',
            'text-offset': [0, 2],
            'icon-allow-overlap': true,
            'icon-image': 'circle',
            'icon-size': {
              base: 1,
              stops: [
                [3, 0.02],
                [8, 0.7],
              ],
            },
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

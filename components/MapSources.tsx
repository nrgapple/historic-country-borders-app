import React, { useEffect } from 'react';
import { Source, Layer } from 'react-map-gl';
import { BordersEndpointData } from '../util/types';
import { invertColor } from '../util/constants';
import { useSettings } from '../contexts/SettingsContext';
import ReactGA4 from 'react-ga4';

interface MapSourcesProps {
  data: BordersEndpointData['data'];
  places: BordersEndpointData['places'];
  selectedCountry?: string;
}

export default function MapSources({ data, places, selectedCountry }: MapSourcesProps) {
  const { settings } = useSettings();

  // Track settings impact on map rendering
  useEffect(() => {
    ReactGA4.event('map_render_with_settings', {
      text_size: settings.textSize,
      text_case: settings.textCase,
      country_opacity: Math.round(settings.countryOpacity * 100),
      settings_combination: `${settings.textSize}_${settings.textCase}_${Math.round(settings.countryOpacity * 100)}`
    });

    // Track accessibility features usage
    if (settings.textSize === 'large') {
      ReactGA4.event('accessibility_feature_used', {
        feature_type: 'large_text',
        element: 'map_labels',
        text_size: settings.textSize
      });
    }

    if (settings.textCase === 'upper') {
      ReactGA4.event('text_formatting_applied', {
        formatting_type: 'uppercase',
        element: 'map_labels',
        text_case: settings.textCase
      });
    }

    // Track opacity preferences for visual customization
    if (settings.countryOpacity <= 0.3) {
      ReactGA4.event('visual_preference_low_opacity', {
        opacity_level: 'low',
        opacity_value: Math.round(settings.countryOpacity * 100),
        element: 'country_borders'
      });
    } else if (settings.countryOpacity >= 0.9) {
      ReactGA4.event('visual_preference_high_opacity', {
        opacity_level: 'high',
        opacity_value: Math.round(settings.countryOpacity * 100),
        element: 'country_borders'
      });
    }
  }, [settings]);

  // Track selected country interactions with current settings
  useEffect(() => {
    if (selectedCountry) {
      ReactGA4.event('country_selected_with_settings', {
        country_name: selectedCountry,
        text_size: settings.textSize,
        text_case: settings.textCase,
        country_opacity: Math.round(settings.countryOpacity * 100)
      });
    }
  }, [selectedCountry, settings.textSize, settings.textCase]);

  const renderBordersLayer = () => (
    <Source id="borders" type="geojson" data={data.borders}>
      <Layer
        {...{
          id: 'borders',
          type: 'fill',
          paint: {
            'fill-color': ['get', 'COLOR'],
            'fill-opacity': settings.countryOpacity,
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

  const renderLabelsLayer = () => {
    // Calculate base font sizes based on text size setting
    const getTextSizes = () => {
      switch (settings.textSize) {
        case 'small':
          return { min: 7, max: 18 };
        case 'large':
          return { min: 11, max: 26 };
        case 'medium':
        default:
          return { min: 9, max: 22 };
      }
    };

    const { min, max } = getTextSizes();

    return (
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
                4, min,
                8, max
              ],
              'text-padding': 5,
              'text-letter-spacing': 0.2,
              'text-max-width': 10,
              'text-transform': settings.textCase === 'upper' ? 'uppercase' : 'none',
            },
          }}
        />
      </Source>
    );
  };

  const renderPlacesLayer = () => {
    // Calculate base font sizes for places based on text size setting
    const getPlaceTextSizes = () => {
      switch (settings.textSize) {
        case 'small':
          return { min: 0.015, max: 10 };
        case 'large':
          return { min: 0.025, max: 14 };
        case 'medium':
        default:
          return { min: 0.02, max: 12 };
      }
    };

    const { min, max } = getPlaceTextSizes();

    return (
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
                3, min,
                6, max
              ],
              'text-padding': 3,
              'text-letter-spacing': 0.1,
              'text-max-width': 7,
              'text-transform': settings.textCase === 'upper' ? 'uppercase' : 'none',
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
  };

  return (
    <>
      {renderBordersLayer()}
      {renderLabelsLayer()}
      {renderPlacesLayer()}
    </>
  );
}

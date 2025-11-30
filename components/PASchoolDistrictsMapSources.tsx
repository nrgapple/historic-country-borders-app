import React, { useEffect } from 'react';
import { Source, Layer } from 'react-map-gl';
import { BordersEndpointData } from '../util/types';
import { useSettings } from '../contexts/SettingsContext';
import ReactGA4 from 'react-ga4';

interface PASchoolDistrictsMapSourcesProps {
  data: BordersEndpointData['data'];
  selectedDistrict?: string;
}

export default function PASchoolDistrictsMapSources({ 
  data, 
  selectedDistrict 
}: PASchoolDistrictsMapSourcesProps) {
  const { settings } = useSettings();

  // Track settings impact on map rendering
  useEffect(() => {
    ReactGA4.event('map_render_with_settings', {
      text_size: settings.textSize,
      text_case: settings.textCase,
      country_opacity: Math.round(settings.countryOpacity * 100),
      border_thickness: settings.borderThickness,
      show_labels: settings.showLabels,
      settings_combination: `${settings.textSize}_${settings.textCase}_${Math.round(settings.countryOpacity * 100)}_${settings.borderThickness}px_${settings.showLabels ? 'labels' : 'nolabels'}`
    });
  }, [settings]);

  // Track selected district interactions with current settings
  useEffect(() => {
    if (selectedDistrict) {
      ReactGA4.event('district_selected_with_settings', {
        district_name: selectedDistrict,
        text_size: settings.textSize,
        text_case: settings.textCase,
        country_opacity: Math.round(settings.countryOpacity * 100),
        border_thickness: settings.borderThickness,
        show_labels: settings.showLabels
      });
    }
  }, [selectedDistrict, settings.textSize, settings.textCase, settings.countryOpacity, settings.borderThickness, settings.showLabels]);

  const renderBordersLayer = () => (
    <Source id="districts" type="geojson" data={data.borders}>
      <Layer
        {...{
          id: 'districts',
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
          id: 'districts-outline',
          type: 'line',
          paint: {
            'line-color': selectedDistrict 
              ? [
                  'case',
                  ['==', ['get', 'NAME'], selectedDistrict],
                  '#000000', // Black outline for selected district
                  '#000000'  // Default black for others
                ]
              : '#000000',
            'line-width': [
              'interpolate',
              ['exponential', 1],
              ['zoom'],
              6, selectedDistrict 
                ? [
                    'case',
                    ['==', ['get', 'NAME'], selectedDistrict],
                    Math.max(settings.borderThickness * 2.5, 2), // Selected district gets thicker border, minimum 2px
                    settings.borderThickness * 0.6  // Base thickness for non-selected districts (can be 0)
                  ]
                : settings.borderThickness * 0.6,
              10, selectedDistrict 
                ? [
                    'case',
                    ['==', ['get', 'NAME'], selectedDistrict],
                    Math.max(settings.borderThickness * 5, 4),   // Selected district gets much thicker at higher zoom, minimum 4px
                    settings.borderThickness * 1.5  // Base thickness * 1.5 for non-selected at higher zoom (can be 0)
                  ]
                : settings.borderThickness * 1.5
            ],
            'line-opacity': 1,
          },
        }}
      />
      {/* Add a bright inner border for selected district */}
      {selectedDistrict && (
        <Layer
          {...{
            id: 'districts-selected-highlight',
            type: 'line',
            source: 'districts',
            filter: ['==', ['get', 'NAME'], selectedDistrict],
            paint: {
              'line-color': '#00FFFF', // Bright cyan for high contrast
              'line-width': [
                'interpolate',
                ['exponential', 1],
                ['zoom'],
                6, Math.max(settings.borderThickness * 1.5, 1.5),
                10, Math.max(settings.borderThickness * 3, 3)
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
                6, min,
                10, max
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

  return (
    <>
      {renderBordersLayer()}
      {settings.showLabels && renderLabelsLayer()}
    </>
  );
}


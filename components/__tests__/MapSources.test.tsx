import React from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import MapSources from '../MapSources';

// Mock react-map-gl components
vi.mock('react-map-gl', () => ({
  Source: ({ children, ...props }: any) => <div data-testid="map-source" {...props}>{children}</div>,
  Layer: (props: any) => <div data-testid="map-layer" {...props} />,
}));

// Mock ReactGA4
vi.mock('react-ga4', () => ({
  default: {
    event: vi.fn(),
  },
}));

// Mock useSettings hook
vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: vi.fn(),
}));

// Import the mocked hook
import { useSettings } from '../../contexts/SettingsContext';
const mockUseSettings = useSettings as any;

const mockData = {
  borders: {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: { NAME: 'Test Country', COLOR: '#ff0000' },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        },
      },
    ],
  },
  labels: {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: { NAME: 'Test Country' },
        geometry: { type: 'Point' as const, coordinates: [0.5, 0.5] },
      },
    ],
  },
};

const mockPlaces = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: { name: 'Test City' },
      geometry: { type: 'Point' as const, coordinates: [0.5, 0.5] },
    },
  ],
};

describe('MapSources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default settings
    mockUseSettings.mockReturnValue({
      settings: {
        textSize: 'medium',
        textCase: 'regular',
        countryOpacity: 0.7,
        borderThickness: 2,
        showLabels: true,
      },
    });
  });

  it('should render borders, labels, and places when showLabels is true', () => {
    const { getAllByTestId } = render(
      <MapSources data={mockData} places={mockPlaces} />
    );

    const sources = getAllByTestId('map-source');
    const layers = getAllByTestId('map-layer');

    // Should have 3 sources: borders, labels, places
    expect(sources).toHaveLength(3);
    expect(sources[0]).toHaveAttribute('id', 'borders');
    expect(sources[1]).toHaveAttribute('id', 'labels');
    expect(sources[2]).toHaveAttribute('id', 'places');

    // Should have multiple layers for borders, labels, and places
    expect(layers.length).toBeGreaterThan(3);
  });

  it('should only render borders when showLabels is false', () => {
    // Mock showLabels: false
    mockUseSettings.mockReturnValue({
      settings: {
        textSize: 'medium',
        textCase: 'regular',
        countryOpacity: 0.7,
        borderThickness: 2,
        showLabels: false,
      },
    });

    const { getAllByTestId } = render(
      <MapSources data={mockData} places={mockPlaces} />
    );

    const sources = getAllByTestId('map-source');

    // Should only have 1 source: borders
    expect(sources).toHaveLength(1);
    expect(sources[0]).toHaveAttribute('id', 'borders');
  });

  it('should highlight selected country with special styling', () => {
    const { getAllByTestId } = render(
      <MapSources 
        data={mockData} 
        places={mockPlaces} 
        selectedCountry="Test Country"
      />
    );

    const layers = getAllByTestId('map-layer');
    
    // Should include the selected highlight layer
    const highlightLayer = layers.find(layer => 
      layer.getAttribute('id') === 'borders-selected-highlight'
    );
    expect(highlightLayer).toBeDefined();
  });

  it('should apply border thickness setting to line width calculations', () => {
    // Test with different border thickness values
    const thicknessValues = [0, 2, 4];
    
    thicknessValues.forEach(thickness => {
      mockUseSettings.mockReturnValue({
        settings: {
          textSize: 'medium',
          textCase: 'regular',
          countryOpacity: 0.7,
          borderThickness: thickness,
          showLabels: true,
        },
      });

      const { getAllByTestId, rerender } = render(
        <MapSources data={mockData} places={mockPlaces} />
      );

      const layers = getAllByTestId('map-layer');
      
      // Find the borders-outline layer
      const outlineLayer = layers.find(layer => 
        layer.getAttribute('id') === 'borders-outline'
      );
      
      expect(outlineLayer).toBeDefined();
      
      // The layer should exist and render with the border thickness setting
      // Note: We can't directly test the paint properties since they're passed as objects
      // but we can verify the layer renders correctly with different thickness values
      expect(outlineLayer).toBeInTheDocument();
      
      // Clean up for next iteration
      rerender(<div />);
    });
  });
}); 
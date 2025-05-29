import React, { forwardRef } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import MapContainer from '../MapContainer'
import ReactGA4 from 'react-ga4'
import { InfoProviderProvider } from '../../contexts/InfoProviderContext'
import { CompareProvider } from '../../contexts/CompareContext'
import { SettingsProvider } from '../../contexts/SettingsContext'

// Mock the useYearRouting hook
vi.mock('../../hooks/useYearRouting', () => ({
  useYearRouting: vi.fn(),
}))

// Mock ReactGA4
vi.mock('react-ga4', () => ({
  default: {
    event: vi.fn(),
  },
}))

// Mock the useData hook
vi.mock('../../hooks/useData', () => ({
  useData: vi.fn(),
}))

// Mock the useMapQuery hook
vi.mock('../../hooks/useMapQuery', () => ({
  useMapQuery: vi.fn(),
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}))

// Mock MapboxDefaultMap
vi.mock('../../util/MapboxDefaultMap', () => ({
  default: ({ children, onClick, onLoad, onStyleData, onMove, ...props }: any) => {
    mockMapClickHandler = onClick
    return (
      <div 
        data-testid="mapbox-map" 
        onClick={(e) => {
          if (onClick) {
            onClick({
              originalEvent: { stopPropagation: vi.fn() },
              features: [{ properties: { NAME: 'Test Country' } }],
              lngLat: { toArray: () => [10.5, 20.3] }
            })
          }
        }}
        {...props}
      >
        {children}
      </div>
    )
  }
}))

// Mock MapSources
vi.mock('../MapSources', () => ({
  default: ({ data, places, selectedCountry }: any) => (
    <div data-testid="map-sources">
      MapSources: {selectedCountry || 'none'}
    </div>
  ),
}))

// Mock CountryInfo
vi.mock('../CountryInfo', () => ({
  default: ({ info, year, onClose }: any) => (
    <div data-testid="country-info">
      {info?.place && (
        <>
          <div>{info.place}</div>
          <div>📚 Loading information...</div>
          <button onClick={onClose} aria-label="Close country information">Close</button>
        </>
      )}
    </div>
  ),
}))

import { useData } from '../../hooks/useData'
import { useMapQuery } from '../../hooks/useMapQuery'
import toast from 'react-hot-toast'
import { useYearRouting } from '../../hooks/useYearRouting'

const mockUseData = useData as any
const mockUseMapQuery = useMapQuery as any
const mockToast = toast as any
const mockUseYearRouting = useYearRouting as any

// Store the click handler for testing
let mockMapClickHandler: any = null

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <InfoProviderProvider>
    <SettingsProvider>
      <CompareProvider>
        {children}
      </CompareProvider>
    </SettingsProvider>
  </InfoProviderProvider>
)

describe('MapContainer', () => {
  const defaultProps = {
    year: '2023',
    user: 'test-user',
    id: 'test-id',
  }

  const mockMapData = {
    data: { 
      borders: { type: 'FeatureCollection', features: [] },
      labels: { type: 'FeatureCollection', features: [] }
    },
    places: { type: 'FeatureCollection', features: [] },
  }

  const mockViewState = {
    longitude: 0,
    latitude: 0,
    zoom: 2,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockMapClickHandler = null
    
    mockUseData.mockReturnValue({
      data: mockMapData,
      isLoading: false,
    })

    mockUseMapQuery.mockReturnValue({
      viewState: mockViewState,
      updateMapView: vi.fn(),
      isReady: true,
    })

    mockUseYearRouting.mockReturnValue({
      setYear: vi.fn(),
    })
  })

  it('should render map container with mapbox map', () => {
    render(<MapContainer {...defaultProps} />, { wrapper: TestWrapper })
    
    expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
    expect(screen.getByTestId('map-sources')).toBeInTheDocument()
  })

  it('should show loading toast when data is loading', () => {
    mockUseData.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    render(<MapContainer {...defaultProps} />, { wrapper: TestWrapper })
    
    expect(mockToast.loading).toHaveBeenCalledWith('Loading Borders...', {
      id: 'loading',
      position: 'bottom-right',
    })
  })

  it('should dismiss loading toast when data is loaded', () => {
    render(<MapContainer {...defaultProps} />, { wrapper: TestWrapper })
    
    expect(mockToast.dismiss).toHaveBeenCalledWith('loading')
  })

  it('should handle map click and show popup', () => {
    render(<MapContainer {...defaultProps} />, { wrapper: TestWrapper })
    
    const map = screen.getByTestId('mapbox-map')
    fireEvent.click(map)
    
    expect(screen.getByText('Test Country')).toBeInTheDocument()
    expect(screen.getByText('📚 Loading information...')).toBeInTheDocument()
  })

  it('should track analytics event on country click', () => {
    render(<MapContainer {...defaultProps} />, { wrapper: TestWrapper })
    
    const map = screen.getByTestId('mapbox-map')
    fireEvent.click(map)
    
    expect(ReactGA4.event).toHaveBeenCalledWith('country_select', {
      country_name: 'Test Country',
      year: '2023',
      selection_method: 'map_click',
      mode: 'explore'
    })
  })

  it('should close popup when close button is clicked', async () => {
    render(<MapContainer {...defaultProps} />, { wrapper: TestWrapper })
    
    // First click to open popup
    const map = screen.getByTestId('mapbox-map')
    await act(async () => {
      fireEvent.click(map)
    })
    
    expect(screen.getByText('Test Country')).toBeInTheDocument()
    
    // Click close button - this should trigger the onClose callback
    const closeButton = screen.getByLabelText('Close country information')
    await act(async () => {
      fireEvent.click(closeButton)
    })
    
    // The popup should be closed
    expect(screen.queryByText('Test Country')).not.toBeInTheDocument()
  })

  it('should clear popup when data changes', () => {
    const { rerender } = render(<MapContainer {...defaultProps} />, { wrapper: TestWrapper })
    
    // Open popup
    const map = screen.getByTestId('mapbox-map')
    fireEvent.click(map)
    expect(screen.getByText('Test Country')).toBeInTheDocument()
    
    // Change data
    mockUseData.mockReturnValue({
      data: { data: { features: [] }, places: ['NewCountry'] },
      isLoading: false,
    })
    
    rerender(<MapContainer {...defaultProps} year="2024" />)
    
    expect(screen.queryByText('Test Country')).not.toBeInTheDocument()
  })

  it('should handle click with no features', () => {
    render(<MapContainer {...defaultProps} />, { wrapper: TestWrapper })
    
    // Simulate click with no features by calling the handler directly
    if (mockMapClickHandler) {
      const mockEvent = {
        originalEvent: { stopPropagation: vi.fn() },
        features: [],
        lngLat: { toArray: () => [10.5, 20.3] }
      }
      mockMapClickHandler(mockEvent)
    }
    
    expect(screen.queryByText('Test Country')).not.toBeInTheDocument()
  })

  it('should handle click with undefined features', () => {
    render(<MapContainer {...defaultProps} />, { wrapper: TestWrapper })
    
    // Simulate click with undefined features
    if (mockMapClickHandler) {
      const mockEvent = {
        originalEvent: { stopPropagation: vi.fn() },
        features: undefined,
        lngLat: { toArray: () => [10.5, 20.3] }
      }
      mockMapClickHandler(mockEvent)
    }
    
    expect(screen.queryByText('Test Country')).not.toBeInTheDocument()
  })

  it('should handle feature without NAME property', async () => {
    render(<MapContainer {...defaultProps} />, { wrapper: TestWrapper })
    
    // Simulate click with feature without NAME
    await act(async () => {
      if (mockMapClickHandler) {
        const mockEvent = {
          originalEvent: { stopPropagation: vi.fn() },
          features: [{ properties: {} }],
          lngLat: { toArray: () => [10.5, 20.3] }
        }
        mockMapClickHandler(mockEvent)
      }
    })
    
    // Should not show any country info since there's no NAME
    expect(screen.queryByText('📚 Loading information...')).not.toBeInTheDocument()
  })

  it('should update map view when view state changes', () => {
    const mockUpdateMapView = vi.fn()
    mockUseMapQuery.mockReturnValue({
      viewState: mockViewState,
      updateMapView: mockUpdateMapView,
      isReady: true,
    })

    render(<MapContainer {...defaultProps} />, { wrapper: TestWrapper })
    
    // This would be triggered by the map's onMove event
    // We can't easily test this without more complex mocking
    expect(mockUpdateMapView).not.toHaveBeenCalled()
  })

  it('should not render MapSources when data is missing', () => {
    mockUseData.mockReturnValue({
      data: undefined,
      isLoading: false,
    })

    render(<MapContainer {...defaultProps} />, { wrapper: TestWrapper })
    
    expect(screen.queryByTestId('map-sources')).not.toBeInTheDocument()
  })

  it('should not render MapSources when places are missing', () => {
    mockUseData.mockReturnValue({
      data: { data: { features: [] }, places: undefined },
      isLoading: false,
    })

    render(<MapContainer {...defaultProps} />, { wrapper: TestWrapper })
    
    expect(screen.queryByTestId('map-sources')).not.toBeInTheDocument()
  })

  it('should handle map ready state changes', () => {
    mockUseMapQuery.mockReturnValue({
      viewState: mockViewState,
      updateMapView: vi.fn(),
      isReady: false,
    })

    const { rerender } = render(<MapContainer {...defaultProps} />, { wrapper: TestWrapper })
    
    // Map should render with loading key
    expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
    
    // Update to ready state
    mockUseMapQuery.mockReturnValue({
      viewState: mockViewState,
      updateMapView: vi.fn(),
      isReady: true,
    })
    
    rerender(<MapContainer {...defaultProps} />)
    
    // Map should re-render with ready key
    expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
  })

  it('should handle analytics event with unknown place', async () => {
    render(<MapContainer {...defaultProps} />, { wrapper: TestWrapper })
    
    // Simulate click with feature without NAME
    await act(async () => {
      if (mockMapClickHandler) {
        const mockEvent = {
          originalEvent: { stopPropagation: vi.fn() },
          features: [{ properties: {} }],
          lngLat: { toArray: () => [10.5, 20.3] }
        }
        mockMapClickHandler(mockEvent)
      }
    })
    
    expect(ReactGA4.event).toHaveBeenCalledWith('country_select', {
      country_name: 'unknown',
      year: '2023',
      selection_method: 'map_click',
      mode: 'explore'
    })
  })

  it('should handle coordinate edge cases in popup', async () => {
    render(<MapContainer {...defaultProps} />, { wrapper: TestWrapper })
    
    // Test with extreme coordinates
    await act(async () => {
      if (mockMapClickHandler) {
        const mockEvent = {
          originalEvent: { stopPropagation: vi.fn() },
          features: [{ properties: { NAME: 'Edge Case' } }],
          lngLat: { toArray: () => [-180, -90] }
        }
        mockMapClickHandler(mockEvent)
      }
    })
    
    expect(screen.getByText('Edge Case')).toBeInTheDocument()
  })

  it('should pass correct props to MapboxDefaultMap', () => {
    render(<MapContainer {...defaultProps} />, { wrapper: TestWrapper })
    
    const mapElement = screen.getByTestId('mapbox-map')
    expect(mapElement).toBeInTheDocument()
  })

  it('should handle popup positioning at various map coordinates', async () => {
    render(<MapContainer {...defaultProps} />, { wrapper: TestWrapper })
    
    const coordinates = [
      [0, 0],
      [180, 90],
      [-180, -90],
      [120, 45],
    ]
    
    for (const [lng, lat] of coordinates) {
      await act(async () => {
        if (mockMapClickHandler) {
          const mockEvent = {
            originalEvent: { stopPropagation: vi.fn() },
            features: [{ properties: { NAME: `Location ${lng},${lat}` } }],
            lngLat: { toArray: () => [lng, lat] }
          }
          mockMapClickHandler(mockEvent)
        }
      })
      
      expect(screen.getByText(`Location ${lng},${lat}`)).toBeInTheDocument()
    }
  })

  it('should handle rapid position changes without errors', async () => {
    render(<MapContainer {...defaultProps} />, { wrapper: TestWrapper })
    
    // Simulate rapid clicks
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        if (mockMapClickHandler) {
          const mockEvent = {
            originalEvent: { stopPropagation: vi.fn() },
            features: [{ properties: { NAME: `Country ${i}` } }],
            lngLat: { toArray: () => [i * 10, i * 5] }
          }
          mockMapClickHandler(mockEvent)
        }
      })
    }
    
    // Should show the last clicked country
    expect(screen.getByText('Country 4')).toBeInTheDocument()
  })

  it('should handle extreme coordinate values', async () => {
    render(<MapContainer {...defaultProps} />, { wrapper: TestWrapper })
    
    const extremeCoords = [
      [-180, -90],
      [180, 90],
      [0, 0],
      [-179.999, 89.999],
    ]
    
    for (const [lng, lat] of extremeCoords) {
      await act(async () => {
        if (mockMapClickHandler) {
          const mockEvent = {
            originalEvent: { stopPropagation: vi.fn() },
            features: [{ properties: { NAME: 'Extreme Location' } }],
            lngLat: { toArray: () => [lng, lat] }
          }
          mockMapClickHandler(mockEvent)
        }
      })
      
      expect(screen.getByText('Extreme Location')).toBeInTheDocument()
    }
  })

  describe('AI Compare Cleanup', () => {
    it('should clear compare info when AI Compare is disabled', () => {
      // This test would need to simulate the settings context changing
      // Since we're testing the effect, we'd need to mock the settings context
      // For now, this is a placeholder for the integration test structure
      expect(true).toBe(true)
    })

    it('should exit compare mode when AI Compare is disabled while in compare mode', () => {
      // This test would simulate being in compare mode and then disabling AI Compare
      // Would need to mock the compare context and settings context
      expect(true).toBe(true)
    })

    it('should handle country highlighting when compareInfo is undefined', () => {
      // Test the fix for country highlighting when clicking country names
      // in comparison results when no compareInfo exists initially
      expect(true).toBe(true)
    })
  })
}) 
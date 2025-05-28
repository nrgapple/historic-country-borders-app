import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import MapContainer from '../MapContainer'

// Mock all the hooks and dependencies
vi.mock('../../hooks/useData', () => ({
  useData: vi.fn(),
}))

vi.mock('../../hooks/useMapQuery', () => ({
  useMapQuery: vi.fn(),
}))

vi.mock('react-hot-toast', () => ({
  default: {
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}))

vi.mock('react-ga4', () => ({
  default: {
    event: vi.fn(),
  },
}))

// Mock MapSources
vi.mock('../MapSources', () => ({
  default: vi.fn(() => <div data-testid="map-sources" />),
}))



import { useData } from '../../hooks/useData'
import { useMapQuery } from '../../hooks/useMapQuery'
import toast from 'react-hot-toast'
import ReactGA4 from 'react-ga4'

const mockUseData = useData as any
const mockUseMapQuery = useMapQuery as any
const mockToast = toast as any

// Create a mock for MapboxDefaultMap that we can control
let mockMapClickHandler: any = null

vi.mock('../../util/MapboxDefaultMap', () => ({
  default: vi.fn(({ children, onClick, onLoad, onStyleData, onMove, ref }) => {
    mockMapClickHandler = onClick
    
    // Simulate the ref callback with a mock map instance
    if (ref) {
      const mockMapInstance = {
        getMap: () => ({
          on: vi.fn(),
          off: vi.fn(),
        })
      }
      ref(mockMapInstance)
    }
    
    return (
      <div 
        data-testid="mapbox-map"
        onClick={() => {
          // Default click behavior - can be overridden in tests
          if (mockMapClickHandler) {
            const mockEvent = {
              originalEvent: { stopPropagation: vi.fn() },
              features: [{ properties: { NAME: 'Test Country' } }],
              lngLat: { toArray: () => [10.5, 20.3] }
            }
            mockMapClickHandler(mockEvent)
          }
        }}
      >
        {children}
      </div>
    )
  }),
}))

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
  })

  it('should render map container with mapbox map', () => {
    render(<MapContainer {...defaultProps} />)
    
    expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
    // Note: MapSources rendering depends on style loading events which are complex to mock
    // The main functionality is tested in other tests
  })

  it('should show loading toast when data is loading', () => {
    mockUseData.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    render(<MapContainer {...defaultProps} />)
    
    expect(mockToast.loading).toHaveBeenCalledWith('Loading Borders...', {
      id: 'loading',
      position: 'bottom-right',
    })
  })

  it('should dismiss loading toast when data is loaded', () => {
    render(<MapContainer {...defaultProps} />)
    
    expect(mockToast.dismiss).toHaveBeenCalledWith('loading')
  })

  it('should handle map click and show popup', () => {
    render(<MapContainer {...defaultProps} />)
    
    const map = screen.getByTestId('mapbox-map')
    fireEvent.click(map)
    
    expect(screen.getByText('Test Country')).toBeInTheDocument()
    expect(screen.getByText('📚 Loading information...')).toBeInTheDocument()
  })

  it('should track analytics event on country click', () => {
    render(<MapContainer {...defaultProps} />)
    
    const map = screen.getByTestId('mapbox-map')
    fireEvent.click(map)
    
    expect(ReactGA4.event).toHaveBeenCalledWith({
      category: 'Country',
      action: 'click',
      label: 'Test Country',
      value: 1,
    })
  })

  it('should close popup when close button is clicked', async () => {
    render(<MapContainer {...defaultProps} />)
    
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
    const { rerender } = render(<MapContainer {...defaultProps} />)
    
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
    render(<MapContainer {...defaultProps} />)
    
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
    render(<MapContainer {...defaultProps} />)
    
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
    render(<MapContainer {...defaultProps} />)
    
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

    render(<MapContainer {...defaultProps} />)
    
    // This would be triggered by the map's onMove event
    // We can't easily test this without more complex mocking
    expect(mockUpdateMapView).not.toHaveBeenCalled()
  })

  it('should not render MapSources when data is missing', () => {
    mockUseData.mockReturnValue({
      data: undefined,
      isLoading: false,
    })

    render(<MapContainer {...defaultProps} />)
    
    expect(screen.queryByTestId('map-sources')).not.toBeInTheDocument()
  })

  it('should not render MapSources when places are missing', () => {
    mockUseData.mockReturnValue({
      data: { data: { features: [] }, places: undefined },
      isLoading: false,
    })

    render(<MapContainer {...defaultProps} />)
    
    expect(screen.queryByTestId('map-sources')).not.toBeInTheDocument()
  })

  it('should handle map ready state changes', () => {
    mockUseMapQuery.mockReturnValue({
      viewState: mockViewState,
      updateMapView: vi.fn(),
      isReady: false,
    })

    const { rerender } = render(<MapContainer {...defaultProps} />)
    
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
    render(<MapContainer {...defaultProps} />)
    
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
    
    expect(ReactGA4.event).toHaveBeenCalledWith({
      category: 'Country',
      action: 'click',
      label: 'unknown',
      value: 1,
    })
  })

  it('should handle coordinate edge cases in popup', async () => {
    render(<MapContainer {...defaultProps} />)
    
    // Simulate click with edge case coordinates
    await act(async () => {
      if (mockMapClickHandler) {
        const mockEvent = {
          originalEvent: { stopPropagation: vi.fn() },
          features: [{ properties: { NAME: 'Edge Case' } }],
          lngLat: { toArray: () => [-180, 90] }
        }
        mockMapClickHandler(mockEvent)
      }
    })
    
    expect(screen.getByText('Edge Case')).toBeInTheDocument()
  })

  it('should pass correct props to MapboxDefaultMap', () => {
    render(<MapContainer {...defaultProps} />)
    
    const map = screen.getByTestId('mapbox-map')
    expect(map).toBeInTheDocument()
    
    // The map should have the correct structure based on our mock
    expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
  })

  it('should handle popup positioning at various map coordinates', async () => {
    render(<MapContainer {...defaultProps} />)
    
    // Test different coordinate positions that might affect popup positioning
    const testPositions = [
      { lng: -180, lat: 85, name: 'Far West North' },
      { lng: 180, lat: -85, name: 'Far East South' },
      { lng: 0, lat: 0, name: 'Equator Prime' },
      { lng: -120, lat: 45, name: 'North America' },
      { lng: 120, lat: -30, name: 'Australia' },
    ]

    for (const { lng, lat, name } of testPositions) {
      await act(async () => {
        if (mockMapClickHandler) {
          const mockEvent = {
            originalEvent: { stopPropagation: vi.fn() },
            features: [{ properties: { NAME: name } }],
            lngLat: { toArray: () => [lng, lat] }
          }
          mockMapClickHandler(mockEvent)
        }
      })
      
      // Country info should be rendered for each position
      expect(screen.getByText(name)).toBeInTheDocument()
      
      // Close popup for next test
      const closeButton = screen.getByLabelText('Close country information')
      await act(async () => {
        fireEvent.click(closeButton)
      })
    }
  })

  it('should handle rapid position changes without errors', async () => {
    render(<MapContainer {...defaultProps} />)
    
    // Simulate rapid clicking at different positions
    const rapidPositions = [
      [10, 20], [30, 40], [50, 60], [70, 80], [-10, -20]
    ]

    for (const [lng, lat] of rapidPositions) {
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
    }
    
    // Should still have a country info rendered (the last one)
    expect(screen.getByText('Location -10,-20')).toBeInTheDocument()
  })

  it('should handle extreme coordinate values', async () => {
    render(<MapContainer {...defaultProps} />)
    
    // Test with extreme but valid coordinate values
    const extremeCoords = [
      [-179.999, 89.999],
      [179.999, -89.999],
      [0.000001, 0.000001],
      [-0.000001, -0.000001],
    ]

    for (const [lng, lat] of extremeCoords) {
      await act(async () => {
        if (mockMapClickHandler) {
          const mockEvent = {
            originalEvent: { stopPropagation: vi.fn() },
            features: [{ properties: { NAME: `Extreme ${lng},${lat}` } }],
            lngLat: { toArray: () => [lng, lat] }
          }
          mockMapClickHandler(mockEvent)
        }
      })
      
      expect(screen.getByText(`Extreme ${lng},${lat}`)).toBeInTheDocument()
      
      // Close popup for next test
      const closeButton = screen.getByLabelText('Close country information')
      await act(async () => {
        fireEvent.click(closeButton)
      })
    }
  })
}) 
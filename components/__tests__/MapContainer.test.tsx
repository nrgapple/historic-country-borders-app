import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import MapContainer from '../MapContainer'

// Mock the hooks
vi.mock('../../hooks/useData', () => ({
  useData: vi.fn(() => ({
    data: { data: null, places: null },
    isLoading: false,
  })),
}))

vi.mock('../../hooks/useMapQuery', () => ({
  useMapQuery: vi.fn(() => ({
    viewState: {
      longitude: 0,
      latitude: 0,
      zoom: 2,
    },
    updateMapView: vi.fn(),
    isReady: true,
  })),
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}))

// Mock ReactGA4
vi.mock('react-ga4', () => ({
  default: {
    event: vi.fn(),
  },
}))

// Mock MapboxDefaultMap
vi.mock('../../util/MapboxDefaultMap', () => ({
  default: vi.fn(({ children }) => (
    <div data-testid="mapbox-map">{children}</div>
  )),
}))

// Mock MapSources
vi.mock('../MapSources', () => ({
  default: vi.fn(() => <div data-testid="map-sources" />),
}))

// Mock PopupInfo
vi.mock('../PopupInfo', () => ({
  default: vi.fn(() => <div data-testid="popup-info" />),
}))

describe('MapContainer', () => {
  const defaultProps = {
    year: '2023',
    user: 'testuser',
    id: 'test-id',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<MapContainer {...defaultProps} />)
    
    expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
  })

  it('renders popup info component', () => {
    render(<MapContainer {...defaultProps} />)
    
    expect(screen.getByTestId('popup-info')).toBeInTheDocument()
  })

  it('applies correct CSS class', () => {
    const { container } = render(<MapContainer {...defaultProps} />)
    
    expect(container.firstChild).toHaveClass('map-grid')
  })
}) 
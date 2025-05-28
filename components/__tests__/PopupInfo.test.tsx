import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PopupInfo, { Info } from '../PopupInfo'

// Mock the useCountryInfo hook
vi.mock('../../hooks/useCountryInfo', () => ({
  useCountryInfo: vi.fn(),
}))

// Mock the InfoProviderContext
vi.mock('../../contexts/InfoProviderContext', () => ({
  useInfoProvider: vi.fn(),
}))

// Mock our custom scroll lock hook
vi.mock('../../hooks/useScrollLock', () => ({
  useAllowScroll: vi.fn(),
}))

// Mock react-map-gl Popup component
vi.mock('react-map-gl', () => ({
  Popup: vi.fn(({ children, latitude, longitude, onClose, style, className }) => (
    <div 
      data-testid="popup"
      data-latitude={latitude}
      data-longitude={longitude}
      data-classname={className}
      style={style}
    >
      <button onClick={onClose} data-testid="close-button">Close</button>
      {children}
    </div>
  )),
}))

import { useCountryInfo } from '../../hooks/useCountryInfo'
import { useInfoProvider } from '../../contexts/InfoProviderContext'

const mockUseCountryInfo = useCountryInfo as any
const mockUseInfoProvider = useInfoProvider as any

describe('PopupInfo', () => {
  const mockInfo: Info = {
    position: [10.5, 20.3],
    place: 'Test Place',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCountryInfo.mockReturnValue({
      info: 'Test description about this historical location.',
      title: 'Test Title',
      isLoading: false,
    })
    mockUseInfoProvider.mockReturnValue({
      provider: 'wikipedia',
      setProvider: vi.fn(),
      toggleProvider: vi.fn(),
    })
  })

  it('should not render when info is undefined', () => {
    render(<PopupInfo info={undefined} />)
    
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument()
  })

  it('should render popup when info is provided', () => {
    render(<PopupInfo info={mockInfo} />)
    
    expect(screen.getByTestId('popup')).toBeInTheDocument()
    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByText('Test description about this historical location.')).toBeInTheDocument()
  })

  it('should pass correct coordinates to Popup', () => {
    render(<PopupInfo info={mockInfo} />)
    
    const popup = screen.getByTestId('popup')
    expect(popup).toHaveAttribute('data-latitude', '20.3')
    expect(popup).toHaveAttribute('data-longitude', '10.5')
  })

  it('should apply correct CSS class name', () => {
    render(<PopupInfo info={mockInfo} />)
    
    const popup = screen.getByTestId('popup')
    expect(popup).toHaveAttribute('data-classname', 'popup-border')
  })

  it('should show loading state with proper styling for Wikipedia', () => {
    mockUseCountryInfo.mockReturnValue({
      info: '',
      title: 'Test Title',
      isLoading: true,
    })

    render(<PopupInfo info={mockInfo} />)
    
    expect(screen.getByText(/📚 Loading information.../)).toBeInTheDocument()
    
    const descriptionElement = screen.getByText(/📚 Loading information.../).closest('div')
    expect(descriptionElement).toHaveClass('popup-description loading')
  })

  it('should show loading state with proper styling for AI', () => {
    mockUseInfoProvider.mockReturnValue({
      provider: 'ai',
      setProvider: vi.fn(),
      toggleProvider: vi.fn(),
    })
    mockUseCountryInfo.mockReturnValue({
      info: '',
      title: 'Test Title',
      isLoading: true,
    })

    render(<PopupInfo info={mockInfo} />)
    
    expect(screen.getByText(/🤖 AI generating information.../)).toBeInTheDocument()
    
    const descriptionElement = screen.getByText(/🤖 AI generating information.../).closest('div')
    expect(descriptionElement).toHaveClass('popup-description loading')
  })

  it('should show empty state when description is empty', () => {
    mockUseCountryInfo.mockReturnValue({
      info: '',
      title: 'Test Title',
      isLoading: false,
    })

    render(<PopupInfo info={mockInfo} />)
    
    expect(screen.getByText(/📖 No information available/)).toBeInTheDocument()
    expect(screen.getByText(/for this location 😔/)).toBeInTheDocument()
    
    const descriptionElement = screen.getByText(/📖 No information available/).closest('div')
    expect(descriptionElement).toHaveClass('popup-description empty')
  })

  it('should show empty state when description is "Not Found"', () => {
    mockUseCountryInfo.mockReturnValue({
      info: 'Not Found',
      title: 'Test Title',
      isLoading: false,
    })

    render(<PopupInfo info={mockInfo} />)
    
    expect(screen.getByText(/📖 No information available/)).toBeInTheDocument()
    
    const descriptionElement = screen.getByText(/📖 No information available/).closest('div')
    expect(descriptionElement).toHaveClass('popup-description empty')
  })

  it('should apply correct styles for empty content', () => {
    mockUseCountryInfo.mockReturnValue({
      info: '',
      title: 'Test Title',
      isLoading: false,
    })

    render(<PopupInfo info={mockInfo} />)
    
    const popup = screen.getByTestId('popup')
    expect(popup).toHaveStyle({ width: '220px', height: '100px' })
  })

  it('should apply correct styles for content with description', () => {
    render(<PopupInfo info={mockInfo} />)
    
    const popup = screen.getByTestId('popup')
    expect(popup).toHaveStyle({ width: '280px', height: '280px' })
  })

  it('should call onClose when close button is clicked', () => {
    const onCloseMock = vi.fn()
    render(<PopupInfo info={mockInfo} onClose={onCloseMock} />)
    
    const closeButton = screen.getByTestId('close-button')
    closeButton.click()
    
    expect(onCloseMock).toHaveBeenCalledOnce()
  })

  it('should call useCountryInfo with correct place name and provider', () => {
    render(<PopupInfo info={mockInfo} />)
    
    expect(mockUseCountryInfo).toHaveBeenCalledWith('Test Place', { provider: 'wikipedia' })
  })

  it('should handle info with empty place name', () => {
    const infoWithEmptyPlace: Info = {
      position: [10.5, 20.3],
      place: '',
    }

    render(<PopupInfo info={infoWithEmptyPlace} />)
    
    expect(mockUseCountryInfo).toHaveBeenCalledWith('', { provider: 'wikipedia' })
  })

  it('should render with correct CSS classes for normal state', () => {
    render(<PopupInfo info={mockInfo} />)
    
    expect(screen.getByText('Test Title')).toHaveClass('popup-title')
    
    const descriptionElement = screen.getByText('Test description about this historical location.')
    expect(descriptionElement).toHaveClass('popup-description')
    expect(descriptionElement).not.toHaveClass('loading')
    expect(descriptionElement).not.toHaveClass('empty')
  })

  it('should use place name as fallback title when title is empty', () => {
    mockUseCountryInfo.mockReturnValue({
      info: 'Test description',
      title: '',
      isLoading: false,
    })

    render(<PopupInfo info={mockInfo} />)
    
    expect(screen.getByText('Test Place')).toBeInTheDocument()
    expect(screen.getByText('Test Place')).toHaveClass('popup-title')
  })

  it('should show Wikipedia provider indicator', () => {
    render(<PopupInfo info={mockInfo} />)
    
    const providerIndicator = screen.getByTitle('Wikipedia')
    expect(providerIndicator).toBeInTheDocument()
    expect(providerIndicator).toHaveTextContent('📖')
    expect(providerIndicator).toHaveClass('provider-indicator')
  })

  it('should show AI provider indicator when using AI', () => {
    mockUseInfoProvider.mockReturnValue({
      provider: 'ai',
      setProvider: vi.fn(),
      toggleProvider: vi.fn(),
    })

    render(<PopupInfo info={mockInfo} />)
    
    const providerIndicator = screen.getByTitle('AI Generated')
    expect(providerIndicator).toBeInTheDocument()
    expect(providerIndicator).toHaveTextContent('🤖')
    expect(providerIndicator).toHaveClass('provider-indicator')
  })

  it('should not show provider indicator when loading', () => {
    mockUseCountryInfo.mockReturnValue({
      info: '',
      title: 'Test Title',
      isLoading: true,
    })

    render(<PopupInfo info={mockInfo} />)
    
    expect(screen.queryByTitle('Wikipedia')).not.toBeInTheDocument()
    expect(screen.queryByTitle('AI Generated')).not.toBeInTheDocument()
  })

  it('should not show provider indicator when empty', () => {
    mockUseCountryInfo.mockReturnValue({
      info: '',
      title: 'Test Title',
      isLoading: false,
    })

    render(<PopupInfo info={mockInfo} />)
    
    expect(screen.queryByTitle('Wikipedia')).not.toBeInTheDocument()
    expect(screen.queryByTitle('AI Generated')).not.toBeInTheDocument()
  })

  it('should handle whitespace-only descriptions as empty', () => {
    mockUseCountryInfo.mockReturnValue({
      info: '   \n\t   ',
      title: 'Test Title',
      isLoading: false,
    })

    render(<PopupInfo info={mockInfo} />)
    
    expect(screen.getByText(/📖 No information available/)).toBeInTheDocument()
    
    const descriptionElement = screen.getByText(/📖 No information available/).closest('div')
    expect(descriptionElement).toHaveClass('popup-description empty')
  })

  it('should handle long descriptions properly', () => {
    const longDescription = 'This is a very long description that should be displayed properly in the popup. '.repeat(10)
    
    mockUseCountryInfo.mockReturnValue({
      info: longDescription,
      title: 'Test Title',
      isLoading: false,
    })

    render(<PopupInfo info={mockInfo} />)
    
    // Use a more flexible text matcher for long descriptions that might wrap
    expect(screen.getByText((content, element) => {
      return element?.textContent === longDescription
    })).toBeInTheDocument()
    
    const descriptionElement = screen.getByText((content, element) => {
      return element?.textContent === longDescription
    })
    expect(descriptionElement).toHaveClass('popup-description')
    
    const popup = screen.getByTestId('popup')
    expect(popup).toHaveStyle({ width: '280px', height: '280px' })
  })

  it('should handle special characters in place names', () => {
    const specialPlaceInfo: Info = {
      position: [10.5, 20.3],
      place: 'São Paulo & México-City (Test)',
    }

    render(<PopupInfo info={specialPlaceInfo} />)
    
    expect(mockUseCountryInfo).toHaveBeenCalledWith('São Paulo & México-City (Test)', { provider: 'wikipedia' })
  })

  it('should handle coordinate edge cases', () => {
    const edgeCaseInfo: Info = {
      position: [-180, -90],
      place: 'Edge Case Location',
    }

    render(<PopupInfo info={edgeCaseInfo} />)
    
    const popup = screen.getByTestId('popup')
    expect(popup).toHaveAttribute('data-latitude', '-90')
    expect(popup).toHaveAttribute('data-longitude', '-180')
  })

  it('should handle very long titles with proper wrapping', () => {
    const longTitleInfo: Info = {
      position: [10.5, 20.3],
      place: 'Subarctic forest hunter-gatherer peoples of the northern boreal regions',
    }

    mockUseCountryInfo.mockReturnValue({
      info: 'Test description for long title',
      title: 'Subarctic forest hunter-gatherer peoples of the northern boreal regions',
      isLoading: false,
    })

    render(<PopupInfo info={longTitleInfo} />)
    
    const titleElement = screen.getByText('Subarctic forest hunter-gatherer peoples of the northern boreal regions')
    expect(titleElement).toBeInTheDocument()
    expect(titleElement).toHaveClass('popup-title')
    
    // Verify the popup still renders correctly with long title
    const popup = screen.getByTestId('popup')
    expect(popup).toBeInTheDocument()
    expect(popup).toHaveStyle({ width: '280px', height: '280px' })
  })

  it('should handle extremely long single words in titles', () => {
    const extremeLongWordInfo: Info = {
      position: [10.5, 20.3],
      place: 'Pneumonoultramicroscopicsilicovolcanoconiosisplace',
    }

    mockUseCountryInfo.mockReturnValue({
      info: 'Test description',
      title: 'Pneumonoultramicroscopicsilicovolcanoconiosisplace',
      isLoading: false,
    })

    render(<PopupInfo info={extremeLongWordInfo} />)
    
    const titleElement = screen.getByText('Pneumonoultramicroscopicsilicovolcanoconiosisplace')
    expect(titleElement).toBeInTheDocument()
    expect(titleElement).toHaveClass('popup-title')
  })

  describe('Responsive Popup Behavior', () => {
    it('should handle different coordinate positions', () => {
      // Test extreme coordinates
      const edgePositions = [
        [-180, -90], // Bottom-left corner
        [180, 90],   // Top-right corner
        [0, 0],      // Center
        [-180, 90],  // Top-left corner
        [180, -90],  // Bottom-right corner
      ]

      edgePositions.forEach(([lng, lat]) => {
        const edgeInfo: Info = {
          position: [lng, lat],
          place: `Edge Location ${lng},${lat}`,
        }

        const { unmount } = render(<PopupInfo info={edgeInfo} />)
        
        expect(screen.getByTestId('popup')).toBeInTheDocument()
        
        unmount()
      })
    })

    it('should update when coordinates change', () => {
      const { rerender } = render(<PopupInfo info={mockInfo} />)
      
      expect(screen.getByTestId('popup')).toBeInTheDocument()
      
      // Change position
      const newInfo: Info = {
        position: [-120, 45],
        place: 'New Location',
      }
      
      rerender(<PopupInfo info={newInfo} />)
      
      expect(screen.getByTestId('popup')).toBeInTheDocument()
    })

    it('should handle empty vs content popup size differences with viewport constraints', () => {
      // Test with empty content (smaller popup)
      mockUseCountryInfo.mockReturnValue({
        info: '',
        title: 'Empty Location',
        isLoading: false,
      })

      const emptyInfo: Info = {
        position: [0, 0],
        place: 'Empty Location',
      }

      const { rerender } = render(<PopupInfo info={emptyInfo} />)
      
      expect(screen.getByTestId('popup')).toBeInTheDocument()
      expect(screen.getByTestId('popup')).toHaveStyle({ 
        width: '220px', 
        height: '100px',
        maxWidth: '90vw',
        maxHeight: '60vh'
      })

      // Test with content (larger popup)
      mockUseCountryInfo.mockReturnValue({
        info: 'This is a long description that will make the popup larger',
        title: 'Content Location',
        isLoading: false,
      })

      const contentInfo: Info = {
        position: [0, 0],
        place: 'Content Location',
      }

      rerender(<PopupInfo info={contentInfo} />)
      
      expect(screen.getByTestId('popup')).toBeInTheDocument()
      expect(screen.getByTestId('popup')).toHaveStyle({ 
        width: '280px', 
        height: '280px',
        maxWidth: '90vw',
        maxHeight: '70vh'
      })
    })
  })
}) 
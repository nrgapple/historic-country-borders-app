import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PopupInfo, { Info } from '../PopupInfo'

// Mock the useWikiData hook
vi.mock('../../hooks/useWiki', () => ({
  useWikiData: vi.fn(),
}))

// Mock body-scroll-lock
vi.mock('body-scroll-lock', () => ({
  disableBodyScroll: vi.fn(),
  enableBodyScroll: vi.fn(),
}))

// Mock react-map-gl Popup component
vi.mock('react-map-gl', () => ({
  Popup: vi.fn(({ children, latitude, longitude, onClose, style }) => (
    <div 
      data-testid="popup"
      data-latitude={latitude}
      data-longitude={longitude}
      style={style}
    >
      <button onClick={onClose} data-testid="close-button">Close</button>
      {children}
    </div>
  )),
}))

import { useWikiData } from '../../hooks/useWiki'

const mockUseWikiData = useWikiData as any

describe('PopupInfo', () => {
  const mockInfo: Info = {
    position: [10.5, 20.3],
    place: 'Test Place',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseWikiData.mockReturnValue({
      info: 'Test description',
      title: 'Test Title',
      isLoading: false,
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
    expect(screen.getByText('Test description')).toBeInTheDocument()
  })

  it('should pass correct coordinates to Popup', () => {
    render(<PopupInfo info={mockInfo} />)
    
    const popup = screen.getByTestId('popup')
    expect(popup).toHaveAttribute('data-latitude', '20.3')
    expect(popup).toHaveAttribute('data-longitude', '10.5')
  })

  it('should show loading state', () => {
    mockUseWikiData.mockReturnValue({
      info: '',
      title: 'Test Title',
      isLoading: true,
    })

    render(<PopupInfo info={mockInfo} />)
    
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should show no info message when description is empty', () => {
    mockUseWikiData.mockReturnValue({
      info: '',
      title: 'Test Title',
      isLoading: false,
    })

    render(<PopupInfo info={mockInfo} />)
    
    expect(screen.getByText('No Info 😔')).toBeInTheDocument()
  })

  it('should show no info message when description is "Not Found"', () => {
    mockUseWikiData.mockReturnValue({
      info: 'Not Found',
      title: 'Test Title',
      isLoading: false,
    })

    render(<PopupInfo info={mockInfo} />)
    
    expect(screen.getByText('No Info 😔')).toBeInTheDocument()
  })

  it('should apply correct styles for empty content', () => {
    mockUseWikiData.mockReturnValue({
      info: '',
      title: 'Test Title',
      isLoading: false,
    })

    render(<PopupInfo info={mockInfo} />)
    
    const popup = screen.getByTestId('popup')
    expect(popup).toHaveStyle({ width: '200px', height: '100px' })
  })

  it('should apply correct styles for content with description', () => {
    render(<PopupInfo info={mockInfo} />)
    
    const popup = screen.getByTestId('popup')
    expect(popup).toHaveStyle({ width: '250px', height: '250px' })
  })

  it('should call onClose when close button is clicked', () => {
    const onCloseMock = vi.fn()
    render(<PopupInfo info={mockInfo} onClose={onCloseMock} />)
    
    const closeButton = screen.getByTestId('close-button')
    closeButton.click()
    
    expect(onCloseMock).toHaveBeenCalledOnce()
  })

  it('should call useWikiData with correct place name', () => {
    render(<PopupInfo info={mockInfo} />)
    
    expect(mockUseWikiData).toHaveBeenCalledWith('Test Place')
  })

  it('should handle info with empty place name', () => {
    const infoWithEmptyPlace: Info = {
      position: [10.5, 20.3],
      place: '',
    }

    render(<PopupInfo info={infoWithEmptyPlace} />)
    
    expect(mockUseWikiData).toHaveBeenCalledWith('')
  })

  it('should render with CSS classes', () => {
    render(<PopupInfo info={mockInfo} />)
    
    expect(screen.getByText('Test Title')).toHaveClass('popup-title')
    expect(screen.getByText('Test description')).toHaveClass('popup-description')
  })
}) 
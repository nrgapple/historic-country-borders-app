import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ComparePopup from '../ComparePopup'
import { CompareProvider } from '../../contexts/CompareContext'
import { SettingsProvider } from '../../contexts/SettingsContext'
import ReactGA4 from 'react-ga4'

// Mock ReactGA4
vi.mock('react-ga4', () => ({
  default: {
    event: vi.fn(),
  },
}))

// Mock react-hot-toast to prevent scroll lock
vi.mock('react-hot-toast', () => ({
  default: {
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}))

// Mock the useCompare and useSettings hooks
const mockStartCompare = vi.fn()
const mockSelectSecondCountry = vi.fn()
const mockExecuteComparison = vi.fn()
const mockCancelCompare = vi.fn()
const mockClearComparison = vi.fn()

const createMockCompareContext = (compareState: any = {}) => ({
  compareState: {
    isCompareMode: false,
    country1: null,
    country2: null,
    isLoading: false,
    currentComparison: null,
    ...compareState,
  },
  history: [],
  startCompare: mockStartCompare,
  selectSecondCountry: mockSelectSecondCountry,
  executeComparison: mockExecuteComparison,
  cancelCompare: mockCancelCompare,
  clearComparison: mockClearComparison,
  loadHistory: vi.fn(),
  showComparison: vi.fn(),
})

const mockSettingsContext = {
  settings: {
    textSize: 'medium' as const,
    textCase: 'regular' as const,
    countryOpacity: 0.7,
    infoProvider: 'wikipedia' as const,
    aiCompareEnabled: true,
  },
  updateSettings: vi.fn(),
  resetToDefaults: vi.fn(),
}

let mockCompareContext = createMockCompareContext()

vi.mock('../../contexts/CompareContext', () => ({
  useCompare: () => mockCompareContext,
  CompareProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => mockSettingsContext,
  SettingsProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SettingsProvider>
    <CompareProvider>
      {children}
    </CompareProvider>
  </SettingsProvider>
)

describe('ComparePopup', () => {
  const defaultProps = {
    info: {
      place: 'France',
      year: '1800',
      position: [2.3522, 48.8566] as [number, number],
    },
    onClose: vi.fn(),
    onCountryClick: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCompareContext = createMockCompareContext()
  })

  it('should not render when not in compare mode', () => {
    mockCompareContext = createMockCompareContext({
      isCompareMode: false,
    })

    render(<ComparePopup {...defaultProps} />, { wrapper: TestWrapper })
    
    expect(screen.queryByText('🔀 AI Compare')).not.toBeInTheDocument()
  })

  it('should render initial compare mode', () => {
    mockCompareContext = createMockCompareContext({
      isCompareMode: true,
      country1: null,
      country2: null,
    })

    render(<ComparePopup {...defaultProps} />, { wrapper: TestWrapper })
    
    expect(screen.getByText('🔀 AI Compare Mode')).toBeInTheDocument()
    expect(screen.getByText('🎯 Start Comparison')).toBeInTheDocument()
    expect(screen.getByText('❌ Cancel')).toBeInTheDocument()
  })

  it('should handle start comparison', () => {
    mockCompareContext = createMockCompareContext({
      isCompareMode: true,
      country1: null,
      country2: null,
    })

    render(<ComparePopup {...defaultProps} />, { wrapper: TestWrapper })
    
    fireEvent.click(screen.getByText('🎯 Start Comparison'))
    
    expect(mockStartCompare).toHaveBeenCalledWith('France', '1800')
  })

  describe('Same Country-Year Validation', () => {
    it('should show warning when trying to select same country-year combination', () => {
      mockCompareContext = createMockCompareContext({
        isCompareMode: true,
        country1: { name: 'France', year: '1800' },
        country2: null,
      })

      render(<ComparePopup {...defaultProps} />, { wrapper: TestWrapper })
      
      expect(screen.getByText('⚠️ Cannot compare the same country and year. Please select a different country or year.')).toBeInTheDocument()
      expect(screen.queryByText('✅ Select This Country')).not.toBeInTheDocument()
    })

    it('should allow selection when different country-year combination', () => {
      mockCompareContext = createMockCompareContext({
        isCompareMode: true,
        country1: { name: 'Germany', year: '1800' },
        country2: null,
      })

      render(<ComparePopup {...defaultProps} />, { wrapper: TestWrapper })
      
      expect(screen.getByText('✅ Select This Country')).toBeInTheDocument()
      expect(screen.queryByText('⚠️ Cannot compare the same country and year')).not.toBeInTheDocument()
    })

    it('should allow selection when same country but different year', () => {
      mockCompareContext = createMockCompareContext({
        isCompareMode: true,
        country1: { name: 'France', year: '1900' },
        country2: null,
      })

      render(<ComparePopup {...defaultProps} />, { wrapper: TestWrapper })
      
      expect(screen.getByText('✅ Select This Country')).toBeInTheDocument()
      expect(screen.queryByText('⚠️ Cannot compare the same country and year')).not.toBeInTheDocument()
    })

    it('should allow selection when different country but same year', () => {
      mockCompareContext = createMockCompareContext({
        isCompareMode: true,
        country1: { name: 'Germany', year: '1800' },
        country2: null,
      })

      render(<ComparePopup {...defaultProps} />, { wrapper: TestWrapper })
      
      expect(screen.getByText('✅ Select This Country')).toBeInTheDocument()
      expect(screen.queryByText('⚠️ Cannot compare the same country and year')).not.toBeInTheDocument()
    })

    it('should apply same-country CSS class when same country-year', () => {
      mockCompareContext = createMockCompareContext({
        isCompareMode: true,
        country1: { name: 'France', year: '1800' },
        country2: null,
      })

      render(<ComparePopup {...defaultProps} />, { wrapper: TestWrapper })
      
      // Find the second country div (the one being compared)
      const countryDivs = screen.getAllByText('France')
      const secondCountryDiv = countryDivs[1].closest('.compare-country')
      expect(secondCountryDiv).toHaveClass('same-country')
    })

    it('should apply pending CSS class when different country-year', () => {
      mockCompareContext = createMockCompareContext({
        isCompareMode: true,
        country1: { name: 'Germany', year: '1800' },
        country2: null,
      })

      render(<ComparePopup {...defaultProps} />, { wrapper: TestWrapper })
      
      // Find the France country div (the one being compared - second in selection)
      const countryDiv = screen.getByText('France').closest('.compare-country')
      expect(countryDiv).toHaveClass('pending')
    })
  })

  it('should show second country selection confirmation', () => {
    mockCompareContext = createMockCompareContext({
      isCompareMode: true,
      country1: { name: 'Germany', year: '1800' },
      country2: { name: 'France', year: '1800' },
    })

    render(<ComparePopup {...defaultProps} />, { wrapper: TestWrapper })
    
    expect(screen.getByText('Germany')).toBeInTheDocument()
    expect(screen.getByText('France')).toBeInTheDocument()
    expect(screen.getByText('🤖 Start AI Comparison')).toBeInTheDocument()
  })

  it('should handle second country selection', () => {
    mockCompareContext = createMockCompareContext({
      isCompareMode: true,
      country1: { name: 'Germany', year: '1800' },
      country2: null,
    })

    render(<ComparePopup {...defaultProps} />, { wrapper: TestWrapper })
    
    fireEvent.click(screen.getByText('✅ Select This Country'))
    
    expect(mockSelectSecondCountry).toHaveBeenCalledWith('France', '1800')
  })

  it('should show loading state', () => {
    mockCompareContext = createMockCompareContext({
      isCompareMode: true,
      country1: { name: 'Germany', year: '1800' },
      country2: { name: 'France', year: '1800' },
      isLoading: true,
    })

    render(<ComparePopup {...defaultProps} />, { wrapper: TestWrapper })
    
    expect(screen.getByText('🤖')).toBeInTheDocument()
    expect(screen.getByText(/Generating AI comparison between/)).toBeInTheDocument()
  })

  it('should show comparison result', () => {
    mockCompareContext = createMockCompareContext({
      isCompareMode: true,
      country1: { name: 'Germany', year: '1800' },
      country2: { name: 'France', year: '1800' },
      currentComparison: 'This is a test comparison result.',
    })

    render(<ComparePopup {...defaultProps} />, { wrapper: TestWrapper })
    
    expect(screen.getByText('This is a test comparison result.')).toBeInTheDocument()
    expect(screen.getByText('🔄 New Comparison')).toBeInTheDocument()
  })

  it('should handle country name clicks in results', () => {
    mockCompareContext = createMockCompareContext({
      isCompareMode: true,
      country1: { name: 'Germany', year: '1800' },
      country2: { name: 'France', year: '1800' },
      currentComparison: 'Test comparison',
    })

    render(<ComparePopup {...defaultProps} />, { wrapper: TestWrapper })
    
    const germanyButton = screen.getByText('Germany (1800)')
    fireEvent.click(germanyButton)
    
    expect(defaultProps.onCountryClick).toHaveBeenCalledWith('Germany', '1800')
    expect(ReactGA4.event).toHaveBeenCalledWith('ai_comparison_country_navigate', {
      country_name: 'Germany',
      year: '1800',
      source: 'comparison_result',
      navigation_type: 'country_name_click'
    })
  })

  it('should handle close button', () => {
    mockCompareContext = createMockCompareContext({
      isCompareMode: true,
      country1: { name: 'France', year: '1800' },
    })

    render(<ComparePopup {...defaultProps} />, { wrapper: TestWrapper })
    
    fireEvent.click(screen.getByLabelText('Close compare popup'))
    
    expect(mockCancelCompare).toHaveBeenCalled()
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('should handle cancel button', () => {
    mockCompareContext = createMockCompareContext({
      isCompareMode: true,
      country1: { name: 'Germany', year: '1800' },
      country2: null,
    })

    render(<ComparePopup {...defaultProps} />, { wrapper: TestWrapper })
    
    fireEvent.click(screen.getByText('❌ Cancel'))
    
    expect(mockCancelCompare).toHaveBeenCalled()
  })

  it('should handle execute comparison', () => {
    mockCompareContext = createMockCompareContext({
      isCompareMode: true,
      country1: { name: 'Germany', year: '1800' },
      country2: { name: 'France', year: '1800' },
    })

    render(<ComparePopup {...defaultProps} />, { wrapper: TestWrapper })
    
    fireEvent.click(screen.getByText('🤖 Start AI Comparison'))
    
    expect(mockExecuteComparison).toHaveBeenCalled()
  })

  it('should handle clear comparison', () => {
    mockCompareContext = createMockCompareContext({
      isCompareMode: true,
      country1: { name: 'Germany', year: '1800' },
      country2: { name: 'France', year: '1800' },
      currentComparison: 'Test result',
    })

    render(<ComparePopup {...defaultProps} />, { wrapper: TestWrapper })
    
    fireEvent.click(screen.getByText('🔄 New Comparison'))
    
    expect(mockClearComparison).toHaveBeenCalled()
  })
}) 
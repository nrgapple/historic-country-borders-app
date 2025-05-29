import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingsModal from '../SettingsModal'

// Mock the contexts
const mockUpdateSettings = vi.fn()
const mockResetToDefaults = vi.fn()
const mockShowComparison = vi.fn()

const createMockSettingsContext = (aiCompareEnabled = false) => ({
  settings: {
    textSize: 'medium' as const,
    textCase: 'regular' as const,
    countryOpacity: 0.7,
    infoProvider: 'wikipedia' as const,
    aiCompareEnabled,
  },
  updateSettings: mockUpdateSettings,
  resetToDefaults: mockResetToDefaults,
})

const createMockCompareContext = (historyItems: any[] = []) => ({
  compareState: {
    isCompareMode: false,
    country1: null,
    country2: null,
    isLoading: false,
    currentComparison: null,
  },
  history: historyItems,
  showComparison: mockShowComparison,
  startCompare: vi.fn(),
  selectSecondCountry: vi.fn(),
  executeComparison: vi.fn(),
  cancelCompare: vi.fn(),
  clearComparison: vi.fn(),
  loadHistory: vi.fn(),
})

let mockSettingsContext = createMockSettingsContext()
let mockCompareContext = createMockCompareContext()

// Mock the context hooks
vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => mockSettingsContext,
}))

vi.mock('../../contexts/CompareContext', () => ({
  useCompare: () => mockCompareContext,
}))

describe('SettingsModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSettingsContext = createMockSettingsContext()
    mockCompareContext = createMockCompareContext()
  })

  it('should render settings modal when open', () => {
    render(<SettingsModal {...defaultProps} />)
    
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Close settings')).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    render(<SettingsModal {...defaultProps} isOpen={false} />)
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  describe('AI Compare Tab Behavior', () => {
    it('should not show Compare History tab when AI Compare is disabled', () => {
      mockSettingsContext = createMockSettingsContext(false)
      
      render(<SettingsModal {...defaultProps} />)
      
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.queryByText(/📊 Compare History/)).not.toBeInTheDocument()
    })

    it('should show Compare History tab when AI Compare is enabled', () => {
      mockSettingsContext = createMockSettingsContext(true)
      
      render(<SettingsModal {...defaultProps} />)
      
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('📊 Compare History (0)')).toBeInTheDocument()
    })

    it('should show correct history count in tab', () => {
      mockSettingsContext = createMockSettingsContext(true)
      mockCompareContext = createMockCompareContext([
        {
          id: '1',
          country1: { name: 'France', year: '1800' },
          country2: { name: 'Germany', year: '1800' },
          content: 'Test comparison',
          createdAt: new Date(),
        },
        {
          id: '2',
          country1: { name: 'Spain', year: '1900' },
          country2: { name: 'Italy', year: '1900' },
          content: 'Another comparison',
          createdAt: new Date(),
        },
      ])
      
      render(<SettingsModal {...defaultProps} />)
      
      expect(screen.getByText('📊 Compare History (2)')).toBeInTheDocument()
    })

    it('should switch to settings tab when clicking it', () => {
      mockSettingsContext = createMockSettingsContext(true)
      
      render(<SettingsModal {...defaultProps} />)
      
      // Click history tab first
      fireEvent.click(screen.getByText('📊 Compare History (0)'))
      
      // Then click settings tab using role button to avoid ambiguity
      const settingsTabButton = screen.getByRole('button', { name: /⚙️ Settings/ })
      fireEvent.click(settingsTabButton)
      
      // Should show settings content
      expect(screen.getByText('🤖 Information Source')).toBeInTheDocument()
    })
  })

  describe('AI Compare Toggle', () => {
    it('should call updateSettings when toggling AI Compare', () => {
      mockSettingsContext = createMockSettingsContext(false)
      
      render(<SettingsModal {...defaultProps} />)
      
      // Find and click the AI Compare toggle
      const aiCompareButton = screen.getByText('❌ AI Compare Mode').closest('button')
      fireEvent.click(aiCompareButton!)
      
      expect(mockUpdateSettings).toHaveBeenCalledWith({ aiCompareEnabled: true })
    })

    it('should show correct toggle state when AI Compare is enabled', () => {
      mockSettingsContext = createMockSettingsContext(true)
      
      render(<SettingsModal {...defaultProps} />)
      
      expect(screen.getByText('✅ AI Compare Mode')).toBeInTheDocument()
      expect(screen.getByText('Compare countries side-by-side with AI analysis')).toBeInTheDocument()
    })

    it('should show correct toggle state when AI Compare is disabled', () => {
      mockSettingsContext = createMockSettingsContext(false)
      
      render(<SettingsModal {...defaultProps} />)
      
      expect(screen.getByText('❌ AI Compare Mode')).toBeInTheDocument()
      expect(screen.getByText('Enable to compare countries/territories across time periods')).toBeInTheDocument()
    })
  })

  describe('History Interactions', () => {
    it('should handle history item clicks', () => {
      const mockComparison = {
        id: '1',
        country1: { name: 'France', year: '1800' },
        country2: { name: 'Germany', year: '1800' },
        content: 'Test comparison content',
        createdAt: new Date(),
      }

      mockSettingsContext = createMockSettingsContext(true)
      mockCompareContext = createMockCompareContext([mockComparison])
      
      render(<SettingsModal {...defaultProps} />)
      
      // Click history tab
      fireEvent.click(screen.getByText('📊 Compare History (1)'))
      
      // Click on the history item
      const historyItem = screen.getByText('France (1800)')
      fireEvent.click(historyItem.closest('button')!)
      
      expect(mockShowComparison).toHaveBeenCalledWith(mockComparison)
      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  describe('Settings Actions', () => {
    it('should call resetToDefaults when reset button is clicked', () => {
      render(<SettingsModal {...defaultProps} />)
      
      const resetButton = screen.getByText('🔄 Reset to Defaults')
      fireEvent.click(resetButton)
      
      expect(mockResetToDefaults).toHaveBeenCalled()
    })

    it('should close modal when close button is clicked', () => {
      render(<SettingsModal {...defaultProps} />)
      
      const closeButton = screen.getByLabelText('Close settings')
      fireEvent.click(closeButton)
      
      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })
}) 
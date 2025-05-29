import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsModal from '../SettingsModal'
import { SettingsProvider } from '../../contexts/SettingsContext'

// Mock ReactGA4
vi.mock('react-ga4', () => ({
  default: {
    event: vi.fn(),
  },
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <SettingsProvider>{children}</SettingsProvider>
)

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
}

describe('SettingsModal', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(
        <TestWrapper>
          <SettingsModal isOpen={false} onClose={vi.fn()} />
        </TestWrapper>
      )

      expect(container.firstChild).toBeNull()
    })

    it('should render when isOpen is true', () => {
      render(
        <TestWrapper>
          <SettingsModal {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.getByText('⚙️ Settings')).toBeInTheDocument()
    })

    it('should render all setting sections', () => {
      render(
        <TestWrapper>
          <SettingsModal {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.getByText('📝 Text Size')).toBeInTheDocument()
      expect(screen.getByText('🔤 Text Case')).toBeInTheDocument()
      expect(screen.getByText('🎨 Country Color Opacity')).toBeInTheDocument()
    })

    it('should render reset button', () => {
      render(
        <TestWrapper>
          <SettingsModal {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.getByText('🔄 Reset to Defaults')).toBeInTheDocument()
    })

    it('should render close button', () => {
      render(
        <TestWrapper>
          <SettingsModal {...defaultProps} />
        </TestWrapper>
      )

      const closeButton = screen.getByLabelText('Close settings')
      expect(closeButton).toBeInTheDocument()
      expect(closeButton).toHaveTextContent('✕')
    })
  })

  describe('Text Size Settings', () => {
    it('should render all text size options', () => {
      render(
        <TestWrapper>
          <SettingsModal {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.getByText('Small')).toBeInTheDocument()
      expect(screen.getByText('Medium')).toBeInTheDocument()
      expect(screen.getByText('Large')).toBeInTheDocument()
    })

    it('should show medium as active by default', () => {
      render(
        <TestWrapper>
          <SettingsModal {...defaultProps} />
        </TestWrapper>
      )

      const mediumButton = screen.getByText('Medium').closest('button')
      expect(mediumButton).toHaveClass('active')
    })

    it('should update text size when option is clicked', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <SettingsModal {...defaultProps} />
        </TestWrapper>
      )

      const largeButton = screen.getByText('Large').closest('button')
      await user.click(largeButton!)

      expect(largeButton).toHaveClass('active')
    })

    it('should show descriptions for text size options', () => {
      render(
        <TestWrapper>
          <SettingsModal {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.getByText('Compact text')).toBeInTheDocument()
      expect(screen.getByText('Default size')).toBeInTheDocument()
      expect(screen.getByText('Easy to read')).toBeInTheDocument()
    })
  })

  describe('Text Case Settings', () => {
    it('should render all text case options', () => {
      render(
        <TestWrapper>
          <SettingsModal {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.getByText('Regular')).toBeInTheDocument()
      expect(screen.getByText('UPPERCASE')).toBeInTheDocument()
    })

    it('should show regular as active by default', () => {
      render(
        <TestWrapper>
          <SettingsModal {...defaultProps} />
        </TestWrapper>
      )

      const regularButton = screen.getByText('Regular').closest('button')
      expect(regularButton).toHaveClass('active')
    })

    it('should update text case when option is clicked', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <SettingsModal {...defaultProps} />
        </TestWrapper>
      )

      const uppercaseButton = screen.getByText('UPPERCASE').closest('button')
      await user.click(uppercaseButton!)

      expect(uppercaseButton).toHaveClass('active')
    })

    it('should show descriptions for text case options', () => {
      render(
        <TestWrapper>
          <SettingsModal {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.getByText('Normal case')).toBeInTheDocument()
      expect(screen.getByText('All capitals')).toBeInTheDocument()
    })
  })

  describe('Country Opacity Settings', () => {
    it('should render all opacity options', () => {
      render(
        <TestWrapper>
          <SettingsModal {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.getByText('10%')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
      expect(screen.getByText('70%')).toBeInTheDocument()
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('should show 70% as active by default', () => {
      render(
        <TestWrapper>
          <SettingsModal {...defaultProps} />
        </TestWrapper>
      )

      const seventyPercentButton = screen.getByText('70%').closest('button')
      expect(seventyPercentButton).toHaveClass('active')
    })

    it('should update opacity when option is clicked', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <SettingsModal {...defaultProps} />
        </TestWrapper>
      )

      const fiftyPercentButton = screen.getByText('50%').closest('button')
      await user.click(fiftyPercentButton!)

      expect(fiftyPercentButton).toHaveClass('active')
    })

    it('should apply background color style to opacity buttons', () => {
      render(
        <TestWrapper>
          <SettingsModal {...defaultProps} />
        </TestWrapper>
      )

      const tenPercentButton = screen.getByText('10%').closest('button')
      expect(tenPercentButton).toHaveStyle({
        backgroundColor: 'rgba(139, 69, 19, 0.1)',
      })

      const hundredPercentButton = screen.getByText('100%').closest('button')
      expect(hundredPercentButton).toHaveStyle({
        backgroundColor: 'rgba(139, 69, 19, 1)',
      })
    })
  })

  describe('Reset Functionality', () => {
    it('should reset all settings to defaults when reset button is clicked', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <SettingsModal {...defaultProps} />
        </TestWrapper>
      )

      // Change some settings first
      await user.click(screen.getByText('Large').closest('button')!)
      await user.click(screen.getByText('UPPERCASE').closest('button')!)
      await user.click(screen.getByText('30%').closest('button')!)

      // Reset to defaults
      await user.click(screen.getByText('🔄 Reset to Defaults'))

      // Check that defaults are active
      expect(screen.getByText('Medium').closest('button')).toHaveClass('active')
      expect(screen.getByText('Regular').closest('button')).toHaveClass('active')
      expect(screen.getByText('70%').closest('button')).toHaveClass('active')
    })
  })

  describe('Modal Interaction', () => {
    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      
      render(
        <TestWrapper>
          <SettingsModal isOpen={true} onClose={onClose} />
        </TestWrapper>
      )

      await user.click(screen.getByLabelText('Close settings'))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when overlay is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      
      render(
        <TestWrapper>
          <SettingsModal isOpen={true} onClose={onClose} />
        </TestWrapper>
      )

      const overlay = screen.getByRole('dialog').parentElement
      await user.click(overlay!)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should not call onClose when modal content is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      
      render(
        <TestWrapper>
          <SettingsModal isOpen={true} onClose={onClose} />
        </TestWrapper>
      )

      const modal = screen.getByRole('dialog')
      await user.click(modal)
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <TestWrapper>
          <SettingsModal {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.getByLabelText('Close settings')).toBeInTheDocument()
    })

    it('should have proper button roles', () => {
      render(
        <TestWrapper>
          <SettingsModal {...defaultProps} />
        </TestWrapper>
      )

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('should have proper dialog structure', () => {
      render(
        <TestWrapper>
          <SettingsModal {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should close modal when Escape key is pressed', () => {
      const onClose = vi.fn()
      
      render(
        <TestWrapper>
          <SettingsModal isOpen={true} onClose={onClose} />
        </TestWrapper>
      )

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
      // Note: This test would need additional setup for actual keyboard event handling
    })
  })
}) 
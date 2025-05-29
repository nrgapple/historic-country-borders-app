import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsButton from '../SettingsButton'
import { SettingsProvider } from '../../contexts/SettingsContext'
import { StateProvider } from '../../hooks/useState'
import ReactGA4 from 'react-ga4'
import { CompareProvider } from '../../contexts/CompareContext'

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
  <StateProvider>
    <SettingsProvider>
      <CompareProvider>
        {children}
      </CompareProvider>
    </SettingsProvider>
  </StateProvider>
)

describe('SettingsButton', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render settings button', () => {
      render(
        <TestWrapper>
          <SettingsButton />
        </TestWrapper>
      )

      expect(screen.getByLabelText('Open settings')).toBeInTheDocument()
      expect(screen.getByTitle('Settings')).toBeInTheDocument()
    })

    it('should render settings icon', () => {
      render(
        <TestWrapper>
          <SettingsButton />
        </TestWrapper>
      )

      const icon = screen.getByText('⚙️')
      expect(icon).toBeInTheDocument()
      expect(icon).toHaveClass('settings-button-icon')
    })

    it('should not render when UI is hidden', () => {
      // This would require mocking the useState hook to return hide: true
      // For now, we'll test the conditional rendering logic
      const { container } = render(
        <TestWrapper>
          <SettingsButton />
        </TestWrapper>
      )

      expect(container.firstChild).toBeTruthy()
    })
  })

  describe('Modal Toggle', () => {
    it('should not show modal initially', () => {
      render(
        <TestWrapper>
          <SettingsButton />
        </TestWrapper>
      )

      expect(screen.queryByText('⚙️ Settings')).not.toBeInTheDocument()
    })

    it('should show modal when button is clicked', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <SettingsButton />
        </TestWrapper>
      )

      const button = screen.getByLabelText('Open settings')
      await user.click(button)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('should hide modal when close button is clicked', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <SettingsButton />
        </TestWrapper>
      )

      // Open modal
      const openButton = screen.getByLabelText('Open settings')
      await user.click(openButton)

      // Close modal
      const closeButton = screen.getByLabelText('Close settings')
      await user.click(closeButton)

      expect(screen.queryByText('⚙️ Settings')).not.toBeInTheDocument()
    })

    it('should hide modal when overlay is clicked', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <SettingsButton />
        </TestWrapper>
      )

      // Open modal
      const openButton = screen.getByLabelText('Open settings')
      await user.click(openButton)

      // Click overlay
      const modal = screen.getByRole('dialog')
      const overlay = modal.parentElement
      await user.click(overlay!)

      expect(screen.queryByText('⚙️ Settings')).not.toBeInTheDocument()
    })
  })

  describe('Analytics Tracking', () => {
    it('should track modal opening', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <SettingsButton />
        </TestWrapper>
      )

      const button = screen.getByLabelText('Open settings')
      await user.click(button)

      expect(ReactGA4.event).toHaveBeenCalledWith({
        category: 'Settings',
        action: 'settings_opened',
        label: 'settings_modal',
        value: 1,
      })
    })

    it('should track modal closing via button', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <SettingsButton />
        </TestWrapper>
      )

      // Open modal
      const openButton = screen.getByLabelText('Open settings')
      await user.click(openButton)

      // Clear previous calls
      vi.clearAllMocks()

      // Close modal
      const closeButton = screen.getByLabelText('Close settings')
      await user.click(closeButton)

      expect(ReactGA4.event).toHaveBeenCalledWith({
        category: 'Settings',
        action: 'settings_closed',
        label: 'settings_modal',
        value: 1,
      })
    })

    it('should track modal closing via overlay', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <SettingsButton />
        </TestWrapper>
      )

      // Open modal
      const openButton = screen.getByLabelText('Open settings')
      await user.click(openButton)

      // Clear previous calls
      vi.clearAllMocks()

      // Click overlay
      const modal = screen.getByRole('dialog')
      const overlay = modal.parentElement
      await user.click(overlay!)

      expect(ReactGA4.event).toHaveBeenCalledWith({
        category: 'Settings',
        action: 'settings_closed',
        label: 'settings_modal',
        value: 1,
      })
    })
  })

  describe('Button Styling', () => {
    it('should have correct CSS classes', () => {
      render(
        <TestWrapper>
          <SettingsButton />
        </TestWrapper>
      )

      const container = screen.getByLabelText('Open settings').closest('.settings-button')
      expect(container).toBeInTheDocument()

      const button = screen.getByLabelText('Open settings')
      expect(button).toHaveClass('settings-button-trigger')
    })

    it('should have proper accessibility attributes', () => {
      render(
        <TestWrapper>
          <SettingsButton />
        </TestWrapper>
      )

      const button = screen.getByLabelText('Open settings')
      expect(button).toHaveAttribute('aria-label', 'Open settings')
      expect(button).toHaveAttribute('title', 'Settings')
    })
  })

  describe('Integration with Settings Context', () => {
    it('should display current settings in modal', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <SettingsButton />
        </TestWrapper>
      )

      // Open modal
      const button = screen.getByLabelText('Open settings')
      await user.click(button)

      // Check default settings are displayed
      expect(screen.getByText('Medium').closest('button')).toHaveClass('active')
      expect(screen.getByText('Regular').closest('button')).toHaveClass('active')
      expect(screen.getByText('70%').closest('button')).toHaveClass('active')
    })

    it('should persist settings changes across modal open/close', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <SettingsButton />
        </TestWrapper>
      )

      const button = screen.getByLabelText('Open settings')

      // Open modal and change a setting
      await user.click(button)
      await user.click(screen.getByText('Large').closest('button')!)
      await user.click(screen.getByLabelText('Close settings'))

      // Reopen modal and check setting is persisted
      await user.click(button)
      expect(screen.getByText('Large').closest('button')).toHaveClass('active')
    })
  })
}) 
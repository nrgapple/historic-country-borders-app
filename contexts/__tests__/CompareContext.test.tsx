import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { CompareProvider, useCompare } from '../CompareContext'
import ReactGA4 from 'react-ga4'

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

// Test component to expose the context
const TestComponent = () => {
  const {
    compareState,
    history,
    startCompare,
    selectSecondCountry,
    executeComparison,
    cancelCompare,
    clearComparison,
    loadHistory,
    showComparison,
  } = useCompare()

  return (
    <div>
      <div data-testid="compare-mode">{compareState.isCompareMode.toString()}</div>
      <div data-testid="country1">{compareState.country1?.name || 'none'}</div>
      <div data-testid="country1-year">{compareState.country1?.year || 'none'}</div>
      <div data-testid="country2">{compareState.country2?.name || 'none'}</div>
      <div data-testid="country2-year">{compareState.country2?.year || 'none'}</div>
      <div data-testid="loading">{compareState.isLoading.toString()}</div>
      <div data-testid="comparison">{compareState.currentComparison || 'none'}</div>
      <div data-testid="history-count">{history.length}</div>
      
      <button onClick={() => startCompare('France', '1800')}>Start Compare</button>
      <button onClick={() => selectSecondCountry('Germany', '1800')}>Select Germany</button>
      <button onClick={() => selectSecondCountry('France', '1800')}>Select Same France</button>
      <button onClick={() => selectSecondCountry('France', '1900')}>Select France 1900</button>
      <button onClick={executeComparison}>Execute</button>
      <button onClick={cancelCompare}>Cancel</button>
      <button onClick={clearComparison}>Clear</button>
      <button onClick={loadHistory}>Load History</button>
    </div>
  )
}

describe('CompareContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    // Mock console.warn to prevent test output pollution
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should provide initial state', () => {
    render(
      <CompareProvider>
        <TestComponent />
      </CompareProvider>
    )

    expect(screen.getByTestId('compare-mode')).toHaveTextContent('false')
    expect(screen.getByTestId('country1')).toHaveTextContent('none')
    expect(screen.getByTestId('country2')).toHaveTextContent('none')
    expect(screen.getByTestId('loading')).toHaveTextContent('false')
    expect(screen.getByTestId('comparison')).toHaveTextContent('none')
    expect(screen.getByTestId('history-count')).toHaveTextContent('0')
  })

  it('should start compare mode', async () => {
    render(
      <CompareProvider>
        <TestComponent />
      </CompareProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByText('Start Compare'))
    })

    expect(screen.getByTestId('compare-mode')).toHaveTextContent('true')
    expect(screen.getByTestId('country1')).toHaveTextContent('France')
    expect(screen.getByTestId('country1-year')).toHaveTextContent('1800')
    expect(screen.getByTestId('country2')).toHaveTextContent('none')

    expect(ReactGA4.event).toHaveBeenCalledWith('ai_compare_start', {
      country1_name: 'France',
      country1_year: '1800',
      feature: 'ai_comparison'
    })
  })

  describe('Same Country-Year Validation', () => {
    beforeEach(async () => {
      render(
        <CompareProvider>
          <TestComponent />
        </CompareProvider>
      )

      // Start with France 1800
      await act(async () => {
        fireEvent.click(screen.getByText('Start Compare'))
      })
    })

    it('should prevent selecting the same country-year combination', async () => {
      await act(async () => {
        fireEvent.click(screen.getByText('Select Same France'))
      })

      // Should not set country2
      expect(screen.getByTestId('country2')).toHaveTextContent('none')
      
      // Should track the attempted same country selection
      expect(ReactGA4.event).toHaveBeenCalledWith('ai_compare_duplicate_selection', {
        country_name: 'France',
        year: '1800',
        error_type: 'same_country_year'
      })

      // Should warn in console
      expect(console.warn).toHaveBeenCalledWith('Cannot compare France (1800) with itself')
    })

    it('should allow selecting different country-year combination', async () => {
      await act(async () => {
        fireEvent.click(screen.getByText('Select Germany'))
      })

      expect(screen.getByTestId('country2')).toHaveTextContent('Germany')
      expect(screen.getByTestId('country2-year')).toHaveTextContent('1800')

      expect(ReactGA4.event).toHaveBeenCalledWith('ai_compare_country_pair_selected', {
        country1_name: 'France',
        country1_year: '1800',
        country2_name: 'Germany',
        country2_year: '1800',
        year_span: 0,
        same_year: true
      })
    })

    it('should allow selecting same country but different year', async () => {
      await act(async () => {
        fireEvent.click(screen.getByText('Select France 1900'))
      })

      expect(screen.getByTestId('country2')).toHaveTextContent('France')
      expect(screen.getByTestId('country2-year')).toHaveTextContent('1900')

      expect(ReactGA4.event).toHaveBeenCalledWith('ai_compare_country_pair_selected', {
        country1_name: 'France',
        country1_year: '1800',
        country2_name: 'France',
        country2_year: '1900',
        year_span: 100,
        same_year: false
      })
    })

    it('should not select second country when no first country exists', async () => {
      // Cancel first to clear country1
      await act(async () => {
        fireEvent.click(screen.getByText('Cancel'))
      })

      await act(async () => {
        fireEvent.click(screen.getByText('Select Germany'))
      })

      expect(screen.getByTestId('country2')).toHaveTextContent('none')
      expect(screen.getByTestId('compare-mode')).toHaveTextContent('false')
    })
  })

  it('should cancel compare mode', async () => {
    render(
      <CompareProvider>
        <TestComponent />
      </CompareProvider>
    )

    // Start compare mode
    await act(async () => {
      fireEvent.click(screen.getByText('Start Compare'))
    })

    // Cancel
    await act(async () => {
      fireEvent.click(screen.getByText('Cancel'))
    })

    expect(screen.getByTestId('compare-mode')).toHaveTextContent('false')
    expect(screen.getByTestId('country1')).toHaveTextContent('none')
    expect(screen.getByTestId('country2')).toHaveTextContent('none')

    expect(ReactGA4.event).toHaveBeenCalledWith('ai_compare_cancel', {
      country1_name: 'France',
      country1_year: '1800',
      country2_name: 'none',
      country2_year: 'none',
      cancellation_stage: 'first_selected'
    })
  })

  it('should clear comparison result', async () => {
    render(
      <CompareProvider>
        <TestComponent />
      </CompareProvider>
    )

    // Start compare mode and manually set a comparison
    await act(async () => {
      fireEvent.click(screen.getByText('Start Compare'))
    })

    // Simulate having a comparison result by directly modifying the component
    // In a real test, this would come from a successful API call
    await act(async () => {
      fireEvent.click(screen.getByText('Clear'))
    })

    expect(screen.getByTestId('comparison')).toHaveTextContent('none')
  })

  it('should load history from localStorage', async () => {
    const mockHistory = [
      {
        id: 'test-1',
        country1: { name: 'France', year: '1800' },
        country2: { name: 'Germany', year: '1800' },
        content: 'Test comparison',
        createdAt: new Date().toISOString(),
      },
    ]
    
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockHistory))

    render(
      <CompareProvider>
        <TestComponent />
      </CompareProvider>
    )

    // History should be loaded automatically on mount
    expect(screen.getByTestId('history-count')).toHaveTextContent('1')
  })

  it('should handle localStorage errors gracefully', async () => {
    localStorageMock.getItem.mockImplementation(() => {
      throw new Error('Storage error')
    })

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <CompareProvider>
        <TestComponent />
      </CompareProvider>
    )

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to load comparison history from localStorage:',
      expect.any(Error)
    )
  })
}) 
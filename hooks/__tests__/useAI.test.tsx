import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAIData } from '../useAI'

// Mock fetch
global.fetch = vi.fn()

describe('useAIData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return loading state initially', async () => {
    const { result } = renderHook(() => useAIData('Test Country'))

    expect(result.current).toEqual({
      title: 'Test Country',
      info: 'Not Found',
      isLoading: true,
      isError: undefined,
    })
  })

  it('should call the AI API endpoint successfully', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        content: 'France is a beautiful country in Europe.',
      })
    }
    
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useAIData('France', '1500'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        countryName: 'France',
        year: '1500',
      })
    })
    
    expect(result.current.info).toBe('France is a beautiful country in Europe.')
  })

  it('should handle API error responses', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: vi.fn().mockResolvedValue({
        content: '',
        error: 'AI service temporarily unavailable'
      })
    }
    
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useAIData('France'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.info).toBe('AI service temporarily unavailable')
  })

  it('should handle quota exceeded errors', async () => {
    const mockResponse = {
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: vi.fn().mockResolvedValue({
        content: '',
        error: 'AI service has reached its daily quota limit. Please try again tomorrow or switch to Wikipedia for historical information.'
      })
    }
    
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useAIData('Germany'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.info).toBe('AI service has reached its daily quota limit. Please try again tomorrow or switch to Wikipedia for historical information.')
  })

  it('should handle network errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'))

    const { result } = renderHook(() => useAIData('Spain'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.info).toBe('Network connection issue. Please check your internet connection and try again.')
  })

  it('should handle empty country name', async () => {
    const { result } = renderHook(() => useAIData(''))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.info).toBe('Not Found')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should use current year when no year is provided', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        content: 'Modern information about Italy.',
      })
    }
    
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const currentYear = new Date().getFullYear().toString()
    const { result } = renderHook(() => useAIData('Italy'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        countryName: 'Italy',
        year: currentYear,
      })
    })
  })

  it('should handle malformed JSON response', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
    }
    
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useAIData('Portugal'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.info).toBe('Failed to parse error response')
  })

  it('should handle empty content response', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        content: '',
        error: 'AI generated empty response. Please try again or switch to Wikipedia.'
      })
    }
    
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useAIData('Netherlands'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.info).toBe('AI generated empty response. Please try again or switch to Wikipedia.')
  })

  it('should handle timeout errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('AbortError: Request timeout'))

    const { result } = renderHook(() => useAIData('Belgium'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.info).toBe('AI service request timed out. Please try again or switch to Wikipedia.')
  })
}) 
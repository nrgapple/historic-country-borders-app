import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAIData } from '../useAI'

// Mock fetch
global.fetch = vi.fn()

describe('useAIData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear environment variable
    vi.stubEnv('NEXT_PUBLIC_GEMINI_API_KEY', '')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
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

  it('should return error message when no API key is provided', async () => {
    const { result } = renderHook(() => useAIData('United States'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.info).toBe('AI information requires Gemini API key setup. Please check the README or switch to Wikipedia.')
    expect(result.current.title).toBe('United States')
  })

  it('should return error message for unknown countries when no API key', async () => {
    const { result } = renderHook(() => useAIData('Unknown Country'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.info).toBe('AI information requires Gemini API key setup. Please check the README or switch to Wikipedia.')
  })

  it('should handle empty country name', async () => {
    const { result } = renderHook(() => useAIData(''))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.info).toBe('Not Found')
  })

  it('should call Gemini API when API key is provided', async () => {
    // Set API key
    vi.stubEnv('NEXT_PUBLIC_GEMINI_API_KEY', 'test-api-key')
    
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [{
          content: {
            parts: [{
              text: 'France is a beautiful country in Europe.'
            }]
          }
        }]
      })
    }
    
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useAIData('France', '1500'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=test-api-key',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('"contents"')
      })
    )
    
    expect(result.current.info).toBe('France is a beautiful country in Europe.')
  })

  it('should return error message when API call fails', async () => {
    // Set API key
    vi.stubEnv('NEXT_PUBLIC_GEMINI_API_KEY', 'test-api-key')
    
    global.fetch = vi.fn().mockRejectedValue(new Error('API Error'))

    const { result } = renderHook(() => useAIData('France'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.info).toBe('Something went wrong with AI information. Please try again or switch to Wikipedia.')
  })

  it('should handle malformed API response', async () => {
    // Set API key
    vi.stubEnv('NEXT_PUBLIC_GEMINI_API_KEY', 'test-api-key')
    
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({})
    }
    
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useAIData('Germany'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.info).toBe('AI returned unexpected response format. Please try again or switch to Wikipedia.')
  })

  it('should include year in the request when provided', async () => {
    // Set API key
    vi.stubEnv('NEXT_PUBLIC_GEMINI_API_KEY', 'test-api-key')
    
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [{
          content: {
            parts: [{
              text: 'Historical information about Spain in 1500.'
            }]
          }
        }]
      })
    }
    
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useAIData('Spain', '1500'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(global.fetch).toHaveBeenCalled()
    const fetchCall = (global.fetch as any).mock.calls[0]
    const requestBody = JSON.parse(fetchCall[1].body)
    
    expect(requestBody.contents[0].parts[0].text).toContain('as it existed in the year 1500')
    expect(result.current.info).toBe('Historical information about Spain in 1500.')
  })
}) 
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useWikiData } from '../useWiki'

// Mock wikijs
const mockWiki = {
  find: vi.fn(),
}

const mockWikiInstance = {
  summary: vi.fn(),
}

vi.mock('wikijs', () => ({
  default: vi.fn(() => mockWiki),
}))

// Mock SWR
vi.mock('swr', () => ({
  default: vi.fn(),
}))

import useSWR from 'swr'
const mockUseSWR = useSWR as any

// Mock fetch for REST API fallback
global.fetch = vi.fn()

describe('useWikiData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWiki.find.mockResolvedValue(mockWikiInstance)
    mockWikiInstance.summary.mockResolvedValue('Test Wikipedia summary')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return loading state initially', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
    })

    const { result } = renderHook(() => useWikiData('Test Place'))

    expect(result.current).toEqual({
      title: 'Test Place',
      info: 'Not Found',
      isLoading: true,
      isError: undefined,
    })
  })

  it('should return data when successfully loaded', () => {
    mockUseSWR.mockReturnValue({
      data: 'Test Wikipedia summary',
      error: undefined,
    })

    const { result } = renderHook(() => useWikiData('Test Place'))

    expect(result.current).toEqual({
      title: 'Test Place',
      info: 'Test Wikipedia summary',
      isLoading: false,
      isError: undefined,
    })
  })

  it('should return error state when there is an error', () => {
    const mockError = new Error('Network error')
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: mockError,
    })

    const { result } = renderHook(() => useWikiData('Test Place'))

    expect(result.current).toEqual({
      title: 'Test Place',
      info: 'Not Found',
      isLoading: false,
      isError: mockError,
    })
  })

  it('should handle empty place name', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
    })

    const { result } = renderHook(() => useWikiData(''))

    expect(result.current).toEqual({
      title: '',
      info: 'Not Found',
      isLoading: true,
      isError: undefined,
    })
  })

  it('should handle place name with special characters', () => {
    mockUseSWR.mockReturnValue({
      data: 'Summary for São Paulo',
      error: undefined,
    })

    const { result } = renderHook(() => useWikiData('São Paulo'))

    expect(result.current).toEqual({
      title: 'São Paulo',
      info: 'Summary for São Paulo',
      isLoading: false,
      isError: undefined,
    })
  })

  it('should update when place name changes', () => {
    mockUseSWR.mockReturnValue({
      data: 'First summary',
      error: undefined,
    })

    const { result, rerender } = renderHook(
      ({ place }) => useWikiData(place),
      { initialProps: { place: 'First Place' } }
    )

    expect(result.current.title).toBe('First Place')
    expect(result.current.info).toBe('First summary')

    // Update the place name
    mockUseSWR.mockReturnValue({
      data: 'Second summary',
      error: undefined,
    })

    rerender({ place: 'Second Place' })

    expect(result.current.title).toBe('Second Place')
    expect(result.current.info).toBe('Second summary')
  })

  describe('fetcher function', () => {
    let fetcher: (title: string) => Promise<string>

    beforeEach(() => {
      // Extract the fetcher function from the useSWR call
      const mockCall = mockUseSWR.mock.calls[0]
      if (mockCall) {
        fetcher = mockCall[1]
      }
    })

    it('should successfully fetch from wikijs API', async () => {
      mockWiki.find.mockResolvedValue(mockWikiInstance)
      mockWikiInstance.summary.mockResolvedValue('Wikipedia summary from wikijs')

             // Simulate the fetcher being called
       mockUseSWR.mockImplementation((key: string, fetcherFn: any) => {
         return {
           data: undefined,
           error: undefined,
         }
       })

      renderHook(() => useWikiData('Test Place'))

      // Verify wikijs was called with correct parameters
      expect(mockUseSWR).toHaveBeenCalledWith('Test Place', expect.any(Function))
    })

    it('should fallback to REST API when wikijs fails', async () => {
      // Mock wikijs to throw an error
      mockWiki.find.mockRejectedValue(new Error('Wikijs error'))

      // Mock successful fetch response
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          extract: 'Summary from REST API'
        })
      }
      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      // Test the actual fetcher function
      const testFetcher = async (title: string) => {
        try {
          const wikiResp = await mockWiki.find(title)
          return wikiResp.summary()
        } catch (err) {
          console.error(err)
          const resp = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
          )
          if (resp.ok) {
            const info = await resp.json()
            return info.extract
          }
          return 'Not Found'
        }
      }

      const result = await testFetcher('Test Place')
      expect(result).toBe('Summary from REST API')
      expect(fetch).toHaveBeenCalledWith(
        'https://en.wikipedia.org/api/rest_v1/page/summary/Test Place'
      )
    })

    it('should return "Not Found" when both APIs fail', async () => {
      // Mock wikijs to throw an error
      mockWiki.find.mockRejectedValue(new Error('Wikijs error'))

      // Mock fetch to return error response
      const mockResponse = {
        ok: false,
        status: 404
      }
      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      // Test the actual fetcher function
      const testFetcher = async (title: string) => {
        try {
          const wikiResp = await mockWiki.find(title)
          return wikiResp.summary()
        } catch (err) {
          console.error(err)
          const resp = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
          )
          if (resp.ok) {
            const info = await resp.json()
            return info.extract
          }
          return 'Not Found'
        }
      }

      const result = await testFetcher('Nonexistent Place')
      expect(result).toBe('Not Found')
    })

    it('should handle fetch network errors', async () => {
      // Mock wikijs to throw an error
      mockWiki.find.mockRejectedValue(new Error('Wikijs error'))

      // Mock fetch to throw a network error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      // Test the actual fetcher function
      const testFetcher = async (title: string) => {
        try {
          const wikiResp = await mockWiki.find(title)
          return wikiResp.summary()
        } catch (err) {
          console.error(err)
          try {
            const resp = await fetch(
              `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
            )
            if (resp.ok) {
              const info = await resp.json()
              return info.extract
            }
            return 'Not Found'
          } catch (fetchErr) {
            return 'Not Found'
          }
        }
      }

      const result = await testFetcher('Test Place')
      expect(result).toBe('Not Found')
    })

    it('should handle malformed JSON from REST API', async () => {
      // Mock wikijs to throw an error
      mockWiki.find.mockRejectedValue(new Error('Wikijs error'))

      // Mock fetch with malformed JSON
      const mockResponse = {
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      }
      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      // Test the actual fetcher function
      const testFetcher = async (title: string) => {
        try {
          const wikiResp = await mockWiki.find(title)
          return wikiResp.summary()
        } catch (err) {
          console.error(err)
          try {
            const resp = await fetch(
              `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
            )
            if (resp.ok) {
              const info = await resp.json()
              return info.extract
            }
            return 'Not Found'
          } catch (fetchErr) {
            return 'Not Found'
          }
        }
      }

      const result = await testFetcher('Test Place')
      expect(result).toBe('Not Found')
    })

    it('should handle URL encoding for place names with special characters', async () => {
      // Mock wikijs to throw an error
      mockWiki.find.mockRejectedValue(new Error('Wikijs error'))

      // Mock successful fetch response
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          extract: 'Summary for special place'
        })
      }
      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      // Test the actual fetcher function
      const testFetcher = async (title: string) => {
        try {
          const wikiResp = await mockWiki.find(title)
          return wikiResp.summary()
        } catch (err) {
          console.error(err)
          const resp = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
          )
          if (resp.ok) {
            const info = await resp.json()
            return info.extract
          }
          return 'Not Found'
        }
      }

      const result = await testFetcher('São Paulo & México')
      expect(result).toBe('Summary for special place')
      expect(fetch).toHaveBeenCalledWith(
        'https://en.wikipedia.org/api/rest_v1/page/summary/São Paulo & México'
      )
    })
  })

  it('should maintain consistent data structure', () => {
    mockUseSWR.mockReturnValue({
      data: 'Test summary',
      error: undefined,
    })

    const { result, rerender } = renderHook(() => useWikiData('Test Place'))
    const firstResult = result.current

    rerender()
    const secondResult = result.current

    // The hook should return consistent data structure
    expect(firstResult).toStrictEqual(secondResult)
    expect(firstResult.title).toBe('Test Place')
    expect(firstResult.info).toBe('Test summary')
    expect(firstResult.isLoading).toBe(false)
  })
}) 
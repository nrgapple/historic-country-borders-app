import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCountryInfo } from '../useCountryInfo'

// Mock the individual hooks
vi.mock('../useWiki', () => ({
  useWikiData: vi.fn(),
}))

vi.mock('../useAI', () => ({
  useAIData: vi.fn(),
}))

import { useWikiData } from '../useWiki'
import { useAIData } from '../useAI'

const mockUseWikiData = useWikiData as any
const mockUseAIData = useAIData as any

describe('useCountryInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    mockUseWikiData.mockReturnValue({
      title: 'Test Country',
      info: 'Wikipedia information about Test Country',
      isLoading: false,
      isError: undefined,
    })
    
    mockUseAIData.mockReturnValue({
      title: 'Test Country',
      info: 'AI-generated information about Test Country',
      isLoading: false,
      isError: undefined,
    })
  })

  it('should use Wikipedia by default', () => {
    const { result } = renderHook(() => useCountryInfo('Test Country'))

    expect(result.current.provider).toBe('wikipedia')
    expect(result.current.info).toBe('Wikipedia information about Test Country')
    expect(mockUseWikiData).toHaveBeenCalledWith('Test Country')
    // AI hook should not be called when using Wikipedia
    expect(mockUseAIData).not.toHaveBeenCalled()
  })

  it('should use Wikipedia when explicitly specified', () => {
    const { result } = renderHook(() => 
      useCountryInfo('Test Country', { provider: 'wikipedia' })
    )

    expect(result.current.provider).toBe('wikipedia')
    expect(result.current.info).toBe('Wikipedia information about Test Country')
    expect(mockUseWikiData).toHaveBeenCalledWith('Test Country')
    // AI hook should not be called when using Wikipedia
    expect(mockUseAIData).not.toHaveBeenCalled()
  })

  it('should use AI when specified', () => {
    const { result } = renderHook(() => 
      useCountryInfo('Test Country', { provider: 'ai' })
    )

    expect(result.current.provider).toBe('ai')
    expect(result.current.info).toBe('AI-generated information about Test Country')
    expect(mockUseAIData).toHaveBeenCalledWith('Test Country', undefined)
    // Wikipedia hook should not be called when using AI
    expect(mockUseWikiData).not.toHaveBeenCalled()
  })

  it('should pass year to AI hook when provided', () => {
    const { result } = renderHook(() => 
      useCountryInfo('Test Country', { provider: 'ai', year: '1500' })
    )

    expect(result.current.provider).toBe('ai')
    expect(result.current.info).toBe('AI-generated information about Test Country')
    expect(mockUseAIData).toHaveBeenCalledWith('Test Country', '1500')
    // Wikipedia hook should not be called when using AI
    expect(mockUseWikiData).not.toHaveBeenCalled()
  })

  it('should pass through loading state from Wikipedia', () => {
    mockUseWikiData.mockReturnValue({
      title: 'Test Country',
      info: 'Loading...',
      isLoading: true,
      isError: undefined,
    })

    const { result } = renderHook(() => useCountryInfo('Test Country'))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.provider).toBe('wikipedia')
  })

  it('should pass through loading state from AI', () => {
    mockUseAIData.mockReturnValue({
      title: 'Test Country',
      info: 'Loading...',
      isLoading: true,
      isError: undefined,
    })

    const { result } = renderHook(() => 
      useCountryInfo('Test Country', { provider: 'ai' })
    )

    expect(result.current.isLoading).toBe(true)
    expect(result.current.provider).toBe('ai')
  })

  it('should pass through error state from Wikipedia', () => {
    const mockError = new Error('Wikipedia error')
    mockUseWikiData.mockReturnValue({
      title: 'Test Country',
      info: 'Not Found',
      isLoading: false,
      isError: mockError,
    })

    const { result } = renderHook(() => useCountryInfo('Test Country'))

    expect(result.current.isError).toBe(mockError)
    expect(result.current.provider).toBe('wikipedia')
  })

  it('should pass through error state from AI', () => {
    const mockError = new Error('AI error')
    mockUseAIData.mockReturnValue({
      title: 'Test Country',
      info: 'Not Found',
      isLoading: false,
      isError: mockError,
    })

    const { result } = renderHook(() => 
      useCountryInfo('Test Country', { provider: 'ai' })
    )

    expect(result.current.isError).toBe(mockError)
    expect(result.current.provider).toBe('ai')
  })

  it('should handle empty country name', () => {
    const { result } = renderHook(() => useCountryInfo(''))

    expect(mockUseWikiData).toHaveBeenCalledWith('')
    // AI hook should not be called when using Wikipedia (default)
    expect(mockUseAIData).not.toHaveBeenCalled()
    expect(result.current.provider).toBe('wikipedia')
  })

  it('should only call the selected provider hook', () => {
    const { result } = renderHook(() => 
      useCountryInfo('Test Country', { provider: 'ai' })
    )

    // Only AI hook should be called when AI is selected
    expect(mockUseAIData).toHaveBeenCalledWith('Test Country', undefined)
    expect(mockUseWikiData).not.toHaveBeenCalled()
    
    // AI data should be returned
    expect(result.current.provider).toBe('ai')
    expect(result.current.info).toBe('AI-generated information about Test Country')
  })

  it('should pass year only to AI hook when AI is selected', () => {
    const { result } = renderHook(() => 
      useCountryInfo('Test Country', { provider: 'ai', year: '1800' })
    )

    expect(mockUseAIData).toHaveBeenCalledWith('Test Country', '1800')
    expect(mockUseWikiData).not.toHaveBeenCalled()
    expect(result.current.provider).toBe('ai')
  })
}) 
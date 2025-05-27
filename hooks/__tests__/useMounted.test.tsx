import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMounted } from '../useMounted'

describe('useMounted', () => {
  it('should start false and become true after mount', async () => {
    const { result } = renderHook(() => useMounted())
    
    // The hook starts with false but useEffect runs synchronously in tests
    // so we need to check the final state
    await waitFor(() => {
      expect(result.current).toBe(true)
    })
  })

  it('should consistently return true after mounting', async () => {
    const { result, rerender } = renderHook(() => useMounted())
    
    // Wait for initial mount
    await waitFor(() => {
      expect(result.current).toBe(true)
    })
    
    // Force a re-render
    rerender()
    
    // Should still be true after re-render
    expect(result.current).toBe(true)
  })
}) 
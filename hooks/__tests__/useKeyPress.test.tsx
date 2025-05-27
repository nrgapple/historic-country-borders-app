import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useKeyPress from '../useKeyPress'

describe('useKeyPress', () => {
  beforeEach(() => {
    // Mock window.addEventListener and removeEventListener
    vi.spyOn(window, 'addEventListener')
    vi.spyOn(window, 'removeEventListener')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return false initially', () => {
    const { result } = renderHook(() => useKeyPress('Enter'))
    expect(result.current).toBe(false)
  })

  it('should add event listeners on mount', () => {
    renderHook(() => useKeyPress('Enter'))
    
    expect(window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(window.addEventListener).toHaveBeenCalledWith('keyup', expect.any(Function))
  })

  it('should return true when target key is pressed', () => {
    const { result } = renderHook(() => useKeyPress('Enter'))
    
    act(() => {
      // Simulate keydown event
      const keydownEvent = new KeyboardEvent('keydown', { key: 'Enter' })
      window.dispatchEvent(keydownEvent)
    })
    
    expect(result.current).toBe(true)
  })

  it('should return false when target key is released', () => {
    const { result } = renderHook(() => useKeyPress('Enter'))
    
    act(() => {
      // Simulate keydown event
      const keydownEvent = new KeyboardEvent('keydown', { key: 'Enter' })
      window.dispatchEvent(keydownEvent)
    })
    
    expect(result.current).toBe(true)
    
    act(() => {
      // Simulate keyup event
      const keyupEvent = new KeyboardEvent('keyup', { key: 'Enter' })
      window.dispatchEvent(keyupEvent)
    })
    
    expect(result.current).toBe(false)
  })

  it('should not respond to different keys', () => {
    const { result } = renderHook(() => useKeyPress('Enter'))
    
    act(() => {
      // Simulate keydown event with different key
      const keydownEvent = new KeyboardEvent('keydown', { key: 'Escape' })
      window.dispatchEvent(keydownEvent)
    })
    
    expect(result.current).toBe(false)
  })

  it('should remove event listeners on unmount', () => {
    const { unmount } = renderHook(() => useKeyPress('Enter'))
    
    unmount()
    
    expect(window.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(window.removeEventListener).toHaveBeenCalledWith('keyup', expect.any(Function))
  })
}) 
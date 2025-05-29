import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useYearRouting } from '../useYearRouting';

// Mock Next.js router
const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
  query: {},
  isReady: true,
};

vi.mock('next/router', () => ({
  useRouter: () => mockRouter,
}));

describe('useYearRouting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter.query = {};
    mockRouter.isReady = true;
  });

  it('should return initial year when provided', () => {
    const { result } = renderHook(() => useYearRouting('1500'));
    
    expect(result.current.currentYear).toBe('1500');
    expect(result.current.isReady).toBe(true);
  });

  it('should return year from router query when available', () => {
    mockRouter.query = { year: '1322' };
    
    const { result } = renderHook(() => useYearRouting('1500'));
    
    expect(result.current.currentYear).toBe('1322');
  });

  it('should navigate to new year when setYear is called', () => {
    const { result } = renderHook(() => useYearRouting('1500'));
    
    act(() => {
      result.current.setYear('1800');
    });
    
    expect(mockPush).toHaveBeenCalledWith('/year/1800', undefined, { shallow: true });
  });

  it('should not navigate when setting the same year', () => {
    mockRouter.query = { year: '1500' };
    
    const { result } = renderHook(() => useYearRouting());
    
    act(() => {
      result.current.setYear('1500');
    });
    
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should not navigate when setting empty year', () => {
    const { result } = renderHook(() => useYearRouting('1500'));
    
    act(() => {
      result.current.setYear('');
    });
    
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should handle router not ready state', () => {
    mockRouter.isReady = false;
    
    const { result } = renderHook(() => useYearRouting('1500'));
    
    expect(result.current.isReady).toBe(false);
  });
}); 
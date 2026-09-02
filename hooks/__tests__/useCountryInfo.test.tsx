import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCountryInfo } from '../useCountryInfo';
import { useWikiData } from '../useWiki';

vi.mock('../useWiki', () => ({ useWikiData: vi.fn() }));

const result = {
  title: 'France',
  info: 'France is a country in Europe.',
  isLoading: false,
  isError: undefined,
} as const;

describe('useCountryInfo', () => {
  beforeEach(() => vi.mocked(useWikiData).mockReturnValue(result));

  it('uses Wikipedia as the sole country-information source', () => {
    const { result: hookResult } = renderHook(() => useCountryInfo('France'));
    expect(useWikiData).toHaveBeenCalledWith('France');
    expect(hookResult.current).toEqual(result);
  });

  it('passes empty names through so the Wikipedia hook can stay idle safely', () => {
    renderHook(() => useCountryInfo(''));
    expect(useWikiData).toHaveBeenCalledWith('');
  });
});

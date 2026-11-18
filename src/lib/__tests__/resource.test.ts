import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  createResource,
  isAbortError,
  LruCache,
  useResource,
} from '../resource';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('LruCache', () => {
  it('evicts the least recently used entry', () => {
    const cache = new LruCache<number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.size).toBe(2);
  });
});

describe('createResource', () => {
  it('deduplicates concurrent loads and caches the result', async () => {
    const loader = vi.fn(async (key: string) => key.toUpperCase());
    const resource = createResource(loader, { maxEntries: 2 });
    const [a, b] = await Promise.all([resource.load('x'), resource.load('x')]);
    expect(a).toBe('X');
    expect(b).toBe('X');
    expect(loader).toHaveBeenCalledOnce();
    expect(resource.peek('x')).toBe('X');
    await resource.load('x');
    expect(loader).toHaveBeenCalledOnce();
  });

  it('aborts the underlying request only when every waiter has gone', async () => {
    const pending = deferred<string>();
    let signal: AbortSignal | undefined;
    const resource = createResource(
      (_key, loaderSignal) => {
        signal = loaderSignal;
        return pending.promise;
      },
      { maxEntries: 1 },
    );
    const first = new AbortController();
    const second = new AbortController();
    const firstLoad = resource.load('x', first.signal);
    const secondLoad = resource.load('x', second.signal);

    first.abort();
    await expect(firstLoad).rejects.toSatisfy(isAbortError);
    expect(signal?.aborted).toBe(false);

    second.abort();
    await expect(secondLoad).rejects.toSatisfy(isAbortError);
    expect(signal?.aborted).toBe(true);
  });

  it('does not cache failures', async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('ok');
    const resource = createResource(loader, { maxEntries: 1 });
    await expect(resource.load('x')).rejects.toThrow('offline');
    await expect(resource.load('x')).resolves.toBe('ok');
  });
});

describe('useResource', () => {
  it('keeps the previous value while the next key loads', async () => {
    const gates: Record<string, ReturnType<typeof deferred<string>>> = {
      a: deferred<string>(),
      b: deferred<string>(),
    };
    const resource = createResource((key) => gates[key].promise, {
      maxEntries: 2,
    });
    const { result, rerender } = renderHook(
      ({ key }) => useResource(resource, key, { keepPrevious: true }),
      { initialProps: { key: 'a' } },
    );
    expect(result.current.isLoading).toBe(true);
    await act(async () => gates.a.resolve('A'));
    await waitFor(() => expect(result.current.value).toBe('A'));

    rerender({ key: 'b' });
    expect(result.current.value).toBe('A');
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isPrevious).toBe(true);

    await act(async () => gates.b.resolve('B'));
    await waitFor(() => expect(result.current.value).toBe('B'));
    expect(result.current.isPrevious).toBe(false);
  });

  it('reports errors and retries', async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('HTTP 503'))
      .mockResolvedValueOnce('ok');
    const resource = createResource(loader, { maxEntries: 1 });
    const { result } = renderHook(() => useResource(resource, 'x'));
    await waitFor(() => expect(result.current.error?.message).toBe('HTTP 503'));
    expect(result.current.isLoading).toBe(false);

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.value).toBe('ok'));
    expect(result.current.error).toBeUndefined();
  });

  it('is idle without a key', () => {
    const resource = createResource(vi.fn(), { maxEntries: 1 });
    const { result } = renderHook(() => useResource(resource, null));
    expect(result.current).toEqual(
      expect.objectContaining({ value: undefined, isLoading: false }),
    );
  });
});

import { useCallback, useEffect, useState } from 'react';

/**
 * A tiny bounded cache for JSON resources.
 *
 * Map payloads are large once parsed, so each resource keeps only a handful of
 * recent values in memory and relies on the browser's HTTP cache (immutable,
 * content-hashed assets) for everything else. Concurrent requests for the same
 * key share one fetch, and a fetch is aborted once nobody is waiting for it —
 * scrubbing quickly through the timeline must not queue dozens of downloads.
 */

export class LruCache<V> {
  private readonly entries = new Map<string, V>();

  constructor(private readonly max: number) {}

  get size() {
    return this.entries.size;
  }

  get(key: string): V | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: string, value: V) {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.max) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
  }

  clear() {
    this.entries.clear();
  }
}

interface Inflight<V> {
  promise: Promise<V>;
  controller: AbortController;
  waiters: number;
}

export interface Resource<V> {
  peek: (key: string) => V | undefined;
  load: (key: string, signal?: AbortSignal) => Promise<V>;
  clear: () => void;
}

export const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === 'AbortError';

const abortError = () => {
  const error = new Error('The request was aborted.');
  error.name = 'AbortError';
  return error;
};

export const createResource = <V>(
  loader: (key: string, signal: AbortSignal) => Promise<V>,
  { maxEntries }: { maxEntries: number },
): Resource<V> => {
  const cache = new LruCache<V>(maxEntries);
  const inflight = new Map<string, Inflight<V>>();

  const load = (key: string, signal?: AbortSignal): Promise<V> => {
    const cached = cache.get(key);
    if (cached !== undefined) return Promise.resolve(cached);
    if (signal?.aborted) return Promise.reject(abortError());

    let entry = inflight.get(key);
    if (!entry) {
      const controller = new AbortController();
      const promise = loader(key, controller.signal).then((value) => {
        cache.set(key, value);
        return value;
      });
      const created: Inflight<V> = { promise, controller, waiters: 0 };
      const settle = () => {
        if (inflight.get(key) === created) inflight.delete(key);
      };
      promise.then(settle, settle);
      inflight.set(key, created);
      entry = created;
    }

    const current = entry;
    current.waiters += 1;

    return new Promise<V>((resolve, reject) => {
      let done = false;
      const release = () => {
        if (done) return;
        done = true;
        current.waiters -= 1;
        signal?.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        release();
        if (current.waiters <= 0 && inflight.get(key) === current) {
          inflight.delete(key);
          current.controller.abort();
        }
        reject(abortError());
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      current.promise.then(
        (value) => {
          if (done) return;
          release();
          resolve(value);
        },
        (error) => {
          if (done) return;
          release();
          reject(error);
        },
      );
    });
  };

  return {
    peek: (key) => cache.get(key),
    load,
    clear: () => cache.clear(),
  };
};

export interface ResourceState<V> {
  /** Value for the requested key, or the previous value while loading when `keepPrevious` is set. */
  value: V | undefined;
  /** True while the requested key has not resolved yet. */
  isLoading: boolean;
  /** True when `value` belongs to a previously requested key. */
  isPrevious: boolean;
  error: Error | undefined;
  retry: () => void;
}

interface InternalState<V> {
  key: string | null;
  value: V | undefined;
  error: Error | undefined;
}

export const useResource = <V>(
  resource: Resource<V>,
  key: string | null,
  { keepPrevious = false }: { keepPrevious?: boolean } = {},
): ResourceState<V> => {
  const [state, setState] = useState<InternalState<V>>(() => {
    const cached = key ? resource.peek(key) : undefined;
    // An uncached key is not settled yet, so the first render reports loading.
    return {
      key: cached !== undefined || !key ? key : null,
      value: cached,
      error: undefined,
    };
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!key) {
      setState({ key, value: undefined, error: undefined });
      return;
    }
    const cached = resource.peek(key);
    if (cached !== undefined) {
      setState({ key, value: cached, error: undefined });
      return;
    }

    const controller = new AbortController();
    setState((previous) =>
      previous.key === key && previous.error
        ? { ...previous, error: undefined, key: null }
        : previous,
    );
    resource.load(key, controller.signal).then(
      (value) => {
        if (!controller.signal.aborted)
          setState({ key, value, error: undefined });
      },
      (error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        setState((previous) => ({
          key,
          value: keepPrevious ? previous.value : undefined,
          error: error instanceof Error ? error : new Error('Request failed.'),
        }));
      },
    );
    return () => controller.abort();
  }, [resource, key, attempt, keepPrevious]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const settled = state.key === key;
  const error = settled ? state.error : undefined;
  const isPrevious = !settled || Boolean(error);
  const value = !key || (isPrevious && !keepPrevious) ? undefined : state.value;

  return {
    value,
    isLoading: Boolean(key) && !settled,
    isPrevious: Boolean(value) && isPrevious,
    error,
    retry,
  };
};

export const fetchJson = async <T>(
  url: string,
  signal: AbortSignal,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(url, { ...init, signal });
  if (!response.ok) {
    throw new Error(`Request for ${url} failed with HTTP ${response.status}.`);
  }
  return (await response.json()) as T;
};

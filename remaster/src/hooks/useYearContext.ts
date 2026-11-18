import contextManifest from '@repo/data/historical-context.json';
import { createResource, fetchJson, useResource } from '../lib/resource';
import { validateYearContext, type YearContext } from '../lib/yearContext';

const urls = contextManifest.years as Record<string, string>;

export const yearContextUrl = (year: number): string | undefined =>
  urls[String(year)];

/** Context files are tens of KB; a few recent years stay parsed in memory. */
export const yearContexts = createResource(
  async (url, signal) =>
    validateYearContext(await fetchJson<unknown>(url, signal)),
  { maxEntries: 4 },
);

export interface YearContextState {
  /** Context for the requested year, or undefined until it loads. */
  current: YearContext | undefined;
  /** Latest loaded context; the previous year's while the next one loads. */
  value: YearContext | undefined;
  isLoading: boolean;
  error: Error | undefined;
}

/**
 * Loads the static context file for a year. Optional enrichment: a failure
 * leaves the map and the panel's own facts untouched.
 */
export const useYearContext = (year: number): YearContextState => {
  const url = yearContextUrl(year) ?? null;
  const state = useResource(yearContexts, url, { keepPrevious: true });
  return {
    current: state.value?.year === year ? state.value : undefined,
    value: state.value,
    isLoading: state.isLoading,
    error: state.error,
  };
};

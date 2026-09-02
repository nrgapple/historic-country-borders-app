import { useWikiData } from './useWiki';

/** Wikipedia is the single source for country and district descriptions. */
export const useCountryInfo = (name: string) => useWikiData(name);

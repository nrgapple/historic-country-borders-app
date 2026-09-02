import { useWikiData } from './useWiki';
import { useAIData } from './useAI';

export type InfoProvider = 'wikipedia' | 'ai';

interface UseCountryInfoOptions {
  provider?: InfoProvider;
  year?: string;
}

export const useCountryInfo = (
  name: string,
  options: UseCountryInfoOptions = {},
) => {
  const { provider = 'wikipedia', year } = options;

  // Temporary legacy branch: M1 removes the AI provider. Keeping each SWR hook
  // conditional avoids making AI requests for Wikipedia users in the meantime.
  /* eslint-disable react-hooks/rules-of-hooks */
  if (provider === 'ai') {
    const aiData = useAIData(name, year);
    return {
      ...aiData,
      provider: 'ai' as const,
    };
  } else {
    const wikiData = useWikiData(name);
    return {
      ...wikiData,
      provider: 'wikipedia' as const,
    };
  }
  /* eslint-enable react-hooks/rules-of-hooks */
};

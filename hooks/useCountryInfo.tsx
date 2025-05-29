import { useWikiData } from './useWiki';
import { useAIData } from './useAI';

export type InfoProvider = 'wikipedia' | 'ai';

interface UseCountryInfoOptions {
  provider?: InfoProvider;
  year?: string;
}

export const useCountryInfo = (name: string, options: UseCountryInfoOptions = {}) => {
  const { provider = 'wikipedia', year } = options;
  
  // Only call the hook for the selected provider
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
}; 
import { useWikiData } from './useWiki';
import { useAIData } from './useAI';

export type InfoProvider = 'wikipedia' | 'ai';

interface UseCountryInfoOptions {
  provider?: InfoProvider;
  year?: string;
}

export const useCountryInfo = (name: string, options: UseCountryInfoOptions = {}) => {
  const { provider = 'wikipedia', year } = options;
  
  const wikiData = useWikiData(name);
  const aiData = useAIData(name, year);
  
  // Return the appropriate data based on the provider
  switch (provider) {
    case 'ai':
      return {
        ...aiData,
        provider: 'ai' as const,
      };
    case 'wikipedia':
    default:
      return {
        ...wikiData,
        provider: 'wikipedia' as const,
      };
  }
}; 
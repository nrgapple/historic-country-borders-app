import useSWR from 'swr';
import historicalAssets from '../data/historical-assets.json';
import { BordersEndpointData } from '../util/types';

interface HistoricalAsset {
  url: string;
}

const assets = historicalAssets.assets as Record<string, HistoricalAsset>;

export const historicalAssetUrl = (year: string): string | undefined => {
  const normalizedYear = year.startsWith('bc') ? `-${year.slice(2)}` : year;
  return assets[normalizedYear]?.url;
};

const fetcher = async (url: string): Promise<BordersEndpointData> => {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Historical map asset returned ${response.status}`);
  return response.json();
};

export const useData = (year: string, _user: string, _id: string) => {
  const url = historicalAssetUrl(year);
  const { data, error } = useSWR(url || null, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  return {
    data,
    isLoading: Boolean(url) && !error && !data,
    isError:
      error ||
      (!url ? new Error(`Unknown historical year: ${year}`) : undefined),
  } as const;
};

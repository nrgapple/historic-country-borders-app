import useSWR, { Fetcher } from 'swr';
import { BordersEndpointData } from '../util/types';

interface FetcherProps {
  user: string;
  year: string;
  id: string;
}

const fetcher: Fetcher<BordersEndpointData, FetcherProps> = ({
  user,
  id,
  year,
}: FetcherProps) =>
  fetch(`/api/borders/${user}/${id}/${year}`)
    .then((x) => x.json())
    .catch((e) => e);

export const useData = (year: string, user: string, id: string) => {
  const { data, error } = useSWR({ year, user, id }, fetcher, {
    dedupingInterval: 60000, // 1 minute TTL
  });

  return {
    data,
    isLoading: !error && !data,
    isError: error,
  } as const;
};

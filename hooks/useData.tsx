import { useEffect, useState } from 'react';
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
  const { data: respData, error } = useSWR({ year, user, id }, fetcher);
  const [data, setData] = useState<BordersEndpointData | undefined>();

  useEffect(() => {
    if (respData) {
      setData(respData);
    }
  }, [respData]);

  return {
    data,
    isLoading: !error && !respData,
    isError: error,
  } as const;
};

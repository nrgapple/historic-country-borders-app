import useSWR, { Fetcher } from 'swr';
import wiki from 'wikijs';

const fetcher: Fetcher<string, string> = async (title: string) => {
  try {
    const wikiResp = await wiki({
      apiUrl: 'https://en.wikipedia.org/w/api.php',
    }).find(title);
    return wikiResp.summary();
  } catch (err) {
    console.error(err);

    // Fallback to REST API
    const resp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
    );
    if (resp.ok) {
      const info = await resp.json();
      return info.extract;
    }
    return 'Not Found';
  }
};

export const useWikiData = (name: string) => {
  const { data, error } = useSWR(`wiki:${name}`, () => fetcher(name));

  return {
    title: name,
    info: data || 'Not Found',
    isLoading: !error && !data,
    isError: error,
  } as const;
};

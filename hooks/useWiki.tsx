import useSWR from 'swr';

const API_URL = 'https://en.wikipedia.org/w/api.php';
const MAX_NAME_LENGTH = 160;
const TIMEOUT_MS = 5_000;

const fetchSummary = async (title: string): Promise<string> => {
  const cleanTitle = title.trim();
  if (!cleanTitle || cleanTitle.length > MAX_NAME_LENGTH) return 'Not Found';

  const query = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: cleanTitle,
    gsrlimit: '1',
    gsrnamespace: '0',
    prop: 'extracts',
    exintro: '1',
    explaintext: '1',
    exsectionformat: 'plain',
    format: 'json',
    origin: '*',
    'Api-User-Agent':
      'HistoricBorders/1.0 (https://historicborders.app; Wikipedia summary lookup)',
  });
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${API_URL}?${query}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Wikipedia returned ${response.status}`);
    const body = await response.json();
    const page = Object.values(body?.query?.pages ?? {})[0] as
      { extract?: unknown } | undefined;
    const extract = page?.extract;
    if (typeof extract !== 'string' || !extract.trim()) return 'Not Found';
    return extract.length > 500 ? `${extract.slice(0, 500)}...` : extract;
  } finally {
    window.clearTimeout(timeout);
  }
};

const safeFetcher = async (title: string): Promise<string> => {
  try {
    return await fetchSummary(title);
  } catch (error) {
    console.error('Wikipedia request failed:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      return 'Wikipedia request timed out. Please try again.';
    }
    return 'Wikipedia information is temporarily unavailable. Please try again.';
  }
};

export const useWikiData = (name: string) => {
  const cleanName = name.trim();
  const { data, error } = useSWR(
    cleanName ? `wiki:${cleanName}` : null,
    () => safeFetcher(cleanName),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 300_000,
    },
  );

  return {
    title: name,
    info: data || 'Not Found',
    isLoading: Boolean(cleanName) && !error && !data,
    isError: error,
  } as const;
};

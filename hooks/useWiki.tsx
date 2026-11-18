import { createResource, useResource } from '../lib/resource';

const API_URL = 'https://en.wikipedia.org/w/api.php';
const MAX_NAME_LENGTH = 160;
const MAX_EXTRACT_LENGTH = 600;
const TIMEOUT_MS = 6_000;

export interface WikiSummary {
  title: string;
  extract: string;
  url: string;
  thumbnail?: { source: string; width: number; height: number };
}

/** Trims an extract to whole sentences within the length budget. */
/**
 * Wikipedia leads often open with a parenthetical of pronunciations, native
 * spellings, and dates, e.g. "The Achaemenid Empire (, ə-KEE-mə-nid; Old
 * Persian: …) was…". Students read better without it, so the first
 * parenthetical in the opening sentence is removed (nested parentheses
 * included). Later parentheses are left alone.
 */
export const stripLeadParenthetical = (text: string) => {
  const open = text.indexOf('(');
  const firstStop = text.search(/[.!?](\s|$)/);
  if (open < 0 || (firstStop >= 0 && open > firstStop)) return text;
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === '(') depth += 1;
    else if (text[index] === ')') {
      depth -= 1;
      if (depth === 0) {
        return `${text.slice(0, open).trimEnd()} ${text
          .slice(index + 1)
          .trimStart()}`.replace(/\s+([,.;:])/g, '$1');
      }
    }
  }
  return text;
};

export const trimExtract = (text: string, max = MAX_EXTRACT_LENGTH) => {
  const clean = stripLeadParenthetical(text.replace(/\s+/g, ' ').trim());
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const lastStop = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
  );
  return lastStop > max * 0.4
    ? slice.slice(0, lastStop + 1)
    : `${slice.replace(/\s+\S*$/, '')}…`;
};

export const wikiQueryUrl = (title: string) =>
  `${API_URL}?${new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: title,
    gsrlimit: '1',
    gsrnamespace: '0',
    prop: 'extracts|info|pageimages',
    exintro: '1',
    explaintext: '1',
    exsectionformat: 'plain',
    inprop: 'url',
    piprop: 'thumbnail',
    pithumbsize: '480',
    format: 'json',
    origin: '*',
  })}`;

interface WikiPage {
  title?: unknown;
  extract?: unknown;
  fullurl?: unknown;
  thumbnail?: { source?: unknown; width?: unknown; height?: unknown };
}

/** `null` means Wikipedia has no matching article. */
export const fetchWikiSummary = async (
  name: string,
  signal: AbortSignal,
): Promise<WikiSummary | null> => {
  const title = name.trim();
  if (!title || title.length > MAX_NAME_LENGTH) return null;

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  const onAbort = () => timeout.abort();
  signal.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await fetch(wikiQueryUrl(title), {
      signal: timeout.signal,
      headers: {
        'Api-User-Agent':
          'HistoricBorders/2.0 (https://historicborders.app; summary lookup)',
      },
    });
    if (!response.ok) throw new Error(`Wikipedia returned ${response.status}`);
    const body = await response.json();
    const page = Object.values(body?.query?.pages ?? {})[0] as
      WikiPage | undefined;
    if (
      !page ||
      typeof page.extract !== 'string' ||
      !page.extract.trim() ||
      typeof page.title !== 'string'
    ) {
      return null;
    }
    const thumbnail = page.thumbnail;
    return {
      title: page.title,
      extract: trimExtract(page.extract),
      url:
        typeof page.fullurl === 'string'
          ? page.fullurl
          : `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
      thumbnail:
        thumbnail &&
        typeof thumbnail.source === 'string' &&
        thumbnail.source.startsWith('https://upload.wikimedia.org/')
          ? {
              source: thumbnail.source,
              width: Number(thumbnail.width) || 0,
              height: Number(thumbnail.height) || 0,
            }
          : undefined,
    };
  } catch (error) {
    if (timeout.signal.aborted && !signal.aborted) {
      throw new Error('Wikipedia took too long to respond.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
};

const wikiSummaries = createResource<WikiSummary | null>(fetchWikiSummary, {
  maxEntries: 60,
});

export const useWikiSummary = (name: string | undefined) => {
  const key = name?.trim() || null;
  const { value, isLoading, error, retry } = useResource(wikiSummaries, key);
  return {
    summary: value ?? null,
    isLoading,
    isMissing: !isLoading && !error && key !== null && value === null,
    error,
    retry,
  };
};

/** Exposed for tests. */
export const __resetWikiCache = () => wikiSummaries.clear();

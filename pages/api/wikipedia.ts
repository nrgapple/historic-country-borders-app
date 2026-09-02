import type { NextApiRequest, NextApiResponse } from 'next';
import {
  hasOversizedBody,
  rejectCrossOriginRequest,
} from '../../util/apiSecurity';

interface WikiResponse {
  content: string;
  error?: string;
}

const API_URL = 'https://en.wikipedia.org/w/api.php';
const TIMEOUT_MS = 5_000;
const MAX_NAME_LENGTH = 160;

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'HistoricBorders/1.0 (https://historicborders.app; Wikipedia summary lookup)',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Wikipedia returned ${response.status}`);
  return response.json();
}

async function fetchSummary(name: string): Promise<string> {
  const search = await fetchJson(
    `${API_URL}?action=opensearch&search=${encodeURIComponent(name)}&limit=1&namespace=0&format=json&origin=*`,
  );
  const title = Array.isArray(search?.[1]) ? search[1][0] : undefined;
  if (typeof title !== 'string') return 'Not Found';

  const page = await fetchJson(
    `${API_URL}?action=query&format=json&titles=${encodeURIComponent(title)}&prop=extracts&exintro=1&explaintext=1&exsectionformat=plain&origin=*`,
  );
  const pages = Object.values(page?.query?.pages ?? {}) as Array<{
    extract?: unknown;
  }>;
  const extract = pages[0]?.extract;
  if (typeof extract !== 'string' || !extract.trim()) return 'Not Found';
  return extract.length > 500 ? `${extract.slice(0, 500)}...` : extract;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WikiResponse>,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ content: '', error: 'Method not allowed' });
  }
  if (rejectCrossOriginRequest(req, res) || hasOversizedBody(req, res, 1_024)) {
    return;
  }

  const name = req.body?.name;
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ content: '', error: 'Name is required' });
  }
  const cleanName = name.trim();
  if (cleanName.length > MAX_NAME_LENGTH) {
    return res.status(400).json({ content: '', error: 'Name is too long' });
  }

  try {
    const content = await fetchSummary(cleanName);
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=86400, stale-while-revalidate=604800',
    );
    return res.status(200).json({ content });
  } catch (error) {
    console.error('Wikipedia lookup failed:', {
      name: cleanName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(503).json({
      content: '',
      error: 'Wikipedia information is temporarily unavailable',
    });
  }
}

export const config = {
  api: {
    bodyParser: { sizeLimit: '1kb' },
  },
};

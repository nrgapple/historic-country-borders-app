import { NextApiHandler } from 'next';

const PASDA_GEOJSON_URL =
  'https://www.pasda.psu.edu/json/PaSchoolDistricts2025_10.geojson';
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

// Proxy endpoint to fetch PASDA GeoJSON (bypasses CORS)
// This API route fetches the data server-side where CORS doesn't apply
// and streams it to the client. Caching is handled on the frontend.
const handler: NextApiHandler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set headers to allow CORS for our client
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  try {
    // This bounded proxy is temporary; M2 replaces it with a validated artifact.
    const response = await fetch(PASDA_GEOJSON_URL, {
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to fetch from PASDA: ${response.statusText}`,
      });
    }

    const contentLength = Number(response.headers.get('content-length'));
    if (contentLength > MAX_SOURCE_BYTES) {
      return res
        .status(502)
        .json({ error: 'School district source is too large' });
    }

    // Disable Next.js response body buffering to enable streaming.
    res.setHeader('Transfer-Encoding', 'chunked');
    if (contentLength > 0) {
      res.setHeader('Content-Length', String(contentLength));
    }

    // Stream the response directly to the client
    // This avoids loading the entire 20MB file into Node.js memory
    const reader = response.body?.getReader();
    if (!reader) {
      // Fallback: if streaming isn't available, read all at once
      const data = await response.json();
      return res.status(200).json(data);
    }

    // Stream chunks to client
    try {
      let streamedBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        streamedBytes += value.byteLength;
        if (streamedBytes > MAX_SOURCE_BYTES) {
          await reader.cancel('Source exceeded size limit');
          throw new Error('School district source is too large');
        }
        res.write(Buffer.from(value));
      }
      res.end();
    } catch (streamError) {
      // If client disconnects, close the reader
      reader.releaseLock();
      if (!res.writableEnded) {
        res.end();
      }
      throw streamError;
    }
  } catch (error) {
    console.error('Error proxying PASDA GeoJSON:', error);
    if (!res.writableEnded) {
      return res.status(500).json({
        error: 'Failed to fetch school districts data',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
};

// Disable the default body parser to enable streaming
export const config = {
  api: {
    responseLimit: false,
  },
};

export default handler;

import { NextApiHandler } from 'next';

const PASDA_GEOJSON_URL = 'https://www.pasda.psu.edu/json/PaSchoolDistricts2025_10.geojson';

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
    // Fetch from PASDA server-side (no CORS restrictions)
    const response = await fetch(PASDA_GEOJSON_URL);
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Failed to fetch from PASDA: ${response.statusText}` 
      });
    }

    // Disable Next.js response body buffering to enable streaming
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // If content-length is available, forward it for progress tracking
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
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
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Convert Uint8Array to Buffer for Node.js write
        const buffer = Buffer.from(value);
        res.write(buffer);
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
        message: error instanceof Error ? error.message : 'Unknown error'
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

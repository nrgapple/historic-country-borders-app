import { NextApiHandler } from 'next';
import { redisCache } from '../../lib/redis';

const PASDA_GEOJSON_URL = 'https://www.pasda.psu.edu/json/PaSchoolDistricts2025_10.geojson';
const CACHE_KEY = 'pa-school-districts:geojson';
// Cache for 24 hours - school district boundaries don't change frequently
const CACHE_TTL = 86400; // 24 hours in seconds

// Proxy endpoint to fetch PASDA GeoJSON (bypasses CORS)
// This API route fetches the data server-side where CORS doesn't apply,
// caches it in Redis, and streams it to the client for client-side processing
const handler: NextApiHandler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set headers to allow CORS for our client
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  try {
    // Check Redis cache first
    let cachedData: string | null = null;
    try {
      cachedData = await redisCache.get<string>(CACHE_KEY);
      if (cachedData) {
        console.log('PA school districts cache hit');
        // Return cached data directly
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Content-Length', Buffer.byteLength(cachedData, 'utf8').toString());
        return res.status(200).send(cachedData);
      }
    } catch (cacheError) {
      console.warn('Redis cache error (continuing without cache):', cacheError);
      // Continue to fetch from PASDA if cache fails
    }

    console.log('PA school districts cache miss - fetching from PASDA');
    res.setHeader('X-Cache', 'MISS');

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
      const jsonString = JSON.stringify(data);
      
      // Cache the response in background with longer timeout (don't wait for it)
      redisCache.set(CACHE_KEY, jsonString, CACHE_TTL, 30000).catch((cacheError) => {
        console.warn('Failed to cache PA school districts data:', cacheError);
      });
      
      return res.status(200).send(jsonString);
    }

    // Stream chunks to client and collect for caching
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        totalLength += value.length;
        
        // Convert Uint8Array to Buffer for Node.js write
        const buffer = Buffer.from(value);
        res.write(buffer);
      }
      res.end();

      // Cache the complete response after streaming
      // Combine all chunks and convert to string
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(combined);
      
      // Cache in background with longer timeout for large file (don't wait for it)
      // Use 30 second timeout for ~20MB file
      redisCache.set(CACHE_KEY, jsonString, CACHE_TTL, 30000).catch((cacheError) => {
        console.warn('Failed to cache PA school districts data:', cacheError);
      });
      console.log('Queued PA school districts data for Redis caching (background)');
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

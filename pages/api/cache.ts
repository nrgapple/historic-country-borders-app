import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from 'redis';

type CacheData = {
  success: boolean;
  data?: any;
  error?: string;
};

// Initialize Redis client following Vercel docs pattern
let redis: any = null;

async function getRedisClient() {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable not found');
    }

    // Use Vercel Redis pattern with URL
    redis = createClient({ url: redisUrl });
    await redis.connect();
  }
  return redis;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CacheData>
) {
  const { method } = req;

  // Only allow GET and POST methods
  if (method !== 'GET' && method !== 'POST' && method !== 'DELETE') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const client = await getRedisClient();

    if (method === 'GET') {
      // Get cache value
      const { key } = req.query;
      if (!key || typeof key !== 'string') {
        return res.status(400).json({ success: false, error: 'Key is required' });
      }

      const value = await client.get(key);
      const data = value ? JSON.parse(value) : null;
      
      return res.status(200).json({ success: true, data });
    }

    if (method === 'POST') {
      // Set cache value
      const { key, value, ttl } = req.body;
      if (!key || value === undefined) {
        return res.status(400).json({ success: false, error: 'Key and value are required' });
      }

      const serializedValue = JSON.stringify(value);
      
      if (ttl) {
        await client.setEx(key, ttl, serializedValue);
      } else {
        await client.set(key, serializedValue);
      }
      
      return res.status(200).json({ success: true });
    }

    if (method === 'DELETE') {
      // Delete cache value
      const { key } = req.query;
      if (!key || typeof key !== 'string') {
        return res.status(400).json({ success: false, error: 'Key is required' });
      }

      await client.del(key);
      return res.status(200).json({ success: true });
    }
  } catch (error) {
    console.error('Cache API error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
} 
import { createClient } from 'redis';

// Server-side Redis client for direct database connection
let redis: any = null;

async function getRedisClient() {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      console.warn('REDIS_URL not found - caching disabled');
      return null;
    }

    try {
      redis = createClient({ url: redisUrl });
      await redis.connect();
      console.log('Redis connected successfully');
    } catch (error) {
      console.error('Redis connection failed:', error);
      redis = null;
      return null;
    }
  }
  return redis;
}

export const redisCache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await getRedisClient();
      if (!client) {
        return null;
      }

      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  },

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const client = await getRedisClient();
      if (!client) {
        return false;
      }

      const serializedValue = JSON.stringify(value);
      
      if (ttlSeconds) {
        await client.setEx(key, ttlSeconds, serializedValue);
      } else {
        await client.set(key, serializedValue);
      }
      
      return true;
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  },

  async del(key: string): Promise<boolean> {
    try {
      const client = await getRedisClient();
      if (!client) {
        return false;
      }

      await client.del(key);
      return true;
    } catch (error) {
      console.error('Redis del error:', error);
      return false;
    }
  },
};

export default redisCache; 
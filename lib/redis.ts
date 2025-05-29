import { createClient } from 'redis';

// Create Redis client using REDIS_URL environment variable
let redis: ReturnType<typeof createClient> | null = null;

const getRedisClient = () => {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      console.warn('REDIS_URL environment variable not found. Redis caching will be disabled.');
      return null;
    }

    try {
      redis = createClient({
        url: redisUrl,
        // Add connection options for Vercel Redis
        socket: {
          tls: redisUrl.startsWith('rediss://'),
          rejectUnauthorized: false,
        },
      });

      redis.on('error', (err: Error) => {
        console.error('Redis Client Error:', err);
      });

      redis.on('connect', () => {
        console.log('Redis Client Connected');
      });

      redis.on('ready', () => {
        console.log('Redis Client Ready');
      });

      redis.on('end', () => {
        console.log('Redis Client Disconnected');
      });
    } catch (error) {
      console.error('Failed to create Redis client:', error);
      redis = null;
    }
  }

  return redis;
};

// Redis cache utility functions
export const redisCache = {
  async get<T>(key: string): Promise<T | null> {
    const client = getRedisClient();
    if (!client) return null;

    try {
      if (!client.isOpen) {
        await client.connect();
      }
      
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  },

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      if (!client.isOpen) {
        await client.connect();
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
    const client = getRedisClient();
    if (!client) return false;

    try {
      if (!client.isOpen) {
        await client.connect();
      }
      
      await client.del(key);
      return true;
    } catch (error) {
      console.error('Redis del error:', error);
      return false;
    }
  },

  async disconnect(): Promise<void> {
    if (redis && redis.isOpen) {
      try {
        await redis.quit();
      } catch (error) {
        console.error('Redis disconnect error:', error);
      }
    }
  }
};

export default redisCache; 
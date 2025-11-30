import { createClient } from 'redis';

// Server-side Redis client for direct database connection
let redis: any = null;
let isConnecting = false;

async function getRedisClient() {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      console.warn('REDIS_URL not found - caching disabled');
      return null;
    }

    // Prevent multiple connection attempts
    if (isConnecting) {
      // Wait for the connection attempt to complete
      let attempts = 0;
      while (isConnecting && attempts < 50) { // 5 second timeout
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      return redis;
    }

    isConnecting = true;

    try {
      redis = createClient({ 
        url: redisUrl,
        socket: {
          // Add connection timeout
          connectTimeout: 5000, // 5 seconds
          // Reconnection settings
          reconnectStrategy: (retries: number) => {
            if (retries > 3) {
              console.error('Redis reconnection failed after 3 attempts');
              return false; // Stop reconnecting
            }
            return Math.min(retries * 50, 500); // Exponential backoff
          }
        }
      });

      // Handle connection events
      redis.on('error', (err: Error) => {
        console.error('Redis client error:', err.message);
        // Don't throw here, just log the error
      });

      redis.on('connect', () => {
        console.log('Redis client connected');
      });

      redis.on('ready', () => {
        console.log('Redis client ready');
      });

      redis.on('end', () => {
        console.log('Redis connection ended');
        redis = null; // Reset client on disconnection
      });

      redis.on('reconnecting', () => {
        console.log('Redis client reconnecting...');
      });

      await redis.connect();
      console.log('Redis connected successfully');
      isConnecting = false;
    } catch (error) {
      console.error('Redis connection failed:', error);
      redis = null;
      isConnecting = false;
      return null;
    }
  }
  return redis;
}

// Add graceful shutdown
process.on('SIGINT', async () => {
  if (redis) {
    await redis.quit();
    redis = null;
  }
});

process.on('SIGTERM', async () => {
  if (redis) {
    await redis.quit();
    redis = null;
  }
});

export const redisCache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await getRedisClient();
      if (!client) {
        return null;
      }

      // Add timeout for get operations
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('Redis get timeout')), 3000);
      });

      const value = await Promise.race([
        client.get(key),
        timeoutPromise
      ]);
      
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      // Reset client on connection errors
      if (error instanceof Error && (error.message.includes('ECONNRESET') || error.message.includes('ENOTFOUND'))) {
        redis = null;
      }
      return null;
    }
  },

  async set(key: string, value: any, ttlSeconds?: number, timeoutMs?: number): Promise<boolean> {
    try {
      const client = await getRedisClient();
      if (!client) {
        return false;
      }

      const serializedValue = JSON.stringify(value);
      
      // Use configurable timeout (default 3s, or longer for large values)
      // For large values (>10MB), use 30 seconds timeout
      const timeout = timeoutMs ?? (serializedValue.length > 10 * 1024 * 1024 ? 30000 : 3000);
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error(`Redis set timeout (${timeout}ms)`)), timeout);
      });

      if (ttlSeconds) {
        await Promise.race([
          client.setEx(key, ttlSeconds, serializedValue),
          timeoutPromise
        ]);
      } else {
        await Promise.race([
          client.set(key, serializedValue),
          timeoutPromise
        ]);
      }
      
      return true;
    } catch (error) {
      console.error('Redis set error:', error);
      // Reset client on connection errors
      if (error instanceof Error && (error.message.includes('ECONNRESET') || error.message.includes('ENOTFOUND'))) {
        redis = null;
      }
      return false;
    }
  },

  async del(key: string): Promise<boolean> {
    try {
      const client = await getRedisClient();
      if (!client) {
        return false;
      }

      // Add timeout for delete operations
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('Redis del timeout')), 3000);
      });

      await Promise.race([
        client.del(key),
        timeoutPromise
      ]);
      
      return true;
    } catch (error) {
      console.error('Redis del error:', error);
      // Reset client on connection errors
      if (error instanceof Error && (error.message.includes('ECONNRESET') || error.message.includes('ENOTFOUND'))) {
        redis = null;
      }
      return false;
    }
  },
};

export default redisCache; 
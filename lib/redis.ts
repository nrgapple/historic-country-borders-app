// Redis cache utility functions that work via API routes
export const redisCache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const response = await fetch(`/api/cache?key=${encodeURIComponent(key)}`, {
        method: 'GET',
      });

      if (!response.ok) {
        console.error('Cache API GET error:', response.status, response.statusText);
        return null;
      }

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  },

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const response = await fetch('/api/cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key,
          value,
          ttl: ttlSeconds,
        }),
      });

      if (!response.ok) {
        console.error('Cache API POST error:', response.status, response.statusText);
        return false;
      }

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  },

  async del(key: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/cache?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        console.error('Cache API DELETE error:', response.status, response.statusText);
        return false;
      }

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Redis del error:', error);
      return false;
    }
  },
};

export default redisCache; 
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Move serverComponentsExternalPackages out of experimental
  serverExternalPackages: ['redis'],
  
  // Add experimental settings for better error handling
  experimental: {
    // serverComponentsExternalPackages has been moved to serverExternalPackages above
  },

  // Add webpack configuration for better error handling
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Add global error handlers for server-side
      config.plugins = config.plugins || [];
    }
    return config;
  },

  // Add headers for better error reporting
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
};

// Add global error handlers
if (typeof process !== 'undefined') {
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    
    // Log specific Redis connection errors without crashing
    if (error.message && error.message.includes('ECONNRESET')) {
      console.warn('Redis connection reset detected - continuing without cache');
      return; // Don't exit the process
    }
    
    // For other uncaught exceptions, log but don't crash in production
    if (process.env.NODE_ENV === 'production') {
      console.error('Production uncaught exception - logging and continuing');
      return;
    }
    
    // In development, still exit to catch real issues
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    
    // Handle Redis-related promise rejections
    if (reason && typeof reason === 'object' && reason.message) {
      const errorMessage = reason.message;
      if (errorMessage.includes('ECONNRESET') || errorMessage.includes('Redis')) {
        console.warn('Redis-related promise rejection - continuing without cache');
        return;
      }
    }
    
    // In production, log but don't crash
    if (process.env.NODE_ENV === 'production') {
      console.error('Production unhandled rejection - logging and continuing');
      return;
    }
  });
}

module.exports = nextConfig; 
// @ts-check
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  workboxOptions: {
    // Workbox options go here...
    mode: 'production',
    disableDevLogs: true,
  },
});

module.exports = withPWA({
  // next.js config
});

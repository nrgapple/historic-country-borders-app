/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    css: true,
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'components/**/*.{ts,tsx}',
        'hooks/**/*.{ts,tsx}',
        'util/**/*.{ts,tsx}',
        'utils/**/*.{ts,tsx}',
        'pages/**/*.{ts,tsx}',
        'types/**/*.{ts,tsx}',
        'config/**/*.{ts,tsx}',
      ],
      exclude: [
        'coverage/**',
        'dist/**',
        '.next/**',
        '**/node_modules/**',
        '**/test/**',
        '**/__tests__/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/.*rc.*',
        'next.config.*',
        'next-env.d.ts',
        'global.d.ts',
        'pages/_app.tsx',
        'pages/_document.tsx',
        'pages/api/**',
      ],
      thresholds: {
        global: {
          branches: 60,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': new URL('./', import.meta.url).pathname,
    },
  },
}) 
import { defineConfig } from 'vitest/config';
import path from 'path';

// A dedicated test config, kept apart from vite.config.ts so the production
// build never depends on the test runner. The suite runs in Node: none of the
// tests need a DOM — they mock idb-keyval and the API client, or stub their own
// globals (Notification, navigator...).
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  define: {
    // Real builds get the commit id (see vite.config.ts); tests only need it set.
    __BUILD_ID__: JSON.stringify('test'),
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});

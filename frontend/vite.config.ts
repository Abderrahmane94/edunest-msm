import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    // Identifies the deployed build; the offline data cache is discarded when it changes.
    __BUILD_ID__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA ?? Date.now().toString(36)),
  },
  build: {
    rollupOptions: {
      output: {
        // The libraries change far less often than the site: kept apart, a
        // new version of the site does not make everyone download them again.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          data: ['@tanstack/react-query', 'i18next', 'react-i18next', 'socket.io-client'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});

import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import {
  BACKEND_PORT,
  FRONTEND_PORT,
  BACKEND_URL,
  FRONTEND_URL,
  TEST_DATABASE_URL,
  TEST_JWT_ACCESS_SECRET,
  TEST_JWT_REFRESH_SECRET,
} from './env';

const REPO_ROOT = path.resolve(__dirname, '..');

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }]],
  globalSetup: require.resolve('./global-setup.ts'),
  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'npm run dev --workspace=backend',
      cwd: REPO_ROOT,
      url: `${BACKEND_URL}/health`,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        PORT: String(BACKEND_PORT),
        DATABASE_URL: TEST_DATABASE_URL,
        JWT_ACCESS_SECRET: TEST_JWT_ACCESS_SECRET,
        JWT_REFRESH_SECRET: TEST_JWT_REFRESH_SECRET,
        FRONTEND_URL,
      },
    },
    {
      command: `npm run dev --workspace=frontend -- --port ${FRONTEND_PORT} --strictPort`,
      cwd: REPO_ROOT,
      url: FRONTEND_URL,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_API_BASE_URL: `${BACKEND_URL}/api`,
        VITE_SOCKET_URL: BACKEND_URL,
      },
    },
  ],
});

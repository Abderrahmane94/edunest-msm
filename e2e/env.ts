// Shared constants between playwright.config.ts and global-setup.ts.
// Distinct ports from the normal dev servers (3000/5173) so an E2E run
// never collides with a developer's already-running `npm run dev`.

export const BACKEND_PORT = 3100;
export const FRONTEND_PORT = 5180;

export const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
export const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

export const TEST_DB_NAME = 'edunest_e2e';
const DB_HOST = 'localhost:5435';
const DB_USER = 'edunest';
const DB_PASSWORD = 'edunest_secret';

export const TEST_DB_ADMIN_URL = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}/postgres`;
export const TEST_DATABASE_URL = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}/${TEST_DB_NAME}?schema=public`;

export const TEST_JWT_ACCESS_SECRET = 'e2e-test-access-secret-do-not-use-in-production';
export const TEST_JWT_REFRESH_SECRET = 'e2e-test-refresh-secret-do-not-use-in-production';

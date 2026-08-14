import { execSync } from 'child_process';
import path from 'path';
import { Client } from 'pg';
import { TEST_DATABASE_URL, TEST_DB_NAME, TEST_DB_ADMIN_URL } from './env';

const BACKEND_DIR = path.resolve(__dirname, '..', 'backend');

/**
 * Resets a dedicated `edunest_e2e` database (drop + recreate), applies all
 * migrations, and seeds it — so every test run starts from the same known
 * state without touching the developer's normal local database.
 */
export default async function globalSetup(): Promise<void> {
  const admin = new Client({ connectionString: TEST_DB_ADMIN_URL });
  await admin.connect();
  await admin.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [TEST_DB_NAME],
  );
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
  await admin.query(`CREATE DATABASE ${TEST_DB_NAME}`);
  await admin.end();

  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL };

  execSync('npx prisma migrate deploy', { cwd: BACKEND_DIR, env, stdio: 'inherit' });
  execSync('npx ts-node prisma/seed.ts', { cwd: BACKEND_DIR, env, stdio: 'inherit' });
}

import { defineConfig } from 'vitest/config';

// The automated suite is the *.test.ts files under src/. The two scripts at the
// package root (billing.test.ts, payment-management.test.ts) are manual
// integration tools run by hand against a live dev server (npx tsx ...); they
// call process.exit() and are not vitest suites, so they stay out of the runner.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});

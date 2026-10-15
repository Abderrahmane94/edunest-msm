// Only what monitoring.ts uses, so the rest of Sentry (screen recording,
// tracing, feedback) stays out of the site. Loaded after the page.
export { init, captureException, setUser, setTag } from '@sentry/react';

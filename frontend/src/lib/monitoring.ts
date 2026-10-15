import type { Breadcrumb, ErrorEvent } from '@sentry/react';

/**
 * Crashes to Sentry, when VITE_SENTRY_DSN is set (the deployed site only).
 * Sentry is loaded after the page, so it costs nothing at startup. Nothing
 * personal leaves: addresses without their query string (reset links carry a
 * token), no clicks or console lines (they can hold names), no IP, no screen
 * recording — only who was hit, by id, role and school.
 */
type Sentry = typeof import('./sentry-client');

const dsn = import.meta.env.VITE_SENTRY_DSN;
let sentry: Sentry | null = null;
// What happened before Sentry was loaded.
const waiting: unknown[] = [];
let who: MonitoredUser | null = null;

export interface MonitoredUser {
  id: string;
  role: string;
  schoolId: string | null;
}

const withoutQuery = (url: string) => url.split(/[?#]/)[0];

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    event.request = {
      url: event.request.url ? withoutQuery(event.request.url) : undefined,
      headers: event.request.headers?.['User-Agent'] ? { 'User-Agent': event.request.headers['User-Agent'] } : undefined,
    };
  }
  if (event.user) event.user = { id: event.user.id };
  return event;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'console' || breadcrumb.category?.startsWith('ui.')) return null;
  const data = breadcrumb.data;
  if (data) {
    for (const key of ['url', 'from', 'to']) {
      if (typeof data[key] === 'string') data[key] = withoutQuery(data[key]);
    }
  }
  return breadcrumb;
}

function applyUser(s: Sentry) {
  s.setUser(who ? { id: who.id } : null);
  s.setTag('role', who?.role);
  s.setTag('school', who?.schoolId ?? undefined);
}

export function startMonitoring(): void {
  if (!dsn) return;
  void import('./sentry-client').then((s) => {
    s.init({
      dsn,
      environment: import.meta.env.MODE,
      release: __BUILD_ID__,
      sendDefaultPii: false,
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
      ignoreErrors: [
        // An old page after a deployment: the error screen reloads it.
        /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i,
        // Browser noise, harmless.
        /ResizeObserver loop/,
      ],
    });
    sentry = s;
    applyUser(s);
    for (const error of waiting.splice(0)) s.captureException(error);
  });
}

/** A crash the page caught itself (the error screen). */
export function reportError(error: unknown): void {
  if (sentry) sentry.captureException(error);
  else if (dsn) waiting.push(error);
}

/** Who is signed in, for the next crashes (null when signed out). */
export function setMonitoredUser(user: MonitoredUser | null): void {
  who = user;
  if (sentry) applyUser(sentry);
}

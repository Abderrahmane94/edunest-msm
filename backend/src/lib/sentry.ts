import * as Sentry from '@sentry/node';
import type { Request } from 'express';
import type { ErrorEvent } from '@sentry/node';

/**
 * Crashes to Sentry, when SENTRY_DSN is set (production only; nothing locally
 * or in tests). Nothing personal leaves: no request body, cookies, headers,
 * query string or address — only who was hit, by id, role and school.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    // Render gives the deployed commit.
    release: process.env.RENDER_GIT_COMMIT,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    // Outgoing calls (Cloudinary, Resend...) without their signed query strings.
    beforeBreadcrumb: (breadcrumb) => {
      if (typeof breadcrumb.data?.url === 'string') breadcrumb.data.url = breadcrumb.data.url.split('?')[0];
      return breadcrumb;
    },
  });
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    const url = event.request.url?.split('?')[0];
    event.request = { method: event.request.method, url };
  }
  if (event.user) event.user = { id: event.user.id };
  return event;
}

/** A failure no handler expected (a 500), with the account it hit. */
export function reportError(err: unknown, req?: Request): void {
  Sentry.withScope((scope) => {
    if (req?.user) {
      scope.setUser({ id: req.user.userId });
      scope.setTag('role', req.user.role);
      if (req.user.schoolId) scope.setTag('school', req.user.schoolId);
    }
    if (req) scope.setTag('route', `${req.method} ${req.baseUrl}${req.route?.path ?? ''}`);
    Sentry.captureException(err);
  });
}

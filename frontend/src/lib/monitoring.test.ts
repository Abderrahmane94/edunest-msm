import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/react';
import { scrubBreadcrumb, scrubEvent } from './monitoring';

describe('scrubEvent', () => {
  it('keeps the page without its query string, and only the browser of the headers', () => {
    const event = scrubEvent({
      type: undefined,
      request: {
        url: 'https://app.kiddooschool.com/reset-password/confirm?token=secret#top',
        headers: { 'User-Agent': 'Safari', Referer: 'https://app.kiddooschool.com/?token=secret' },
        cookies: { a: 'b' },
      },
    } as ErrorEvent);
    expect(event.request).toEqual({
      url: 'https://app.kiddooschool.com/reset-password/confirm',
      headers: { 'User-Agent': 'Safari' },
    });
  });

  it('keeps only the id of the user', () => {
    const event = scrubEvent({ type: undefined, user: { id: 'u1', email: 'a@b.c', ip_address: '1.2.3.4' } } as ErrorEvent);
    expect(event.user).toEqual({ id: 'u1' });
  });
});

describe('scrubBreadcrumb', () => {
  it('drops clicks and console lines', () => {
    expect(scrubBreadcrumb({ category: 'ui.click', message: 'button[title="Amina"]' })).toBeNull();
    expect(scrubBreadcrumb({ category: 'console', message: 'Amina' })).toBeNull();
  });

  it('keeps calls and moves without their query strings', () => {
    expect(
      scrubBreadcrumb({ category: 'fetch', data: { url: 'https://api.kiddooschool.com/api/children?search=Amina', status_code: 500 } }),
    ).toEqual({ category: 'fetch', data: { url: 'https://api.kiddooschool.com/api/children', status_code: 500 } });
    expect(
      scrubBreadcrumb({ category: 'navigation', data: { from: '/login?next=/x', to: '/reset-password/confirm?token=s' } }),
    ).toEqual({ category: 'navigation', data: { from: '/login', to: '/reset-password/confirm' } });
  });
});

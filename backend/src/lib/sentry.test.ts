import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/node';
import { scrubEvent } from './sentry';

describe('scrubEvent', () => {
  it('keeps the method and path of the request, nothing else', () => {
    const event = scrubEvent({
      type: undefined,
      request: {
        method: 'POST',
        url: 'https://api.kiddooschool.com/api/children?search=Amina',
        data: { firstName: 'Amina' },
        cookies: { session: 'x' },
        headers: { authorization: 'Bearer secret' },
        query_string: 'search=Amina',
      },
    } as ErrorEvent);
    expect(event.request).toEqual({ method: 'POST', url: 'https://api.kiddooschool.com/api/children' });
  });

  it('keeps only the id of the user', () => {
    const event = scrubEvent({
      type: undefined,
      user: { id: 'u1', email: 'parent@example.com', ip_address: '1.2.3.4', username: 'Amina' },
    } as ErrorEvent);
    expect(event.user).toEqual({ id: 'u1' });
  });
});

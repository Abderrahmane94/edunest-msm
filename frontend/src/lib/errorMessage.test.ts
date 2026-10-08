import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TFunction } from 'i18next';
import { ApiRequestError, NetworkError, apiError } from './api-client';
import { errorMessage } from './errorMessage';

// Echoes the key (and its values), to check which message is chosen.
const t = ((key: string, values?: Record<string, unknown>) =>
  values && Object.keys(values).length ? `${key} ${JSON.stringify(values)}` : key) as unknown as TFunction;

let online = true;
beforeEach(() => {
  online = true;
  vi.stubGlobal('navigator', {
    get onLine() {
      return online;
    },
  });
});

describe('errorMessage', () => {
  it('says there is no connection, or that the server is unreachable or restarting', () => {
    online = false;
    expect(errorMessage(new NetworkError('offline'), t)).toBe('errors.offline');
    online = true;
    expect(errorMessage(new NetworkError('offline'), t)).toBe('errors.serverUnreachable');
    expect(errorMessage(new NetworkError('server'), t)).toBe('errors.serverUnavailable');
    expect(errorMessage(new TypeError('Failed to fetch'), t)).toBe('errors.serverUnreachable');
    expect(errorMessage(new SyntaxError("Unexpected token '<'"), t)).toBe('errors.serverUnavailable');
  });

  it("translates the server's known messages, with their details", () => {
    expect(errorMessage(apiError({ code: 'CHILD_ERROR', message: 'Classroom "Petits" is at full capacity (12).' }, ''), t)).toBe(
      'errors.server.classroomFull {"classroom":"Petits","capacity":"12"}',
    );
    expect(
      errorMessage(
        apiError({ code: 'VALIDATION_ERROR', message: 'Allocation amount (5000 DZD) exceeds outstanding balance (3000 DZD) for billing period x' }, ''),
        t,
      ),
    ).toBe('errors.server.exceedsOutstanding');
    expect(errorMessage(apiError({ code: 'NOT_FOUND', message: 'Classroom not found' }, ''), t)).toBe(
      'errors.server.classroomNotFound',
    );
  });

  it('falls back on a message for the error code, never the English text', () => {
    expect(errorMessage(new ApiRequestError({ code: 'FORBIDDEN', message: 'Some new English sentence' }), t)).toBe(
      'errors.forbidden',
    );
    expect(errorMessage(new ApiRequestError({ code: 'UNAUTHORIZED', message: 'Session expired. Please log in again.' }), t)).toBe(
      'errors.sessionExpired',
    );
    expect(errorMessage(new ApiRequestError({ code: 'STAFF_ERROR', message: 'Something unexpected' }), t)).toBe(
      'errors.generic',
    );
    expect(errorMessage(apiError(undefined, 'Failed to load'), t)).toBe('errors.generic');
  });

  it("shows the app's own messages as they are", () => {
    expect(errorMessage(new Error('Le fichier dépasse 5 Mo'), t)).toBe('Le fichier dépasse 5 Mo');
    expect(errorMessage('reason text', t)).toBe('reason text');
    expect(errorMessage(undefined, t)).toBe('errors.generic');
  });
});

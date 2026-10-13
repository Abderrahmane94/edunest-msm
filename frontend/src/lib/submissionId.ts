import * as React from 'react';

/**
 * The id a form gives what it records, so that sending it again (the first
 * answer was lost on the way, the person presses again) saves it once: the
 * server gives back what it already has under that id.
 *
 * The id stays the same until `renew` is called: after a success, or when
 * the form is opened afresh.
 */
export function useSubmissionId(): [string, () => void] {
  const [id, setId] = React.useState(() => crypto.randomUUID());
  const renew = React.useCallback(() => setId(crypto.randomUUID()), []);
  return [id, renew];
}

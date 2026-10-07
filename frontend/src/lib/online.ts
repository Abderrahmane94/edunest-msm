import * as React from 'react';

function subscribe(listener: () => void) {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

/** Whether the device has a connection; updates when it changes. */
export function useOnline(): boolean {
  return React.useSyncExternalStore(subscribe, () => navigator.onLine);
}

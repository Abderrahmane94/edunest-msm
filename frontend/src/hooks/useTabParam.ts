import * as React from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * The page's current tab, kept in the address (?tab=…): a link can open a
 * tab directly, and Back returns to the previous tab.
 */
export function useTabParam<T extends string>(tabs: readonly T[], fallback: T): [T, (tab: T) => void] {
  const [params, setParams] = useSearchParams();
  const param = params.get('tab') as T | null;
  const tab = param && tabs.includes(param) ? param : fallback;

  const setTab = React.useCallback(
    (next: T) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === fallback) p.delete('tab');
          else p.set('tab', next);
          return p;
        },
        { replace: false },
      );
    },
    [setParams, fallback],
  );

  return [tab, setTab];
}

import * as React from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * The page's current tab, kept in the address (?tab=…): a link can open a
 * tab directly, and Back returns to the previous tab. Tabs shown inside
 * another page's tab use their own `key` (e.g. ?tab=trash&section=payments).
 */
export function useTabParam<T extends string>(
  tabs: readonly T[],
  fallback: T,
  key = 'tab',
): [T, (tab: T) => void] {
  const [params, setParams] = useSearchParams();
  const param = params.get(key) as T | null;
  const tab = param && tabs.includes(param) ? param : fallback;

  const setTab = React.useCallback(
    (next: T) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === fallback) p.delete(key);
          else p.set(key, next);
          return p;
        },
        { replace: false },
      );
    },
    [setParams, fallback, key],
  );

  return [tab, setTab];
}

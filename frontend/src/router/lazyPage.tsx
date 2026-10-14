import * as React from 'react';

/** Whose pages: each role downloads its own, never the others'. */
export type PageGroup = 'office' | 'platform' | 'teacher' | 'parent';

type Loader = () => Promise<unknown>;
const loaders: Record<PageGroup, Loader[]> = { office: [], platform: [], teacher: [], parent: [] };

const RELOADED_KEY = 'kiddoo:page-reloaded';

/**
 * A page's file that will not load is, most of the time, one a new version
 * of the site has replaced: the page is reloaded once to get the new one.
 */
async function loadOrReload<T>(load: () => Promise<T>): Promise<T> {
  try {
    const loaded = await load();
    try {
      sessionStorage.removeItem(RELOADED_KEY);
    } catch {
      // No session storage: nothing to forget.
    }
    return loaded;
  } catch (error) {
    let already = true;
    try {
      already = sessionStorage.getItem(RELOADED_KEY) === '1';
      if (!already) sessionStorage.setItem(RELOADED_KEY, '1');
    } catch {
      // No session storage: do not risk reloading in a loop.
    }
    if (!already && navigator.onLine) {
      window.location.reload();
      // The reload takes over: leave the page waiting rather than showing an error.
      return new Promise<T>(() => {});
    }
    throw error;
  }
}

function PageLoading() {
  return (
    <div className="flex items-center justify-center py-16" role="status" aria-busy="true">
      <span className="h-6 w-6 rounded-full border-2 border-border border-t-primary animate-spin" />
    </div>
  );
}

/**
 * A page downloaded when it is first opened instead of with the whole site.
 * `load` returns the page's component.
 */
export function lazyPage(group: PageGroup, load: () => Promise<React.ComponentType>): React.ComponentType {
  loaders[group].push(load);
  const Lazy = React.lazy(() => loadOrReload(load).then((component) => ({ default: component })));
  return function Page() {
    return (
      <React.Suspense fallback={<PageLoading />}>
        <Lazy />
      </React.Suspense>
    );
  };
}

/**
 * Once the first page is on screen, fetches the role's other pages in the
 * background: moving around stays instant, and still works if the
 * connection drops afterwards.
 */
export function usePreloadPages(group: PageGroup | null): void {
  React.useEffect(() => {
    if (!group) return;
    const timer = window.setTimeout(() => {
      for (const load of loaders[group]) void load().catch(() => {});
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [group]);
}

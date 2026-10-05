import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';

/**
 * How long data loaded on this device stays available offline. Cached queries
 * are kept (in memory and in IndexedDB) for this long, so pages already
 * visited still show their last data without a connection.
 */
export const OFFLINE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: OFFLINE_MAX_AGE,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

/** Saves the query cache to IndexedDB (restored by PersistQueryClientProvider). */
export const queryPersister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get<string>(key).then((v) => v ?? null),
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
  key: 'edunest-query-cache',
  throttleTime: 1000,
});

/**
 * Wipes all cached server data, in memory and on the device, so the next
 * user never sees the previous user's data (and nothing stays on the device
 * after logout).
 */
export function clearQueryCache(): void {
  queryClient.clear();
  void Promise.resolve(queryPersister.removeClient()).catch(() => undefined);
}

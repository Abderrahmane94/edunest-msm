import { BrowserRouter, useRoutes } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, queryPersister, OFFLINE_MAX_AGE } from '@/lib/query-client';
import { AuthProvider } from '@/contexts/AuthContext';
import { useDirection } from '@/hooks/useDirection';
import { NotificationsManager } from '@/components/NotificationsManager';
import { routes } from '@/router';
import '@/i18n';

function AppRoutes() {
  const element = useRoutes(routes);
  return element;
}

function DirectionManager({ children }: { children: React.ReactNode }) {
  useDirection();
  return <>{children}</>;
}

function App() {
  return (
    // Data already loaded is saved on the device and restored at startup, so
    // pages show their last data offline. Pending writes aren't saved.
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: OFFLINE_MAX_AGE,
        buster: __BUILD_ID__,
        dehydrateOptions: { shouldDehydrateMutation: () => false },
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <DirectionManager>
            <NotificationsManager />
            <AppRoutes />
          </DirectionManager>
        </AuthProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  );
}

export default App;

import { BrowserRouter, useRoutes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { AuthProvider } from '@/contexts/AuthContext';
import { useDirection } from '@/hooks/useDirection';
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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <DirectionManager>
            <AppRoutes />
          </DirectionManager>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

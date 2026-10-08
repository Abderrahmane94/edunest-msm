import { useAuth } from '@/contexts/AuthContext';
import { AdminDashboard } from './dashboard/AdminDashboard';
import { PlatformDashboard } from './dashboard/PlatformDashboard';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="animate-fade-in">
      {user?.role === 'super_admin' ? <PlatformDashboard /> : <AdminDashboard />}
    </div>
  );
}

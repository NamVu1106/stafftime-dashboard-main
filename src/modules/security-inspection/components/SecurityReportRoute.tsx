import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/** Admin hoặc manager được gán ít nhất một bộ phận */
export function SecurityReportRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  const canView =
    user?.role === 'admin' ||
    (user?.role === 'manager' && (user.departmentIds?.length ?? 0) > 0);

  if (!canView) {
    return <Navigate to="/security" replace />;
  }

  return <>{children}</>;
}

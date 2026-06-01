import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/hooks/useI18n';

/** Chỉ admin/manager (role admin) xem báo cáo quản lý */
export function SecurityAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const { t } = useI18n();

  if (isLoading) return null;
  if (!user || user.role !== 'admin') {
    return <Navigate to="/security" replace state={{ message: t('securityInspection.adminOnly') }} />;
  }
  return <>{children}</>;
}

import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, BarChart3, QrCode, Shield } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { useAuth } from '@/contexts/AuthContext';
import { ConnectionStatus } from './ConnectionStatus';
import { useSecuritySync } from '../hooks/useSecuritySync';

export function SecurityLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { user } = useAuth();
  const { online, pending } = useSecuritySync();
  const canManage =
    user?.role === 'admin' ||
    (user?.role === 'manager' && (user.departmentIds?.length ?? 0) > 0);
  const isReport = location.pathname.includes('/report');
  const isAssetsAdmin = location.pathname.includes('/admin/assets');
  const wideMain = isReport || isAssetsAdmin;

  return (
    <div className="sec-tablet-app min-h-[100dvh] bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-50 border-b-2 border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <button
            type="button"
            className="sec-touch-btn flex min-h-12 min-w-12 items-center justify-center rounded-xl border-2 border-slate-200"
            onClick={() => navigate('/')}
            aria-label={t('securityInspection.back')}
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Shield className="h-6 w-6 shrink-0 text-emerald-700" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">{t('securityInspection.title')}</p>
              <p className="truncate text-xs text-slate-500">{t('securityInspection.subtitle')}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canManage && (
              <>
                <button
                  type="button"
                  className="sec-touch-btn flex min-h-12 items-center gap-1 rounded-xl border-2 border-slate-300 bg-white px-2 text-xs font-bold sm:px-3"
                  onClick={() =>
                    navigate(isAssetsAdmin ? '/security' : '/security/admin/assets')
                  }
                  title={t('securityInspection.assetsAdmin')}
                >
                  <QrCode className="h-5 w-5" />
                  <span className="hidden md:inline">{t('securityInspection.assetsShort')}</span>
                </button>
                <button
                  type="button"
                  className="sec-touch-btn flex min-h-12 items-center gap-1 rounded-xl border-2 border-emerald-600 bg-emerald-50 px-2 text-xs font-bold text-emerald-800 sm:px-3"
                  onClick={() => navigate(isReport ? '/security' : '/security/report')}
                >
                  <BarChart3 className="h-5 w-5" />
                  <span className="hidden md:inline">
                    {isReport ? t('securityInspection.backToField') : t('securityInspection.openReport')}
                  </span>
                </button>
              </>
            )}
            <ConnectionStatus online={online} pending={pending} />
          </div>
        </div>
      </header>
      <main
        className={
          wideMain
            ? 'mx-auto max-w-6xl px-4 pb-8 pt-4'
            : 'mx-auto max-w-3xl px-4 pb-28 pt-4'
        }
      >
        <Outlet />
      </main>
    </div>
  );
}

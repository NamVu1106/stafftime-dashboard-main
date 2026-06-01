import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { securityInspectionAPI } from '../api';
import { DeptCard } from '../components/DeptCard';
import { getCachedTemplate, cacheTemplate } from '../offline/idb';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Loader2 } from 'lucide-react';

const FALLBACK_DEPTS = [
  { id: 1, code: 'AN', name: 'An ninh vật lý', color: '#2563eb', progressPercent: 0, submittedToday: 0, draftToday: 0 },
  { id: 2, code: 'BV', name: 'Bảo vệ cổng', color: '#16a34a', progressPercent: 0, submittedToday: 0, draftToday: 0 },
];

export default function SecurityDashboardPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const [offlineDepts, setOfflineDepts] = useState(FALLBACK_DEPTS);

  const { data, isLoading } = useQuery({
    queryKey: ['security-departments'],
    queryFn: () => securityInspectionAPI.getDepartments(),
    enabled: online,
    retry: 1,
  });

  useEffect(() => {
    if (!data?.data) return;
    data.data.forEach(async (d) => {
      try {
        const tpl = await securityInspectionAPI.getTemplate(d.id);
        await cacheTemplate(d.id, tpl);
      } catch {
        /* offline cache optional */
      }
    });
  }, [data]);

  useEffect(() => {
    (async () => {
      const cached = await getCachedTemplate(1);
      if (cached && !online) setOfflineDepts(FALLBACK_DEPTS);
    })();
  }, [online]);

  const depts = online && data?.data?.length ? data.data : offlineDepts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('securityInspection.selectDept')}</h1>
        <p className="mt-1 text-sm font-medium text-slate-600">{t('securityInspection.progressToday')}</p>
      </div>
      {isLoading && online ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {depts.map((d) => (
            <DeptCard key={d.id} dept={d} onClick={() => navigate(`/security/scan/${d.id}`)} />
          ))}
        </div>
      )}
      {!online && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          {t('securityInspection.offline')} — checklist dùng bản cache nếu đã tải trước đó.
        </p>
      )}
    </div>
  );
}

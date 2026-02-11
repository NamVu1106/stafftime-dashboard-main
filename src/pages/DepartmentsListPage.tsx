import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { statisticsAPI } from '@/services/api';
import { useI18n } from '@/contexts/I18nContext';

// Fallback khi chưa có file Excel: 7 bộ phận (không có Khác)
const FALLBACK_DEPTS = ['VPQL', 'MM', 'QC', 'CS', 'SM', 'EQM', 'PROD'] as const;
const FALLBACK_LABELS: Record<string, string> = {
  VPQL: 'VPQL', MM: 'MM', QC: 'QC', CS: 'CS', SM: 'SM', EQM: 'EQM',
  PROD: 'PROD (Sản xuất)',
};

const DepartmentsListPage = () => {
  const { t } = useI18n();
  const { data: fromExcel, isLoading: loadingExcel } = useQuery({
    queryKey: ['departments-from-excel'],
    queryFn: () => statisticsAPI.getDepartmentsFromExcel(),
  });
  const { isLoading: loadingStats, error } = useQuery({
    queryKey: ['department', 'all-stats'],
    queryFn: () => statisticsAPI.getDepartment(undefined),
  });

  // Ưu tiên danh sách từ file Excel (02-03.02); không có thì dùng fallback (không Khác)
  const groupStats = useMemo(() => {
    const list = (fromExcel as any)?.departments;
    if (Array.isArray(list) && list.length > 0) {
      return list.map((key: string) => ({ key, label: key }));
    }
    return FALLBACK_DEPTS.map(key => ({
      key,
      label: FALLBACK_LABELS[key] || key,
    }));
  }, [fromExcel]);
  const isLoading = loadingExcel || loadingStats;

  return (
    <div>
      <PageHeader
        title={t('sidebar.departments')}
        description={t('department.listDescription') || 'Chọn bộ phận để xem thống kê và danh sách nhân viên.'}
      />
      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>
      )}
      {error && (
        <div className="text-center py-12 text-destructive">
          {t('common.error')}: {(error as Error).message}
        </div>
      )}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {groupStats.map(({ key, label }) => (
            <DepartmentGroupCard key={key} groupKey={key} label={label} t={t} />
          ))}
        </div>
      )}
    </div>
  );
};

// Thẻ 1 bộ phận: gọi API /departments/:groupKey/stats để lấy số liệu gộp, link sang trang chi tiết
function DepartmentGroupCard({
  groupKey,
  label,
  t,
}: {
  groupKey: string;
  label: string;
  t: (k: string) => string;
}) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['department-stats', groupKey],
    queryFn: () => statisticsAPI.getDepartmentStats(groupKey),
    enabled: true,
  });
  const attendance = (stats as any)?.attendance ?? 0;
  const totalEmployees = (stats as any)?.totalEmployees ?? 0;
  const attendanceRate = (stats as any)?.attendanceRate ?? 0;

  return (
    <Link
      to={`/departments/${encodeURIComponent(groupKey)}`}
      className="block p-4 rounded-lg border border-border bg-card hover:bg-muted/50 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="w-5 h-5 text-primary" />
        <span className="font-semibold">{label}</span>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : (
        <div className="text-sm text-muted-foreground">
          <span>{t('dashboard.attendance')}: {attendance}/{totalEmployees}</span>
          <span className="mx-1">·</span>
          <span>{Number(attendanceRate).toFixed(1)}%</span>
        </div>
      )}
    </Link>
  );
}

export default DepartmentsListPage;

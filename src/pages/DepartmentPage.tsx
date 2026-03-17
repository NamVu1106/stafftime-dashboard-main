import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Users, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { statisticsAPI } from '@/services/api';
import { useI18n } from '@/contexts/I18nContext';
import { useTimeFilter } from '@/contexts/TimeFilterContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface DepartmentStats {
  department?: string;
  totalEmployees?: number;
  attendanceRate?: number | string;
  chinhThucCount?: number;
  thoiVuCount?: number;
  employees?: { code: string; name: string; daysWorked: number; totalHours: number; attendanceRate: number }[];
}

const DepartmentPage = () => {
  const { t } = useI18n();
  const { dept } = useParams<{ dept: string }>();
  const { params } = useTimeFilter();

  const { data: statsData, isLoading } = useQuery({
    queryKey: ['department-stats', dept, params.date, params.start_date, params.end_date],
    queryFn: () => statisticsAPI.getDepartmentStats(dept || '', params),
    enabled: !!dept,
  });
  const stats = statsData as DepartmentStats | undefined;

  // Tên hiển thị: ưu tiên từ API (stats.department), không thì dùng param từ URL (có thể đã decode)
  const deptName = (dept && stats?.department) ? stats.department : (dept ? decodeURIComponent(dept) : 'Phòng ban');

  const chartData = stats ? [
    { name: t('department.attendanceRate'), value: parseFloat(String(stats.attendanceRate || '0')) },
  ] : [];
  const hasChartData = (stats?.totalEmployees ?? 0) > 0 || parseFloat(String(stats?.attendanceRate || '0')) > 0;
  const hasPieData = ((stats?.chinhThucCount ?? 0) + (stats?.thoiVuCount ?? 0)) > 0;

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div>
      <PageHeader 
        title={`${t('reports.title')} - ${deptName}`}
        description={`${t('department.description') || 'Thống kê và báo cáo chi tiết cho'} ${deptName}`}
      />

      {/* Thông tin phòng ban */}
      <div className="mb-6 p-4 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">{t('department.info')}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <span className="text-sm text-muted-foreground">{t('department.name')}</span>
            <div className="text-lg font-semibold">{deptName}</div>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">{t('department.totalEmployees')}</span>
            <div className="text-lg font-semibold">{stats?.totalEmployees || 0}</div>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">{t('department.avgAttendanceRate')}</span>
            <div className="text-lg font-semibold">{stats?.attendanceRate || '0'}%</div>
          </div>
        </div>
      </div>

      {/* Bộ lọc thời gian: dùng chung từ Sidebar — đồng bộ toàn hệ thống */}

      {/* Biểu đồ thống kê */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="p-4 bg-card border border-border rounded-lg">
            <h3 className="font-semibold mb-4">{t('department.attendanceOverTime')}</h3>
            {hasChartData ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                {t('common.noData')}
              </div>
            )}
          </div>
          <div className="p-4 bg-card border border-border rounded-lg">
            <h3 className="font-semibold mb-4">{t('department.employeeDistribution')}</h3>
            {hasPieData ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: t('department.official'), value: stats.chinhThucCount || 0 },
                      { name: t('department.seasonal'), value: stats.thoiVuCount || 0 },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {[0, 1].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                {t('common.noData')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Danh sách nhân viên */}
      <div className="p-4 bg-card border border-border rounded-lg">
        <h3 className="font-semibold text-lg mb-4">{t('department.employeeList')}</h3>
        {isLoading ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : stats?.employees && stats.employees.length > 0 ? (
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)] relative">
            <table className="w-full data-table">
              <thead className="sticky top-0 z-30 bg-muted">
                <tr className="border-b">
                  <th className="text-left p-2 bg-muted" style={{ position: 'sticky', top: 0 }}>{t('department.employeeCode')}</th>
                  <th className="text-left p-2 bg-muted" style={{ position: 'sticky', top: 0 }}>{t('department.employeeName')}</th>
                  <th className="text-left p-2 bg-muted" style={{ position: 'sticky', top: 0 }}>{t('department.daysWorked')}</th>
                  <th className="text-left p-2 bg-muted" style={{ position: 'sticky', top: 0 }}>{t('department.totalHours')}</th>
                  <th className="text-left p-2 bg-muted" style={{ position: 'sticky', top: 0 }}>{t('department.attendanceRate')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.employees.map((emp: any, index: number) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="p-2">{emp.code || t('dashboard.na')}</td>
                    <td className="p-2">{emp.name || t('dashboard.na')}</td>
                    <td className="p-2">{emp.daysWorked || 0}</td>
                    <td className="p-2">{emp.totalHours || 0}h</td>
                    <td className="p-2">{emp.attendanceRate || '0'}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">{t('common.noData')}</div>
        )}
      </div>
    </div>
  );
};

export default DepartmentPage;




import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  TrendingUp,
  Clock,
  BarChart3,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { statisticsAPI, hrExcelAPI, hrTemplatesAPI } from '@/services/api';
import { useTimeFilterOptional } from '@/contexts/TimeFilterContext';
import { formatNumberPlain } from '@/lib/utils';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { extractHrBuiltInStats } from '@/lib/hrBuiltInStats';
import { buildHrBuiltInSummary, buildHrUploadSummary, type HrSummaryPanel } from '@/lib/hrReportInsights';

const HR_STATS_REPORT_TYPES = [
  'attendance-rate',
  'attendance-count',
  'temp-timesheet',
  'official-timesheet',
  'labor-rate',
  'weekly-one-day-workers',
  'payroll-kpi',
  'workforce-summary',
  'bhxh-list',
  'payroll',
  'daily-wage',
  'arrears-collection',
  'insurance-master',
  'drug-inventory',
  'medical-room-usage',
] as const;

const BUILT_IN_HR_REPORT_TYPES = new Set([
  'attendance-rate',
  'attendance-count',
  'temp-timesheet',
  'official-timesheet',
  'labor-rate',
  'weekly-one-day-workers',
  'payroll-kpi',
  'workforce-summary',
  'payroll',
  'daily-wage',
] as const);

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function HrSummaryPage() {
  const timeFilter = useTimeFilterOptional();
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const todayIso = `${y}-${m}-${String(now.getDate()).padStart(2, '0')}`;
  const monthStart = `${y}-${m}-01`;
  const monthEnd = `${y}-${m}-${String(new Date(y, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

  const range = (() => {
    if (timeFilter?.params?.start_date && timeFilter?.params?.end_date) {
      return { start_date: timeFilter.params.start_date, end_date: timeFilter.params.end_date };
    }
    return { start_date: monthStart, end_date: monthEnd };
  })();

  const { data: dashboardStats } = useQuery({
    queryKey: ['dashboard', 'summary', range.start_date, range.end_date],
    queryFn: () => statisticsAPI.getDashboard({ start_date: range.start_date, end_date: range.end_date }),
  });

  const { data: todayStats } = useQuery({
    queryKey: ['dashboard', 'today'],
    queryFn: () => statisticsAPI.getDashboard({ date: todayIso }),
  });

  const stats = dashboardStats || {};
  const today = todayStats || {};

  const hrStatsQueries = useQuery({
    queryKey: ['hr-summary', range.start_date, range.end_date],
    queryFn: async () => {
      const results: Record<string, any> = {};
      await Promise.all(
        HR_STATS_REPORT_TYPES.map(async (type) => {
          try {
            if (BUILT_IN_HR_REPORT_TYPES.has(type)) {
              const grid = await hrTemplatesAPI.getGrid(type, range);
              results[type] = {
                stats: extractHrBuiltInStats(type, grid),
                summary: buildHrBuiltInSummary(type, grid, range),
                source: 'system',
              };
            } else {
              const statsResult = await hrExcelAPI.getStats(type);
              results[type] = statsResult
                ? {
                    ...statsResult,
                    summary: buildHrUploadSummary(
                      type,
                      statsResult,
                      { default_sheet: (statsResult as any)?.sheetName },
                      undefined
                    ),
                    source: 'upload',
                  }
                : null;
            }
          } catch {
            results[type] = null;
          }
        })
      );
      return results;
    },
  });

  const hrStats = hrStatsQueries.data || {};

  const summaryCards = [
    {
      title: 'Tổng nhân viên',
      value: formatNumberPlain((stats as any).totalEmployees ?? 0),
      icon: Users,
      sub: `Đi làm hôm nay: ${formatNumberPlain((today as any).totalEmployees ?? (stats as any).totalEmployees ?? 0)}`,
    },
    {
      title: 'Tỉ lệ đi làm',
      value: `${(stats as any).attendanceRate ?? 0}%`,
      icon: TrendingUp,
      sub: `Hôm nay: ${(today as any).attendanceRate ?? '—'}%`,
    },
    {
      title: 'Chính thức',
      value: `${(stats as any).chinhThucRate ?? 0}%`,
      icon: UserCheck,
      sub: 'Tỉ lệ đi làm NV chính thức',
    },
    {
      title: 'Thời vụ',
      value: `${(stats as any).thoiVuRate ?? 0}%`,
      icon: Clock,
      sub: 'Tỉ lệ đi làm NV thời vụ',
    },
    {
      title: 'Đi trễ hôm nay',
      value: formatNumberPlain((today as any).lateToday ?? (stats as any).lateToday ?? 0),
      icon: Clock,
      sub: 'Số NV đi trễ',
    },
    {
      title: 'Tổng giờ công',
      value: `${formatNumberPlain((stats as any).totalHoursToday ?? 0)}h`,
      icon: BarChart3,
      sub: 'Tổng giờ trong kỳ',
    },
  ];

  const hrExcelCards = [
    { key: 'attendance-rate', label: 'Tỉ lệ đi làm', rate: (hrStats['attendance-rate'] as any)?.stats?.overall?.rate },
    { key: 'attendance-count', label: 'Số lượng đi làm', sum: (hrStats['attendance-count'] as any)?.stats?.attendanceCount?.sums },
    { key: 'temp-timesheet', label: 'Công thời vụ', hours: (hrStats['temp-timesheet'] as any)?.stats?.timesheet?.sums?.workHours },
    { key: 'official-timesheet', label: 'Công chính thức', hours: (hrStats['official-timesheet'] as any)?.stats?.timesheet?.sums?.workHours },
    { key: 'labor-rate', label: 'Tỉ lệ lao động', rate: (hrStats['labor-rate'] as any)?.stats?.overall?.rate },
    { key: 'bhxh-list', label: 'BHXH (số phải nộp)', value: (hrStats['bhxh-list'] as any)?.stats?.bhxhList?.soPhaiNop?.value },
    { key: 'payroll', label: 'Lương/Thuế', value: (hrStats['payroll'] as any)?.stats?.payroll?.tax?.totalSum },
    { key: 'daily-wage', label: 'Tiền công hàng ngày', value: (hrStats['daily-wage'] as any)?.stats?.dailyWage?.grandTotal },
    { key: 'arrears-collection', label: 'Truy thu', value: (hrStats['arrears-collection'] as any)?.stats?.arrearsCollection?.amountMax },
    { key: 'insurance-master', label: 'Bảo hiểm (số NV)', value: (hrStats['insurance-master'] as any)?.stats?.insuranceMaster?.employeesCount },
  ];

  const pieData = [
    { name: 'Chính thức', value: (stats as any).chinhThucCount ?? 0, color: CHART_COLORS[0] },
    { name: 'Thời vụ', value: (stats as any).thoiVuCount ?? 0, color: CHART_COLORS[1] },
  ].filter((d) => d.value > 0);

  const systemReportCards = [
    { key: 'attendance-rate', label: 'Tỉ lệ đi làm' },
    { key: 'attendance-count', label: 'Số lượng đi làm' },
    { key: 'temp-timesheet', label: 'Công thời vụ' },
    { key: 'official-timesheet', label: 'Công chính thức' },
    { key: 'labor-rate', label: 'Tỉ lệ nhân lực' },
    { key: 'weekly-one-day-workers', label: 'Thời vụ làm 1 công/tuần' },
    { key: 'workforce-summary', label: 'Báo cáo tổng hợp nhân lực' },
    { key: 'payroll-kpi', label: 'KPI nhân sự' },
    { key: 'payroll', label: 'Lương / Thuế' },
    { key: 'daily-wage', label: 'Tiền công hàng ngày' },
  ].map((item) => ({
    ...item,
    summary: (hrStats[item.key] as any)?.summary as HrSummaryPanel | null | undefined,
  }));

  const uploadReportCards = [
    { key: 'bhxh-list', label: 'Danh sách tham gia BHXH' },
    { key: 'insurance-master', label: 'Biểu mẫu bảo hiểm' },
    { key: 'arrears-collection', label: 'Truy thu' },
    { key: 'drug-inventory', label: 'Xuất nhập tồn thuốc' },
    { key: 'medical-room-usage', label: 'Hiện trạng sử dụng phòng y tế' },
  ].map((item) => ({
    ...item,
    summary: (hrStats[item.key] as any)?.summary as HrSummaryPanel | null | undefined,
  }));

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Báo cáo tổng hợp Nhân sự"
        description="Tổng hợp chỉ số chính từ chấm công hệ thống và các báo cáo HR upload riêng — dành cho lãnh đạo xem nhanh một lượt."
      />

      <div className="flex flex-wrap gap-2 items-center text-sm text-muted-foreground">
        <Calendar className="w-4 h-4" />
        <span>Kỳ: {range.start_date} → {range.end_date}</span>
        {timeFilter && (
          <span className="ml-2">(Bộ lọc thời gian từ Sidebar)</span>
        )}
      </div>

      {/* Chỉ số chính từ chấm công */}
      <Card>
        <CardHeader>
          <CardTitle>Chỉ số chấm công</CardTitle>
          <CardDescription>Từ dữ liệu hệ thống chấm công (theo bộ lọc thời gian)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {summaryCards.map((c) => (
              <Card key={c.title} className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <c.icon className="w-4 h-4" />
                    <span className="text-xs font-medium">{c.title}</span>
                  </div>
                  <div className="text-xl font-bold">{c.value}</div>
                  {c.sub && <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Biểu đồ tròn tổng hợp */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {pieData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Phân bổ loại hình NV</CardTitle>
              <CardDescription>Chính thức vs Thời vụ</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      isAnimationActive={false}
                    >
                      {pieData.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Báo cáo HR tích hợp máy chấm công</CardTitle>
          <CardDescription>
            Nhóm báo cáo lấy trực tiếp từ dữ liệu hệ thống, đã bổ sung KPI chính và nhận xét nhanh theo kỳ lọc.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {systemReportCards.map((item) => {
              const leadMetric = item.summary?.metrics?.[0];
              const moreMetrics = item.summary?.metrics?.slice(1, 4) || [];
              const notes = item.summary?.notes?.slice(0, 2) || [];
              return (
                <Link key={item.key} to={`/hr/${item.key}`}>
                  <Card className="h-full hover:bg-muted/50 transition-colors">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{item.label}</CardTitle>
                      <CardDescription>
                        {item.summary?.description || 'Bấm vào để xem báo cáo chi tiết.'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {leadMetric ? (
                        <div className="rounded-lg border bg-muted/20 p-3">
                          <div className="text-xs font-medium text-muted-foreground">{leadMetric.label}</div>
                          <div className="mt-1 text-2xl font-semibold">{leadMetric.value}</div>
                          {leadMetric.hint ? (
                            <div className="mt-1 text-xs text-muted-foreground">{leadMetric.hint}</div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                          Chưa có dữ liệu để tổng hợp trong kỳ này.
                        </div>
                      )}

                      {moreMetrics.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {moreMetrics.map((metric) => (
                            <div key={metric.label} className="rounded-md border bg-background p-2">
                              <div className="text-[11px] text-muted-foreground">{metric.label}</div>
                              <div className="mt-1 text-sm font-semibold">{metric.value}</div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {notes.length > 0 ? (
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {notes.map((note) => (
                            <div key={note}>- {note}</div>
                          ))}
                        </div>
                      ) : null}

                      <div className="flex items-center gap-1 text-primary text-xs">
                        <span>Chi tiết</span>
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Báo cáo HR upload Excel riêng</CardTitle>
          <CardDescription>
            Nhóm báo cáo không lấy từ máy chấm công, nhưng vẫn có khối tổng hợp nhanh để đọc rõ hơn sau khi upload file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {uploadReportCards.map((item) => {
              const leadMetric = item.summary?.metrics?.[0];
              const moreMetrics = item.summary?.metrics?.slice(1, 4) || [];
              const notes = item.summary?.notes?.slice(0, 2) || [];
              return (
                <Link key={item.key} to={`/hr/${item.key}`}>
                  <Card className="h-full hover:bg-muted/50 transition-colors">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{item.label}</CardTitle>
                      <CardDescription>
                        {item.summary?.description || 'Upload file đúng mẫu để hệ thống phân tích báo cáo.'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {leadMetric ? (
                        <div className="rounded-lg border bg-muted/20 p-3">
                          <div className="text-xs font-medium text-muted-foreground">{leadMetric.label}</div>
                          <div className="mt-1 text-2xl font-semibold">{leadMetric.value}</div>
                          {leadMetric.hint ? (
                            <div className="mt-1 text-xs text-muted-foreground">{leadMetric.hint}</div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                          Chưa có file upload hoặc chưa phân tích được dữ liệu.
                        </div>
                      )}

                      {moreMetrics.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {moreMetrics.map((metric) => (
                            <div key={metric.label} className="rounded-md border bg-background p-2">
                              <div className="text-[11px] text-muted-foreground">{metric.label}</div>
                              <div className="mt-1 text-sm font-semibold">{metric.value}</div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {notes.length > 0 ? (
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {notes.map((note) => (
                            <div key={note}>- {note}</div>
                          ))}
                        </div>
                      ) : null}

                      <div className="flex items-center gap-1 text-primary text-xs">
                        <span>Chi tiết</span>
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link to="/">← Về Tổng quan</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/">Nhân sự → Chọn chức năng</Link>
        </Button>
      </div>
    </div>
  );
}

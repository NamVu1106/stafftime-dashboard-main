import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, TrendingUp, Clock, Timer, UserCheck, Users2, Calendar, Building2, Filter, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { statisticsAPI, timekeepingAPI } from '@/services/api';
import { useI18n } from '@/contexts/I18nContext';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

const Index = () => {
  const { t } = useI18n();
  // Bộ lọc ngày - mặc định là null để hiển thị tất cả dữ liệu
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'day' | 'month' | 'year' | 'single' | 'range'>('day'); // day: hôm nay; month: tháng này; year: năm này; single: 1 ngày; range: giai đoạn
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  const toLocalYmd = (dt: Date) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const parseYmdLocal = (ymd: string) => {
    // ymd is expected as YYYY-MM-DD from <input type="date">
    const parts = ymd.split('-').map(Number);
    if (parts.length === 3 && parts.every(n => !Number.isNaN(n))) {
      const [y, m, d] = parts;
      return new Date(y, m - 1, d);
    }
    return new Date(ymd);
  };

  // Use local date to avoid timezone shift (toISOString() can change day)
  const todayIso = toLocalYmd(new Date());
  const baseDate = selectedDate || todayIso;

  const getMonthRange = (dateStr: string) => {
    const d = parseYmdLocal(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-based
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return { start: toLocalYmd(start), end: toLocalYmd(end) };
  };

  const monthPlaceholderLabel = (() => {
    const d = parseYmdLocal(baseDate);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const y = d.getFullYear();
    // Requirement: show dd/MM/YYYY (dd is placeholder, not a number)
    return `dd/${m}/${y}`;
  })();

  const dayDisplayLabel = (() => {
    const d = parseYmdLocal(baseDate);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  })();

  // Tính toán params cho filter hiện tại
  const params =
    filterMode === 'month'
      ? (() => {
          const { start, end } = getMonthRange(baseDate);
          return { date: undefined, start_date: start, end_date: end };
        })()
      : filterMode === 'year'
      ? (() => {
          const year = new Date().getFullYear();
          return { date: undefined, start_date: `${year}-01-01`, end_date: `${year}-12-31` };
        })()
      : filterMode === 'range'
      ? { date: undefined, start_date: dateRange.start || undefined, end_date: dateRange.end || undefined }
      : filterMode === 'single'
      ? { date: selectedDate || undefined, start_date: undefined, end_date: undefined }
      : { date: todayIso, start_date: undefined, end_date: undefined };

  // Tính toán params cho 3 cột thống kê (Ngày/Tháng/Năm)
  const todayParams = { date: todayIso, start_date: undefined, end_date: undefined };
  const monthParams = (() => {
    const { start, end } = getMonthRange(todayIso);
    return { date: undefined, start_date: start, end_date: end };
  })();
  const yearParams = (() => {
    const year = new Date().getFullYear();
    return { date: undefined, start_date: `${year}-01-01`, end_date: `${year}-12-31` };
  })();
  
  // Fetch data from API - nếu không có date thì không filter
  const { data: dashboardStats, isLoading: loadingStats } = useQuery({
    queryKey: ['dashboard', params.date, params.start_date, params.end_date],
    queryFn: () => statisticsAPI.getDashboard(params),
  });

  // Fetch data cho 3 cột thống kê (Ngày/Tháng/Năm)
  const { data: todayStats } = useQuery({
    queryKey: ['dashboard', 'today', todayParams.date],
    queryFn: () => statisticsAPI.getDashboard(todayParams),
  });

  const { data: monthStats } = useQuery({
    queryKey: ['dashboard', 'month', monthParams.start_date, monthParams.end_date],
    queryFn: () => statisticsAPI.getDashboard(monthParams),
  });

  const { data: yearStats } = useQuery({
    queryKey: ['dashboard', 'year', yearParams.start_date, yearParams.end_date],
    queryFn: () => statisticsAPI.getDashboard(yearParams),
  });

  const { data: genderData = [] } = useQuery({
    queryKey: ['gender'],
    queryFn: () => statisticsAPI.getGender(),
  });

  const { data: ageData = [] } = useQuery({
    queryKey: ['age'],
    queryFn: () => statisticsAPI.getAge(),
  });

  const { data: employmentTypeData = [] } = useQuery({
    queryKey: ['employmentType'],
    queryFn: () => statisticsAPI.getEmploymentType(),
  });

  const { data: attendanceRateByDept = [] } = useQuery({
    queryKey: ['department', params.date, params.start_date, params.end_date],
    queryFn: () => statisticsAPI.getDepartment(params),
  });
  
  // Debug log
  console.log('Dashboard - attendanceRateByDept:', attendanceRateByDept);

  const { data: genderByEmploymentType } = useQuery({
    queryKey: ['genderByEmploymentType'],
    queryFn: () => statisticsAPI.getGenderByEmploymentType(),
  });

  const { data: attendanceByDate = [] } = useQuery({
    queryKey: ['attendanceByDate'],
    queryFn: () => statisticsAPI.getAttendanceByDate(7),
  });

  const { data: recentTimekeepingData } = useQuery({
    queryKey: ['recentTimekeeping', params.date, params.start_date, params.end_date],
    queryFn: () => {
      if (filterMode === 'month') {
        return timekeepingAPI.getAll({
          start_date: params.start_date,
          end_date: params.end_date,
        });
      }
      return timekeepingAPI.getAll({ 
        start_date: baseDate, 
        end_date: baseDate,
      });
    },
  });
  
  // Extract data array from response (API returns { data, total, ... } or array)
  const recentTimekeeping = Array.isArray(recentTimekeepingData) 
    ? recentTimekeepingData 
    : ((recentTimekeepingData as any)?.data || []);

  // Helper function to cap percentage at 100%
  const capPercentage = (value: number, total: number): string => {
    if (total <= 0) return '0';
    const percent = (value / total) * 100;
    return Math.min(percent, 100).toFixed(1);
  };
  
  // Helper function to translate API values
  const translateValue = (value: string): string => {
    const translations: Record<string, string> = {
      'Nam': t('employees.male'),
      'Nữ': t('employees.female'),
      'Chính thức': t('employees.official'),
      'Thời vụ': t('employees.seasonal'),
      'CA NGAY': t('dashboard.shiftDay'),
      'CA DEM': t('dashboard.shiftNight'),
    };
    return translations[value] || value;
  };
  
  // Calculate additional stats
  const totalEmployees = (dashboardStats as any)?.totalEmployees || 0;
  const maleCount = (genderData as any[]).find((g: any) => g.name === 'Nam')?.value || 0;
  const femaleCount = (genderData as any[]).find((g: any) => g.name === 'Nữ')?.value || 0;
  const malePercent = capPercentage(maleCount, totalEmployees);
  const femalePercent = capPercentage(femaleCount, totalEmployees);
  
  // Find largest age group
  const largestAgeGroup = (ageData as any[]).length > 0 
    ? (ageData as any[]).reduce((max: any, group: any) => group.value > max.value ? group : max, (ageData as any[])[0])
    : { name: t('dashboard.na'), value: 0 };
  
  // Find department with highest attendance rate; if tie, prefer higher attendance count, then totalEmployees
  const bestDept = (attendanceRateByDept as any[]).length > 0
    ? (attendanceRateByDept as any[]).reduce((max: any, dept: any) => {
        if (dept.attendanceRate > max.attendanceRate) return dept;
        if (dept.attendanceRate < max.attendanceRate) return max;
        // tie on rate: pick higher attendance count
        if ((dept.attendance || 0) > (max.attendance || 0)) return dept;
        if ((dept.attendance || 0) < (max.attendance || 0)) return max;
        // tie: pick higher totalEmployees
        if ((dept.totalEmployees || 0) > (max.totalEmployees || 0)) return dept;
        return max;
      }, (attendanceRateByDept as any[])[0])
    : { department: t('dashboard.na'), attendanceRate: 0, attendance: 0, totalEmployees: 0 };
  
  // Recent activity (last 15 records)
  const recentActivity = recentTimekeeping.slice(0, 15);

  // Format date for display
  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (loadingStats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const stats = dashboardStats || {
    totalEmployees: 0,
    attendanceRate: '0',
    lateToday: 0,
    totalHoursToday: '0',
    chinhThucRate: '0',
    thoiVuRate: '0',
  };

  const genderByEmpType = genderByEmploymentType || {
    chinhThucNam: { count: 0, percent: '0' },
    chinhThucNu: { count: 0, percent: '0' },
    thoiVuNam: { count: 0, percent: '0' },
    thoiVuNu: { count: 0, percent: '0' },
  };

  // Format attendance data for chart
  const formattedAttendanceData = (attendanceByDate as any[]).map((item: any) => ({
    date: new Date(item.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
    rate: capPercentage(item.attendance, totalEmployees),
    attendance: item.attendance,
  }));

  // Custom tooltip for department attendance (show % and attendance/total)
  const renderDeptTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-md border border-border bg-card px-3 py-2 text-sm shadow">
          <div className="font-semibold">{data.department}</div>
          <div>{t('dashboard.rate')}: {data.attendanceRate}%</div>
          <div>{t('dashboard.attendance')}: {data.attendance}/{data.totalEmployees}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <PageHeader 
        title={t('dashboard.title')} 
        description={`${t('dashboard.welcome')} ${
          filterMode === 'month'
            ? `${(() => { const d = parseYmdLocal(baseDate); return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; })()} ${t('dashboard.thisMonth').toLowerCase()}`
            : baseDate === todayIso
              ? t('dashboard.today').toLowerCase()
              : `${t('dashboard.oneDay')} ${formatDateDisplay(baseDate)}`
        }.`}
      />

      {/* Bộ lọc thời gian */}
      <div className="mb-6 p-4 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">{t('dashboard.timeFilter')}</h3>
        </div>
        <div className="space-y-4">
          {/* Radio buttons cho chọn loại filter */}
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="filter-mode"
                value="day"
                checked={filterMode === 'day'}
                onChange={() => {
                  setFilterMode('day');
                  setSelectedDate(todayIso);
                }}
                className="w-4 h-4 text-primary"
              />
              <span className="text-sm">{t('dashboard.today')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="filter-mode"
                value="month"
                checked={filterMode === 'month'}
                onChange={() => {
                  setFilterMode('month');
                  setSelectedDate(todayIso);
                }}
                className="w-4 h-4 text-primary"
              />
              <span className="text-sm">{t('dashboard.thisMonth')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="filter-mode"
                value="year"
                checked={filterMode === 'year'}
                onChange={() => setFilterMode('year')}
                className="w-4 h-4 text-primary"
              />
              <span className="text-sm">{t('dashboard.thisYear')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="filter-mode"
                value="single"
                checked={filterMode === 'single'}
                onChange={() => setFilterMode('single')}
                className="w-4 h-4 text-primary"
              />
              <span className="text-sm">{t('dashboard.oneDay')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="filter-mode"
                value="range"
                checked={filterMode === 'range'}
                onChange={() => setFilterMode('range')}
                className="w-4 h-4 text-primary"
              />
              <span className="text-sm">{t('dashboard.period')}</span>
            </label>
          </div>

          {/* Date picker tương ứng với lựa chọn */}
        <div className="flex items-center gap-4">
            {filterMode === 'single' && (
              <div className="space-y-2">
                <Label htmlFor="date-filter">{t('dashboard.selectDate')}</Label>
              <Input
                id="date-filter"
                type="date"
                  value={selectedDate || ''}
                  onChange={(e) => setSelectedDate(e.target.value || null)}
                  max={todayIso}
                />
              </div>
            )}
            {filterMode === 'range' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="start-date">{t('dashboard.fromDate')}</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    max={dateRange.end || todayIso}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">{t('dashboard.toDate')}</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    min={dateRange.start}
                max={todayIso}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 3 Cột thống kê: Ngày/Tháng/Năm - CHỈ HIỂN THỊ 1 LẦN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Cột 1: Hôm nay */}
        <div className="p-4 bg-card border-2 border-border rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">{t('dashboard.today')}</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.totalEmployees')}</span>
              <span className="font-semibold">{(todayStats as any)?.totalEmployees || (stats as any).totalEmployees}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.attendance')}</span>
              <span className="font-semibold text-success">
                {(todayStats as any) ? Math.round((parseFloat((todayStats as any).attendanceRate || '0') / 100) * ((todayStats as any).totalEmployees || 0)) : 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.attendanceRate')}</span>
              <span className="font-semibold">{(todayStats as any)?.attendanceRate || (stats as any).attendanceRate}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.totalHours')}</span>
              <span className="font-semibold">{(todayStats as any)?.totalHoursToday || (stats as any).totalHoursToday}h</span>
            </div>
          </div>
        </div>

        {/* Cột 2: Tháng này */}
        <div className="p-4 bg-card border-2 border-border rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-info" />
            <h3 className="font-semibold text-lg">{t('dashboard.thisMonth')}</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.totalEmployees')}</span>
              <span className="font-semibold">{(monthStats as any)?.totalEmployees || (stats as any).totalEmployees}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.attendance')}</span>
              <span className="font-semibold text-success">
                {(monthStats as any) ? Math.round((parseFloat((monthStats as any).attendanceRate || '0') / 100) * ((monthStats as any).totalEmployees || 0)) : 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.attendanceRate')}</span>
              <span className="font-semibold">{(monthStats as any)?.attendanceRate || '0'}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.totalHours')}</span>
              <span className="font-semibold">{(monthStats as any)?.totalHoursToday || '0'}h</span>
            </div>
          </div>
        </div>

        {/* Cột 3: Năm này */}
        <div className="p-4 bg-card border-2 border-border rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-warning" />
            <h3 className="font-semibold text-lg">{t('dashboard.thisYear')}</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.totalEmployees')}</span>
              <span className="font-semibold">{(yearStats as any)?.totalEmployees || (stats as any).totalEmployees}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.attendance')}</span>
              <span className="font-semibold text-success">
                {(yearStats as any) ? Math.round((parseFloat((yearStats as any).attendanceRate || '0') / 100) * ((yearStats as any).totalEmployees || 0)) : 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.attendanceRate')}</span>
              <span className="font-semibold">{(yearStats as any)?.attendanceRate || '0'}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.totalHours')}</span>
              <span className="font-semibold">{(yearStats as any)?.totalHoursToday || '0'}h</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards - Hàng 1: Thống kê chính */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          title={t('dashboard.totalEmployees')}
          value={(stats as any).totalEmployees}
          icon={Users}
          variant="primary"
        />
        <StatCard
          title={t('dashboard.officialAttendanceRate')}
          value={`${(stats as any).chinhThucRate}%`}
          icon={TrendingUp}
          variant="success"
        />
        <StatCard
          title={t('dashboard.seasonalAttendanceRate')}
          value={`${(stats as any).thoiVuRate}%`}
          icon={TrendingUp}
          variant="info"
        />
        <StatCard
          title={t('dashboard.lateEmployees')}
          value={(stats as any).lateToday}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title={t('dashboard.totalWorkingHours')}
          value={`${(stats as any).totalHoursToday}h`}
          icon={Timer}
          variant="info"
        />
      </div>

      {/* Stats Cards - Hàng 2: Phân bổ Nam/Nữ theo Chính thức/Thời vụ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title={t('dashboard.maleOfficial')}
          value={`${(genderByEmpType as any).chinhThucNam.count} (${(genderByEmpType as any).chinhThucNam.percent}%)`}
          icon={UserCheck}
          variant="primary"
        />
        <StatCard
          title={t('dashboard.femaleOfficial')}
          value={`${(genderByEmpType as any).chinhThucNu.count} (${(genderByEmpType as any).chinhThucNu.percent}%)`}
          icon={Users2}
          variant="info"
        />
        <StatCard
          title={t('dashboard.maleSeasonal')}
          value={`${(genderByEmpType as any).thoiVuNam.count} (${(genderByEmpType as any).thoiVuNam.percent}%)`}
          icon={UserCheck}
          variant="success"
        />
        <StatCard
          title={t('dashboard.femaleSeasonal')}
          value={`${(genderByEmpType as any).thoiVuNu.count} (${(genderByEmpType as any).thoiVuNu.percent}%)`}
          icon={Users2}
          variant="warning"
        />
      </div>

      {/* Charts - Grid 4 cột: Tỷ lệ phân bổ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* 1. Tỷ lệ đi làm: Chính thức - Thời vụ */}
        <div className="p-4 bg-card border-2 border-border rounded-lg">
          <h3 className="text-base font-semibold mb-3">{t('dashboard.ratioOfficialSeasonal')}</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={employmentTypeData as any[]}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value, percent }) => `${translateValue(name)}: ${value}`}
                >
                  {(employmentTypeData as any[]).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-3">
            {(employmentTypeData as any[]).map((item: any) => (
              <div key={item.name} className="text-center">
                <div className="flex items-center gap-1 justify-center mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs font-medium">{translateValue(item.name)}</span>
                </div>
                <p className="text-lg font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{t('common.people')}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Tỷ lệ Nam - Nữ */}
        <div className="p-4 bg-card border-2 border-border rounded-lg">
          <h3 className="text-base font-semibold mb-3">{t('dashboard.ratioMaleFemale')}</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderData as any[]}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value, percent }) => `${translateValue(name)}: ${value}`}
                >
                  {(genderData as any[]).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-3">
            {(genderData as any[]).map((item: any) => (
              <div key={item.name} className="text-center">
                <div className="flex items-center gap-1 justify-center mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs font-medium">{translateValue(item.name)}</span>
                </div>
                <p className="text-lg font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{t('common.people')}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Tỷ lệ theo lứa tuổi */}
        <div className="p-4 bg-card border-2 border-border rounded-lg">
          <h3 className="text-base font-semibold mb-3">{t('dashboard.ratioByAge')}</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageData as any[]} layout="vertical" barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} width={40} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number) => [`${value} ${t('common.people')}`, t('common.quantity') || 'Số lượng']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {(ageData as any[]).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-5 gap-1 mt-3">
            {(ageData as any[]).map((item: any) => (
              <div key={item.name} className="text-center p-1 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground">{item.name}</p>
                <p className="text-sm font-bold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Tỷ lệ đi làm các bộ phận */}
        <div className="p-4 bg-card border-2 border-border rounded-lg">
          <h3 className="text-base font-semibold mb-3">{t('dashboard.attendanceByDepartment')}</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceRateByDept as any[]} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="department" stroke="hsl(var(--muted-foreground))" fontSize={10} angle={-45} textAnchor="end" height={60} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <Tooltip 
                  content={renderDeptTooltip}
                />
                <Bar
                  dataKey="attendanceRate"
                  name={t('dashboard.percentage')}
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  label={{ position: 'top', formatter: (val: number) => `${val}%` }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-1 mt-3">
            {(attendanceRateByDept as any[]).map((item: any) => (
              <div key={item.department} className="text-center p-1 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground">{item.department}</p>
                <p className="text-sm font-bold">{item.attendanceRate}%</p>
                <p className="text-[10px] text-muted-foreground">{item.attendance}/{item.totalEmployees}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row - 7 ngày gần nhất */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Attendance Chart */}
        <div className="p-4 bg-card border-2 border-border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">{t('dashboard.attendanceRateLast7Days')}</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={formattedAttendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="rate" 
                  name={t('dashboard.percentage')} 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="p-4 bg-card border-2 border-border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">{t('dashboard.attendanceLast7Days') || 'Số lượng đi làm 7 ngày gần nhất'}</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={formattedAttendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="attendance" 
                  name={t('common.quantity')} 
                  stroke="hsl(var(--success))" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="p-4 bg-card border border-border rounded-lg">
        <h3 className="text-lg font-semibold mb-4">{t('dashboard.recentActivity')}</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('dashboard.employeeCode')}</th>
                <th>{t('dashboard.employeeName')}</th>
                <th>{t('dashboard.department')}</th>
                <th>{t('dashboard.date')}</th>
                <th>{t('dashboard.timeIn')}</th>
                <th>{t('dashboard.timeOut')}</th>
                <th>{t('dashboard.shift')}</th>
                <th>{t('dashboard.totalHoursLabel')}</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.length > 0 ? (
                recentActivity.map((record: any) => (
                <tr key={record.id}>
                  <td className="font-mono text-sm">{record.employee_code}</td>
                  <td className="font-medium">{record.employee_name}</td>
                  <td>{record.department}</td>
                  <td>{record.date}</td>
                  <td>{record.check_in}</td>
                  <td>{record.check_out}</td>
                  <td>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      record.shift === 'CA NGAY' 
                        ? 'bg-success/10 text-success' 
                        : record.shift === 'CA DEM' 
                        ? 'bg-warning/10 text-warning' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {translateValue(record.shift)}
                    </span>
                  </td>
                  <td>{record.total_hours}h</td>
                </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center text-muted-foreground py-8">
                    {t('dashboard.noTimekeepingData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Index;

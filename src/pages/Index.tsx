import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, TrendingUp, Clock, Timer, UserCheck, Users2, Calendar, Building2, Filter, Loader2, Shield, ClipboardList, Calculator, FileText, Briefcase, ShoppingCart } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardAccounting } from '@/components/dashboard/DashboardAccounting';
import { DashboardAdministration } from '@/components/dashboard/DashboardAdministration';
import { DashboardCongVu } from '@/components/dashboard/DashboardCongVu';
import { DashboardMuaHang } from '@/components/dashboard/DashboardMuaHang';
import { hrExcelAPI, statisticsAPI, timekeepingAPI } from '@/services/api';
import { useI18n } from '@/contexts/I18nContext';
import { formatNumberPlain } from '@/lib/utils';
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
  // Khi filter "Hôm nay" (day): không truyền date → backend dùng ngày có dữ liệu mới nhất → luôn có tỷ lệ hiển thị
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
      : filterMode === 'day'
      ? { date: undefined, start_date: undefined, end_date: undefined }
      : { date: todayIso, start_date: undefined, end_date: undefined };

  // 3 cột thống kê: "Hôm nay" dùng ngày mới nhất (không truyền date) để luôn có số liệu
  const todayParams = { date: undefined, start_date: undefined, end_date: undefined };
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

  // HR Excel stats (hiển thị KPI trên dashboard nếu đã upload)
  const { data: hrAttendanceExcelStats } = useQuery({
    queryKey: ['hrExcel', 'stats', 'attendance-rate'],
    queryFn: () => hrExcelAPI.getStats('attendance-rate'),
  });

  const { data: hrWeeklyOneDayStats } = useQuery({
    queryKey: ['hrExcel', 'stats', 'weekly-one-day-workers'],
    queryFn: () => hrExcelAPI.getStats('weekly-one-day-workers'),
  });

  const { data: hrLaborRateStats } = useQuery({
    queryKey: ['hrExcel', 'stats', 'labor-rate'],
    queryFn: () => hrExcelAPI.getStats('labor-rate'),
  });

  const { data: hrAttendanceCountStats } = useQuery({
    queryKey: ['hrExcel', 'stats', 'attendance-count'],
    queryFn: () => hrExcelAPI.getStats('attendance-count'),
  });

  const { data: hrTempTimesheetStats } = useQuery({
    queryKey: ['hrExcel', 'stats', 'temp-timesheet'],
    queryFn: () => hrExcelAPI.getStats('temp-timesheet'),
  });

  const { data: hrOfficialTimesheetStats } = useQuery({
    queryKey: ['hrExcel', 'stats', 'official-timesheet'],
    queryFn: () => hrExcelAPI.getStats('official-timesheet'),
  });

  const { data: hrInsuranceMasterStats } = useQuery({
    queryKey: ['hrExcel', 'stats', 'insurance-master'],
    queryFn: () => hrExcelAPI.getStats('insurance-master'),
  });

  const { data: hrStatusData } = useQuery({
    queryKey: ['hrExcel', 'status'],
    queryFn: () => hrExcelAPI.getStatus(),
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
  const { data: departmentsFromExcel } = useQuery({
    queryKey: ['departments-from-excel'],
    queryFn: () => statisticsAPI.getDepartmentsFromExcel(),
  });

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

  // Ưu tiên danh sách từ file Excel (02-03.02); không có thì 7 bộ phận: VPQL, MM, QC, CS, SM, EQM, PROD. Không Khác.
  const normDept = (s: string) =>
    (s || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '');
  const excelList = (departmentsFromExcel as any)?.departments;
  const DEPT_ORDER = (Array.isArray(excelList) && excelList.length > 0)
    ? excelList
    : ['VPQL', 'MM', 'QC', 'CS', 'SM', 'EQM', 'PROD'];
  const compactToGroup: Record<string, string> = {
    vpql: 'VPQL', mm: 'MM', phongmm: 'MM', m: 'MM',
    qc: 'QC', phongqc: 'QC', q: 'QC',
    cs: 'CS', phongcs: 'CS',
    sm: 'SM', phongsm: 'SM', s: 'SM',
    eqm: 'EQM', phongeqm: 'EQM', e: 'EQM',
    sanxuat: 'SAN XUAT', sanxuất: 'SAN XUAT', prod: 'PROD', p: 'PROD', p2: 'PROD', phongprod: 'PROD', sx: 'SAN XUAT', production: 'SAN XUAT',
    thoivu: 'THOI VU', kg: 'KG', test: 'TEST',
  };
  const attendanceRateByDeptSorted = useMemo(() => {
    const raw = (attendanceRateByDept as any[]) || [];
    const byGroup: Record<string, { attendance: number; totalEmployees: number }> = {};
    DEPT_ORDER.forEach((g: string) => { byGroup[g] = { attendance: 0, totalEmployees: 0 }; });
    const excelNormToDept: Record<string, string> = {};
    DEPT_ORDER.forEach((d: string) => { excelNormToDept[normDept(d)] = d; });
    raw.forEach((d: any) => {
      const n = normDept(d.department);
      const group = compactToGroup[n] || excelNormToDept[n];
      if (group && byGroup[group] != null) {
        byGroup[group].attendance += Number(d.attendance) || 0;
        byGroup[group].totalEmployees += Number(d.totalEmployees) || 0;
      }
    });
    const list = DEPT_ORDER.map((group: string) => {
      const { attendance, totalEmployees } = byGroup[group];
      const rate = totalEmployees > 0 ? Math.min(100, (attendance / totalEmployees) * 100) : 0;
      return {
        department: group,
        attendanceRate: parseFloat(rate.toFixed(1)),
        attendance,
        totalEmployees,
      };
    });
    return list;
  }, [attendanceRateByDept, departmentsFromExcel]);

  // Chỉ hiển thị bộ phận có dữ liệu (bỏ 0/0 để tránh gây hiểu nhầm)
  const attendanceRateByDeptFiltered = useMemo(() => {
    return attendanceRateByDeptSorted.filter(
      (d: any) => (Number(d.totalEmployees) || 0) > 0 || (Number(d.attendance) || 0) > 0
    );
  }, [attendanceRateByDeptSorted]);

  // Bộ phận có tỷ lệ đi làm cao nhất (chỉ trong các bộ phận có dữ liệu)
  const bestDept = attendanceRateByDeptFiltered.length > 0
    ? attendanceRateByDeptSorted.reduce((max, dept) =>
        (Number(dept.attendanceRate) || 0) > (Number(max.attendanceRate) || 0) ? dept : max,
        attendanceRateByDeptSorted[0]
      )
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

  const hrAttendanceOverall = (hrAttendanceExcelStats as any)?.stats?.overall;
  const hrAttendanceRateValue = (() => {
    if (!hrAttendanceOverall) return t('dashboard.na');
    if (hrAttendanceOverall.rate !== null && hrAttendanceOverall.rate !== undefined) {
      return `${Math.min(100, Number(hrAttendanceOverall.rate))}%`;
    }
    if (hrAttendanceOverall.total > 0 && hrAttendanceOverall.attended !== null && hrAttendanceOverall.attended !== undefined) {
      const percent = Math.round((hrAttendanceOverall.attended / hrAttendanceOverall.total) * 1000) / 10;
      return `${percent}%`;
    }
    return t('dashboard.na');
  })();

  const formatRateFromOverall = (data: any) => {
    const overall = data?.stats?.overall;
    if (!overall) return t('dashboard.na');
    if (overall.rate !== null && overall.rate !== undefined) return `${Math.min(100, Number(overall.rate))}%`;
    if (overall.total > 0 && overall.attended !== null && overall.attended !== undefined) {
      const percent = Math.min(100, Math.round((overall.attended / overall.total) * 1000) / 10);
      return `${percent}%`;
    }
    return t('dashboard.na');
  };

  const hrWeeklyOneDayRateValue = formatRateFromOverall(hrWeeklyOneDayStats as any);
  const hrLaborRateValue = formatRateFromOverall(hrLaborRateStats as any);

  const hrAttendanceCountNewEmployees = (hrAttendanceCountStats as any)?.stats?.attendanceCount?.sums?.newEmployees;
  const hrAttendanceCountValue =
    hrAttendanceCountNewEmployees !== null && hrAttendanceCountNewEmployees !== undefined
      ? formatNumberPlain(hrAttendanceCountNewEmployees)
      : t('dashboard.na');

  const formatNum = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? formatNumberPlain(n) : t('dashboard.na');
  };

  const hrTempTimesheetWorkHours = (hrTempTimesheetStats as any)?.stats?.timesheet?.sums?.workHours;
  const hrTempTimesheetHoursValue = formatNum(hrTempTimesheetWorkHours);

  const hrOfficialPaidHours = (hrOfficialTimesheetStats as any)?.stats?.timesheet?.sums?.paidHours;
  const hrOfficialWorkHours = (hrOfficialTimesheetStats as any)?.stats?.timesheet?.sums?.workHours;
  const hrOfficialTimesheetHoursValue = formatNum(
    hrOfficialPaidHours !== null && hrOfficialPaidHours !== undefined ? hrOfficialPaidHours : hrOfficialWorkHours
  );

  const hrInsuranceEmployees = (hrInsuranceMasterStats as any)?.stats?.insuranceMaster?.employeesCount;
  const hrInsuranceEmployeesValue = hrInsuranceEmployees !== null && hrInsuranceEmployees !== undefined ? formatNumberPlain(hrInsuranceEmployees) : t('dashboard.na');

  const genderByEmpType = genderByEmploymentType || {
    chinhThucNam: { count: 0, percent: '0' },
    chinhThucNu: { count: 0, percent: '0' },
    thoiVuNam: { count: 0, percent: '0' },
    thoiVuNu: { count: 0, percent: '0' },
  };

  // Format attendance data for chart (khi chưa có danh sách NV: tỷ lệ = 100% nếu có dữ liệu chấm công, 0% nếu không)
  const formattedAttendanceData = (attendanceByDate as any[]).map((item: any) => ({
    date: new Date(item.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
    rate: totalEmployees > 0 ? capPercentage(item.attendance, totalEmployees) : (item.attendance > 0 ? '100' : '0'),
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
          <div>{t('dashboard.attendance')}: {formatNumberPlain(data.attendance)}/{formatNumberPlain(data.totalEmployees)}</div>
        </div>
      );
    }
    return null;
  };

  const dateUsedFromApi = (dashboardStats as any)?.dateUsed;
  const headerDateLabel =
    filterMode === 'month'
      ? `${(() => { const d = parseYmdLocal(baseDate); return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; })()} ${t('dashboard.thisMonth').toLowerCase()}`
      : filterMode === 'year'
      ? t('dashboard.thisYear').toLowerCase()
      : filterMode === 'range' && (dashboardStats as any)?.startDateUsed && (dashboardStats as any)?.endDateUsed
      ? `${formatDateDisplay((dashboardStats as any).startDateUsed)} → ${formatDateDisplay((dashboardStats as any).endDateUsed)}`
      : filterMode === 'day' && dateUsedFromApi
      ? `${t('dashboard.oneDay')} ${formatDateDisplay(dateUsedFromApi)} (${t('dashboard.latestData') || 'dữ liệu mới nhất'})`
      : filterMode === 'single'
      ? `${t('dashboard.oneDay')} ${formatDateDisplay(selectedDate || baseDate)}`
      : baseDate === todayIso
      ? t('dashboard.today').toLowerCase()
      : `${t('dashboard.oneDay')} ${formatDateDisplay(baseDate)}`;

  return (
    <div>
      <PageHeader 
        title={t('dashboard.title')} 
        description={`${t('dashboard.welcome')} ${headerDateLabel}.`}
      />

      {/* Bộ lọc thời gian — áp dụng cho tất cả tab */}
      <div className="mb-6 p-4 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">{t('dashboard.timeFilter')}</h3>
        </div>
        <div className="space-y-4">
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

      {/* 5 hạng mục: Kế toán, Hành chính, Nhân sự, Công vụ, Mua hàng */}
      <Tabs defaultValue="hr" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-5 mb-6 h-11">
          <TabsTrigger value="accounting" className="flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Kế toán
          </TabsTrigger>
          <TabsTrigger value="administration" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Hành chính
          </TabsTrigger>
          <TabsTrigger value="hr" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Nhân sự
          </TabsTrigger>
          <TabsTrigger value="congvu" className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Công vụ
          </TabsTrigger>
          <TabsTrigger value="muahang" className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Mua hàng
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounting" className="mt-0">
          <DashboardAccounting
            filterMode={filterMode}
            selectedDate={selectedDate}
            dateRange={dateRange}
            baseDate={baseDate}
          />
        </TabsContent>

        <TabsContent value="administration" className="mt-0">
          <DashboardAdministration
            filterMode={filterMode}
            selectedDate={selectedDate}
            dateRange={dateRange}
            baseDate={baseDate}
          />
        </TabsContent>

        <TabsContent value="congvu" className="mt-0">
          <DashboardCongVu
            filterMode={filterMode}
            selectedDate={selectedDate}
            dateRange={dateRange}
            baseDate={baseDate}
          />
        </TabsContent>

        <TabsContent value="muahang" className="mt-0">
          <DashboardMuaHang
            filterMode={filterMode}
            selectedDate={selectedDate}
            dateRange={dateRange}
            baseDate={baseDate}
          />
        </TabsContent>

        <TabsContent value="hr" className="mt-0">
      {/* 3 Cột thống kê: Ngày/Tháng/Năm */}
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
              <span className="font-semibold">{formatNumberPlain((todayStats as any)?.totalEmployees ?? (stats as any).totalEmployees ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.attendance')}</span>
              <span className="font-semibold text-success">
                {formatNumberPlain((todayStats as any)?.attendance ?? ((todayStats as any) ? Math.round((parseFloat((todayStats as any).attendanceRate || '0') / 100) * ((todayStats as any).totalEmployees || 0)) : 0))}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.attendanceRate')}</span>
              <span className="font-semibold">{(todayStats as any)?.attendanceRate ?? (stats as any).attendanceRate}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.totalHours')}</span>
              <span className="font-semibold">{formatNumberPlain((todayStats as any)?.totalHoursToday ?? (stats as any).totalHoursToday ?? 0)}h</span>
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
              <span className="font-semibold">{formatNumberPlain((monthStats as any)?.totalEmployees ?? (stats as any).totalEmployees ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.attendance')}</span>
              <span className="font-semibold text-success">
                {formatNumberPlain((monthStats as any)?.attendance ?? ((monthStats as any) ? Math.round((parseFloat((monthStats as any).attendanceRate || '0') / 100) * ((monthStats as any).totalEmployees || 0)) : 0))}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.attendanceRate')}</span>
              <span className="font-semibold">{(monthStats as any)?.attendanceRate ?? '0'}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.totalHours')}</span>
              <span className="font-semibold">{formatNumberPlain((monthStats as any)?.totalHoursToday ?? 0)}h</span>
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
              <span className="font-semibold">{formatNumberPlain((yearStats as any)?.totalEmployees ?? (stats as any).totalEmployees ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.attendance')}</span>
              <span className="font-semibold text-success">
                {formatNumberPlain((yearStats as any)?.attendance ?? ((yearStats as any) ? Math.round((parseFloat((yearStats as any).attendanceRate || '0') / 100) * ((yearStats as any).totalEmployees || 0)) : 0))}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.attendanceRate')}</span>
              <span className="font-semibold">{(yearStats as any)?.attendanceRate ?? '0'}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.totalHours')}</span>
              <span className="font-semibold">{formatNumberPlain((yearStats as any)?.totalHoursToday ?? 0)}h</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards - Hàng 1: Thống kê chính */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          title={t('dashboard.totalEmployees')}
          value={formatNumberPlain((stats as any).totalEmployees ?? 0)}
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
          value={formatNumberPlain((stats as any).lateToday ?? 0)}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title={t('dashboard.totalWorkingHours')}
          value={`${formatNumberPlain((stats as any).totalHoursToday ?? 0)}h`}
          icon={Timer}
          variant="info"
        />
      </div>

      {/* Stats Cards - HR Excel (chỉ Nhân sự: chấm công, nhân lực) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          title={`HR - ${t('sidebar.hrAttendanceRate')}`}
          value={hrAttendanceRateValue}
          icon={TrendingUp}
          variant="info"
        />
        <StatCard
          title={`HR - ${t('sidebar.hrWeeklyOneDayWorkers')}`}
          value={hrWeeklyOneDayRateValue}
          icon={TrendingUp}
          variant="warning"
        />
        <StatCard
          title={`HR - ${t('sidebar.hrLaborRate')}`}
          value={hrLaborRateValue}
          icon={TrendingUp}
          variant="primary"
        />
        <StatCard
          title="HR - Người mới (Excel)"
          value={hrAttendanceCountValue}
          icon={Users}
          variant="success"
        />
        <StatCard
          title="HR - Bảo hiểm (số lao động)"
          value={hrInsuranceEmployeesValue}
          icon={Shield}
          variant="primary"
          description={
            (hrInsuranceMasterStats as any)?.error === 'FILE_NOT_FOUND'
              ? 'File đã upload nhưng không tìm thấy trên server.'
              : hrInsuranceEmployeesValue === t('dashboard.na')
                ? 'Upload file Bảo hiểm / Biểu mẫu bảo hiểm tại Nhân sự (HR)'
                : undefined
          }
        />
      </div>

      {/* Stats Cards - HR Excel (Công TV, Công CT - dữ liệu nhân sự) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 mb-6">
        <StatCard
          title="HR - Công TV (giờ)"
          value={hrTempTimesheetHoursValue}
          icon={ClipboardList}
          variant="info"
          description={
            (hrTempTimesheetStats as any)?.error === 'FILE_NOT_FOUND'
              ? 'File đã upload nhưng không tìm thấy trên server.'
              : hrTempTimesheetHoursValue === t('dashboard.na')
                ? 'Upload file Chốt công thời vụ tại Nhân sự (HR)'
                : undefined
          }
        />
        <StatCard
          title="HR - Công CT (giờ tính lương)"
          value={hrOfficialTimesheetHoursValue}
          icon={ClipboardList}
          variant="info"
        />
      </div>

      {/* Stats Cards - Hàng 2: Phân bổ Nam/Nữ theo Chính thức/Thời vụ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title={t('dashboard.maleOfficial')}
          value={`${formatNumberPlain((genderByEmpType as any).chinhThucNam.count)} (${(genderByEmpType as any).chinhThucNam.percent}%)`}
          icon={UserCheck}
          variant="primary"
        />
        <StatCard
          title={t('dashboard.femaleOfficial')}
          value={`${formatNumberPlain((genderByEmpType as any).chinhThucNu.count)} (${(genderByEmpType as any).chinhThucNu.percent}%)`}
          icon={Users2}
          variant="info"
        />
        <StatCard
          title={t('dashboard.maleSeasonal')}
          value={`${formatNumberPlain((genderByEmpType as any).thoiVuNam.count)} (${(genderByEmpType as any).thoiVuNam.percent}%)`}
          icon={UserCheck}
          variant="success"
        />
        <StatCard
          title={t('dashboard.femaleSeasonal')}
          value={`${formatNumberPlain((genderByEmpType as any).thoiVuNu.count)} (${(genderByEmpType as any).thoiVuNu.percent}%)`}
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
                  label={({ name, value }) => `${translateValue(name)}: ${formatNumberPlain(value)}`}
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
                <p className="text-lg font-bold">{formatNumberPlain(item.value)}</p>
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
                  label={({ name, value }) => `${translateValue(name)}: ${formatNumberPlain(value)}`}
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
                <p className="text-lg font-bold">{formatNumberPlain(item.value)}</p>
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
                  formatter={(value: number) => [`${formatNumberPlain(value)} ${t('common.people')}`, t('common.quantity') || 'Số lượng']}
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
                <p className="text-sm font-bold">{formatNumberPlain(item.value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Tỷ lệ đi làm các bộ phận — chỉ hiển thị bộ phận có dữ liệu chấm công */}
        <div className="p-4 bg-card border-2 border-border rounded-lg">
          <h3 className="text-base font-semibold mb-3">{t('dashboard.attendanceByDepartment')}</h3>
          <p className="text-xs text-muted-foreground mb-2">
            Tỷ lệ % = (số người đi làm / tổng nhân viên bộ phận) × 100. Chỉ hiển thị bộ phận có dữ liệu.
          </p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceRateByDeptFiltered} barGap={4}>
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
            {attendanceRateByDeptFiltered.map((item: any) => (
              <div key={item.department} className="text-center p-1 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground">{item.department}</p>
                <p className="text-sm font-bold">{item.attendanceRate}%</p>
                <p className="text-[10px] text-muted-foreground">{formatNumberPlain(item.attendance)}/{formatNumberPlain(item.totalEmployees)}</p>
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, TrendingUp, Clock, Timer, UserCheck, Users2, Calendar, Building2, Filter, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { statisticsAPI, timekeepingAPI } from '@/services/api';
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
  // Bộ lọc ngày - mặc định là null để hiển thị tất cả dữ liệu
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'day' | 'month'>('day'); // day: theo ngày; month: theo tháng của ngày đang chọn

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

  const params =
    filterMode === 'month'
      ? (() => {
          const { start, end } = getMonthRange(baseDate);
          return { date: undefined, start_date: start, end_date: end };
        })()
      : { date: baseDate, start_date: undefined, end_date: undefined };
  
  // Fetch data from API - nếu không có date thì không filter
  const { data: dashboardStats, isLoading: loadingStats } = useQuery({
    queryKey: ['dashboard', params.date, params.start_date, params.end_date],
    queryFn: () => statisticsAPI.getDashboard(params),
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

  const { data: recentTimekeeping = [] } = useQuery({
    queryKey: ['recentTimekeeping', params.date, params.start_date, params.end_date],
    queryFn: () => {
      if (filterMode === 'month') {
        return timekeepingAPI.getAll({
          start_date: params.start_date,
          end_date: params.end_date,
          archived: false,
        });
      }
      return timekeepingAPI.getAll({ 
        start_date: baseDate, 
        end_date: baseDate,
        archived: false // CHỈ lấy dữ liệu mới
      });
    },
  });

  // Helper function to cap percentage at 100%
  const capPercentage = (value: number, total: number): string => {
    if (total <= 0) return '0';
    const percent = (value / total) * 100;
    return Math.min(percent, 100).toFixed(1);
  };
  
  // Calculate additional stats
  const totalEmployees = dashboardStats?.totalEmployees || 0;
  const maleCount = genderData.find(g => g.name === 'Nam')?.value || 0;
  const femaleCount = genderData.find(g => g.name === 'Nữ')?.value || 0;
  const malePercent = capPercentage(maleCount, totalEmployees);
  const femalePercent = capPercentage(femaleCount, totalEmployees);
  
  // Find largest age group
  const largestAgeGroup = ageData.length > 0 
    ? ageData.reduce((max, group) => group.value > max.value ? group : max, ageData[0])
    : { name: 'N/A', value: 0 };
  
  // Find department with highest attendance rate; if tie, prefer higher attendance count, then totalEmployees
  const bestDept = attendanceRateByDept.length > 0
    ? attendanceRateByDept.reduce((max, dept) => {
        if (dept.attendanceRate > max.attendanceRate) return dept;
        if (dept.attendanceRate < max.attendanceRate) return max;
        // tie on rate: pick higher attendance count
        if ((dept.attendance || 0) > (max.attendance || 0)) return dept;
        if ((dept.attendance || 0) < (max.attendance || 0)) return max;
        // tie: pick higher totalEmployees
        if ((dept.totalEmployees || 0) > (max.totalEmployees || 0)) return dept;
        return max;
      }, attendanceRateByDept[0])
    : { department: 'N/A', attendanceRate: 0, attendance: 0, totalEmployees: 0 };
  
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
  const formattedAttendanceData = attendanceByDate.map(item => ({
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
          <div>Tỷ lệ: {data.attendanceRate}%</div>
          <div>Đi làm: {data.attendance}/{data.totalEmployees}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <PageHeader 
        title="Tổng quan" 
        description={`Chào mừng bạn quay trở lại! Đây là tổng quan hoạt động ${
          filterMode === 'month'
            ? `tháng ${(() => { const d = parseYmdLocal(baseDate); return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; })()}`
            : baseDate === todayIso
              ? 'hôm nay'
              : `ngày ${formatDateDisplay(baseDate)}`
        }.`}
      />

      {/* Bộ lọc ngày */}
      <div className="mb-6 p-4 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">Bộ lọc</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="space-y-2 flex-1 max-w-xs">
            <Label htmlFor="date-filter">Chọn ngày xem dữ liệu (để trống để xem tất cả)</Label>
            <div className="relative">
              <Input
                id="date-filter"
                type="date"
                // In month mode we still keep a valid date value, but hide the day visually
                value={filterMode === 'month' ? baseDate : (selectedDate || '')}
                onChange={(e) => {
                  setSelectedDate(e.target.value || null);
                  setFilterMode('day'); // chọn ngày luôn về chế độ NGÀY
                }}
                max={todayIso}
                className="text-transparent caret-transparent"
              />
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                {filterMode === 'month' ? monthPlaceholderLabel : dayDisplayLabel}
              </span>
            </div>
          </div>
          <div className="pt-6 flex gap-2">
            <button
              onClick={() => {
                const base = selectedDate || todayIso;
                setSelectedDate(base); // giữ nguyên ngày đang có, chỉ đổi logic lọc theo THÁNG
                setFilterMode('month');
              }}
              className="text-sm text-primary hover:underline"
            >
              Xem tất cả
            </button>
            <span className="text-muted-foreground">|</span>
            <button
              onClick={() => {
                const today = todayIso;
                setSelectedDate(today);
                setFilterMode('day');
              }}
              className="text-sm text-primary hover:underline"
            >
              Về hôm nay
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards - Hàng 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <StatCard
          title="Tổng số nhân viên"
          value={stats.totalEmployees}
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Tỷ lệ đi làm Chính thức"
          value={`${stats.chinhThucRate}%`}
          icon={TrendingUp}
          variant="success"
        />
        <StatCard
          title="Tỷ lệ đi làm Thời vụ"
          value={`${stats.thoiVuRate}%`}
          icon={TrendingUp}
          variant="info"
        />
        <StatCard
          title="Nhân viên đi trễ"
          value={stats.lateToday}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title="Tổng giờ làm việc"
          value={`${stats.totalHoursToday}h`}
          icon={Timer}
          variant="info"
        />
      </div>

      {/* Stats Cards - Hàng 2: Tỷ lệ Nam/Nữ theo Chính thức/Thời vụ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Nam - Chính thức"
          value={`${genderByEmpType.chinhThucNam.count} (${genderByEmpType.chinhThucNam.percent}%)`}
          icon={UserCheck}
          variant="primary"
        />
        <StatCard
          title="Nữ - Chính thức"
          value={`${genderByEmpType.chinhThucNu.count} (${genderByEmpType.chinhThucNu.percent}%)`}
          icon={Users2}
          variant="info"
        />
        <StatCard
          title="Nam - Thời vụ"
          value={`${genderByEmpType.thoiVuNam.count} (${genderByEmpType.thoiVuNam.percent}%)`}
          icon={UserCheck}
          variant="success"
        />
        <StatCard
          title="Nữ - Thời vụ"
          value={`${genderByEmpType.thoiVuNu.count} (${genderByEmpType.thoiVuNu.percent}%)`}
          icon={Users2}
          variant="warning"
        />
      </div>

      {/* Stats Cards - Hàng 3: Thông tin bổ sung */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 mb-6">
        <StatCard
          title="Nhóm tuổi lớn nhất"
          value={`${largestAgeGroup.name}: ${largestAgeGroup.value}`}
          icon={Calendar}
          variant="success"
        />
        <StatCard
          title="Bộ phận đi làm tốt nhất"
          value={`${bestDept.department}: ${bestDept.attendanceRate}%`}
          icon={Building2}
          variant="warning"
        />
      </div>

      {/* Tỷ lệ - Grid 4 cột */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* 1. Tỷ lệ đi làm: Chính thức - Thời vụ */}
        <div className="chart-container">
          <h3 className="text-base font-semibold mb-3">Tỷ lệ: Chính thức - Thời vụ</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={employmentTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value, percent }) => `${name}: ${value}`}
                >
                  {employmentTypeData.map((entry, index) => (
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
            {employmentTypeData.map(item => (
              <div key={item.name} className="text-center">
                <div className="flex items-center gap-1 justify-center mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs font-medium">{item.name}</span>
                </div>
                <p className="text-lg font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">người</p>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Tỷ lệ Nam - Nữ */}
        <div className="chart-container">
          <h3 className="text-base font-semibold mb-3">Tỷ lệ Nam - Nữ</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value, percent }) => `${name}: ${value}`}
                >
                  {genderData.map((entry, index) => (
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
            {genderData.map(item => (
              <div key={item.name} className="text-center">
                <div className="flex items-center gap-1 justify-center mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs font-medium">{item.name}</span>
                </div>
                <p className="text-lg font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">người</p>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Tỷ lệ theo lứa tuổi */}
        <div className="chart-container">
          <h3 className="text-base font-semibold mb-3">Tỷ lệ theo lứa tuổi</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageData} layout="vertical" barSize={20}>
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
                  formatter={(value: number) => [`${value} người`, 'Số lượng']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {ageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-5 gap-1 mt-3">
            {ageData.map(item => (
              <div key={item.name} className="text-center p-1 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground">{item.name}</p>
                <p className="text-sm font-bold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Tỷ lệ đi làm các bộ phận */}
        <div className="chart-container">
          <h3 className="text-base font-semibold mb-3">Tỷ lệ đi làm các bộ phận</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceRateByDept} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="department" stroke="hsl(var(--muted-foreground))" fontSize={10} angle={-45} textAnchor="end" height={60} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <Tooltip 
                  content={renderDeptTooltip}
                />
                <Bar
                  dataKey="attendanceRate"
                  name="Tỷ lệ (%)"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  label={{ position: 'top', formatter: (val: number) => `${val}%` }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-1 mt-3">
            {attendanceRateByDept.map(item => (
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
        <div className="chart-container">
          <h3 className="text-lg font-semibold mb-4">Tỷ lệ đi làm 7 ngày gần nhất</h3>
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
                  name="Tỷ lệ %" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="chart-container">
          <h3 className="text-lg font-semibold mb-4">Số lượng đi làm 7 ngày gần nhất</h3>
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
                  name="Số lượng" 
                  stroke="hsl(var(--success))" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="chart-container">
        <h3 className="text-lg font-semibold mb-4">Hoạt động chấm công gần đây</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã NV</th>
                <th>Tên nhân viên</th>
                <th>Phòng ban</th>
                <th>Ngày</th>
                <th>Giờ vào</th>
                <th>Giờ ra</th>
                <th>Ca</th>
                <th>Tổng giờ</th>
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
                      {record.shift}
                    </span>
                  </td>
                  <td>{record.total_hours}h</td>
                </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center text-muted-foreground py-8">
                    Chưa có dữ liệu chấm công
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

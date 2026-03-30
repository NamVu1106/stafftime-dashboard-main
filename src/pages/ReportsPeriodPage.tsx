import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Search, Download, Filter, Building2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  statisticsAPI,
  timekeepingAPI,
  type StatisticsDashboard,
  type StatisticsRangeSummary,
  type TimekeepingListResponse,
  timekeepingListTotal,
} from '@/services/api';
import { DataTable } from '@/components/shared/DataTable';
import {
  ReportServerPaginationBar,
  ReportTableFetchOverlay,
  timekeepingRowsWithIds,
} from '@/components/shared/ReportServerPagination';
import { useI18n } from '@/hooks/useI18n';
import { useTimeFilter } from '@/contexts/TimeFilterContext';
import { currentIsoWeekInputValue, isoWeekStringToRange } from '@/lib/isoWeekRange';

type PeriodMode = 'day' | 'week' | 'month';

function DepartmentSelect({
  id,
  value,
  onValueChange,
  t,
}: {
  id: string;
  value: string;
  onValueChange: (v: string) => void;
  t: (k: string) => string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={t('reports.allDepartments')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t('reports.allDepartments')}</SelectItem>
        <SelectItem value="hg">{t('sidebar.hg')}</SelectItem>
        <SelectItem value="prod">{t('sidebar.prod')}</SelectItem>
        <SelectItem value="qc">{t('sidebar.qc')}</SelectItem>
        <SelectItem value="cs">{t('sidebar.cs')}</SelectItem>
        <SelectItem value="eqm">{t('sidebar.eqm')}</SelectItem>
        <SelectItem value="sm">{t('sidebar.sm')}</SelectItem>
        <SelectItem value="mm">{t('sidebar.mm')}</SelectItem>
      </SelectContent>
    </Select>
  );
}

const ReportsPeriodPage = () => {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const modeParam = searchParams.get('mode') as PeriodMode | null;
  const mode: PeriodMode =
    modeParam === 'week' || modeParam === 'month' || modeParam === 'day' ? modeParam : 'day';

  const setMode = (m: string) => {
    const next = m === 'week' || m === 'month' || m === 'day' ? m : 'day';
    setSearchParams({ mode: next }, { replace: true });
  };

  return (
    <div>
      <PageHeader title={t('reports.periodPageTitle')} description={t('reports.periodPageDescription')} />

      <Tabs value={mode} onValueChange={setMode} className="space-y-6">
        <TabsList className="grid w-full max-w-xl grid-cols-3 h-auto p-1">
          <TabsTrigger value="day" className="text-xs sm:text-sm py-2">
            {t('reports.tabByDay')}
          </TabsTrigger>
          <TabsTrigger value="week" className="text-xs sm:text-sm py-2">
            {t('reports.tabByWeek')}
          </TabsTrigger>
          <TabsTrigger value="month" className="text-xs sm:text-sm py-2">
            {t('reports.tabByMonth')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="day" className="mt-0 space-y-6">
          <DayPeriodPanel t={t} />
        </TabsContent>
        <TabsContent value="week" className="mt-0 space-y-6">
          <WeekPeriodPanel t={t} />
        </TabsContent>
        <TabsContent value="month" className="mt-0 space-y-6">
          <MonthPeriodPanel t={t} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

function DayPeriodPanel({ t }: { t: (k: string, p?: Record<string, string | number>) => string }) {
  const { filterMode, selectedDate, baseDate, toLocalYmd } = useTimeFilter();
  const selectedDateEffective =
    filterMode === 'day' || filterMode === 'month' || filterMode === 'year'
      ? toLocalYmd(new Date())
      : selectedDate || baseDate || toLocalYmd(new Date());
  const [department, setDepartment] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: stats, isLoading: loadingStats } = useQuery<StatisticsDashboard>({
    queryKey: ['statistics-day', selectedDateEffective, department],
    queryFn: () => statisticsAPI.getDashboard({ date: selectedDateEffective }),
    enabled: !!selectedDateEffective,
  });

  const {
    data: timekeepingData,
    isPending: pendingTimekeeping,
    isFetching: fetchingTimekeeping,
  } = useQuery<TimekeepingListResponse>({
    queryKey: ['timekeeping-day', selectedDateEffective, department, search, page],
    queryFn: () =>
      timekeepingAPI.getAll({
        date: selectedDateEffective,
        department: department === 'all' ? undefined : department,
        search,
        page,
        limit,
        archived: false,
      }),
    enabled: !!selectedDateEffective,
    placeholderData: keepPreviousData,
  });

  const timekeepingRecords = Array.isArray(timekeepingData)
    ? timekeepingData
    : (timekeepingData?.data || []);

  const handleExport = () => {
    alert(t('reports.exportNotReady'));
  };

  const handleSearch = () => setPage(1);

  return (
    <>
      <div className="p-4 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">{t('common.filter')}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{t('reports.periodDayFilterHint')}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="period-day-dept">{t('reports.department')}</Label>
            <DepartmentSelect
              id="period-day-dept"
              value={department}
              onValueChange={setDepartment}
              t={t}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="period-day-search">{t('reports.search')}</Label>
            <div className="flex gap-2">
              <Input
                id="period-day-search"
                placeholder={t('reports.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} size="icon" type="button">
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleSearch} disabled={!selectedDateEffective} type="button">
            {t('reports.viewReport')}
          </Button>
          <Button onClick={handleExport} variant="outline" disabled={!selectedDateEffective} type="button">
            <Download className="w-4 h-4 mr-2" />
            {t('reports.exportExcel')}
          </Button>
        </div>
      </div>

      {stats && !loadingStats && (
        <div className="p-4 bg-card border border-border rounded-lg">
          <h3 className="font-semibold text-lg mb-4">
            {t('reports.statisticsForDay')} {selectedDateEffective}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">{t('reports.totalEmployees')}</span>
              </div>
              <div className="text-2xl font-bold">{stats.totalEmployees || 0}</div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-info" />
                <span className="text-sm text-muted-foreground">{t('reports.attendance')}</span>
              </div>
              <div className="text-2xl font-bold">{stats.attendanceToday || 0}</div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-success" />
                <span className="text-sm text-muted-foreground">{t('reports.totalHours')}</span>
              </div>
              <div className="text-2xl font-bold">{stats.totalHoursToday || 0}h</div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-warning" />
                <span className="text-sm text-muted-foreground">{t('reports.attendanceRate')}</span>
              </div>
              <div className="text-2xl font-bold">{stats.attendanceRate || 0}%</div>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 bg-card border border-border rounded-lg">
        <h3 className="font-semibold text-lg mb-4">{t('reports.detailedData')}</h3>
        {pendingTimekeeping ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : timekeepingRecords?.length > 0 ? (
          <>
            <ReportTableFetchOverlay show={fetchingTimekeeping && !pendingTimekeeping}>
              <DataTable
                clientPagination={false}
                showToolbar={false}
                data={timekeepingRowsWithIds(timekeepingRecords as Record<string, unknown>[], 'day')}
                columns={[
                  { key: 'employee_code', header: t('dashboard.employeeCode') },
                  { key: 'employee_name', header: t('realtime.name') },
                  { key: 'department', header: t('dashboard.department') },
                  { key: 'check_in', header: t('dashboard.timeIn') },
                  { key: 'check_out', header: t('dashboard.timeOut') },
                  { key: 'total_hours', header: t('dashboard.totalHoursLabel') },
                  { key: 'overtime_hours', header: t('reports.overtime') },
                  { key: 'late_minutes', header: t('reports.lateMinutes') },
                ]}
              />
            </ReportTableFetchOverlay>
            <ReportServerPaginationBar
              page={page}
              limit={limit}
              total={timekeepingListTotal(timekeepingData)}
              onPageChange={setPage}
              t={t}
              isBusy={fetchingTimekeeping && !pendingTimekeeping}
            />
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {selectedDateEffective ? t('reports.noDataForDay') : t('reports.pleaseSelectDay')}
          </div>
        )}
      </div>
    </>
  );
}

function WeekPeriodPanel({ t }: { t: (k: string, p?: Record<string, string | number>) => string }) {
  const [selectedWeek, setSelectedWeek] = useState(currentIsoWeekInputValue);
  const [department, setDepartment] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const weekRange = isoWeekStringToRange(selectedWeek);
  const rangeLabel =
    weekRange && `${weekRange.start} → ${weekRange.end}`;

  const { data: stats, isLoading: loadingStats } = useQuery<StatisticsRangeSummary>({
    queryKey: ['statistics-week', weekRange?.start, weekRange?.end, department],
    queryFn: () =>
      statisticsAPI.getRange({
        start_date: weekRange!.start,
        end_date: weekRange!.end,
        department: department === 'all' ? undefined : department,
      }),
    enabled: !!weekRange,
  });

  const {
    data: timekeepingData,
    isPending: pendingTimekeeping,
    isFetching: fetchingTimekeeping,
  } = useQuery<TimekeepingListResponse>({
    queryKey: ['timekeeping-week', weekRange?.start, weekRange?.end, department, search, page],
    queryFn: () =>
      timekeepingAPI.getAll({
        start_date: weekRange!.start,
        end_date: weekRange!.end,
        department: department === 'all' ? undefined : department,
        search,
        page,
        limit,
        archived: false,
      }),
    enabled: !!weekRange,
    placeholderData: keepPreviousData,
  });

  const timekeepingRecords = Array.isArray(timekeepingData)
    ? timekeepingData
    : (timekeepingData?.data || []);

  const handleExport = () => alert(t('reports.exportNotReady'));
  const handleSearch = () => setPage(1);

  return (
    <>
      <div className="p-4 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">{t('common.filter')}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="period-week">{t('reports.selectWeek')}</Label>
            <Input
              id="period-week"
              type="week"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="period-week-dept">{t('reports.department')}</Label>
            <DepartmentSelect
              id="period-week-dept"
              value={department}
              onValueChange={setDepartment}
              t={t}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="period-week-search">{t('reports.search')}</Label>
            <div className="flex gap-2">
              <Input
                id="period-week-search"
                placeholder={t('reports.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} size="icon" type="button">
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleSearch} disabled={!weekRange} type="button">
            {t('reports.viewReport')}
          </Button>
          <Button onClick={handleExport} variant="outline" disabled={!weekRange} type="button">
            <Download className="w-4 h-4 mr-2" />
            {t('reports.exportExcel')}
          </Button>
        </div>
      </div>

      {stats && weekRange && !loadingStats && (
        <div className="p-4 bg-card border border-border rounded-lg">
          <h3 className="font-semibold text-lg mb-4">
            {t('reports.statisticsForWeek')} {rangeLabel}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">{t('reports.totalEmployees')}</span>
              </div>
              <div className="text-2xl font-bold">{stats.totalEmployees || 0}</div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-info" />
                <span className="text-sm text-muted-foreground">{t('reports.totalWorkDays')}</span>
              </div>
              <div className="text-2xl font-bold">{stats.totalDays || 0}</div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-success" />
                <span className="text-sm text-muted-foreground">{t('reports.totalHours')}</span>
              </div>
              <div className="text-2xl font-bold">{stats.totalHours || 0}h</div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-warning" />
                <span className="text-sm text-muted-foreground">{t('reports.totalOvertime')}</span>
              </div>
              <div className="text-2xl font-bold">{stats.totalOvertime || 0}h</div>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 bg-card border border-border rounded-lg">
        <h3 className="font-semibold text-lg mb-4">{t('reports.detailedData')}</h3>
        {pendingTimekeeping ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : timekeepingRecords?.length > 0 ? (
          <>
            <ReportTableFetchOverlay show={fetchingTimekeeping && !pendingTimekeeping}>
              <DataTable
                clientPagination={false}
                showToolbar={false}
                data={timekeepingRowsWithIds(timekeepingRecords as Record<string, unknown>[], 'week')}
                columns={[
                  { key: 'employee_code', header: t('dashboard.employeeCode') },
                  { key: 'employee_name', header: t('realtime.name') },
                  { key: 'department', header: t('dashboard.department') },
                  { key: 'date', header: t('dashboard.date') },
                  { key: 'check_in', header: t('dashboard.timeIn') },
                  { key: 'check_out', header: t('dashboard.timeOut') },
                  { key: 'total_hours', header: t('dashboard.totalHoursLabel') },
                  { key: 'overtime_hours', header: t('reports.overtime') },
                ]}
              />
            </ReportTableFetchOverlay>
            <ReportServerPaginationBar
              page={page}
              limit={limit}
              total={timekeepingListTotal(timekeepingData)}
              onPageChange={setPage}
              t={t}
              isBusy={fetchingTimekeeping && !pendingTimekeeping}
            />
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {weekRange ? t('reports.noDataForWeek') : t('reports.pleaseSelectWeek')}
          </div>
        )}
      </div>
    </>
  );
}

function MonthPeriodPanel({ t }: { t: (k: string, p?: Record<string, string | number>) => string }) {
  const getCurrentMonth = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [department, setDepartment] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const getMonthRange = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    return { start: formatDate(start), end: formatDate(end) };
  };

  const monthRange = getMonthRange(selectedMonth);
  const monthDisplay = selectedMonth
    ? `${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0]}`
    : '';

  const { data: stats, isLoading: loadingStats } = useQuery<StatisticsRangeSummary>({
    queryKey: ['statistics-month', monthRange.start, monthRange.end, department],
    queryFn: () =>
      statisticsAPI.getRange({
        start_date: monthRange.start,
        end_date: monthRange.end,
        department: department === 'all' ? undefined : department,
      }),
    enabled: !!selectedMonth,
  });

  const {
    data: timekeepingData,
    isPending: pendingTimekeeping,
    isFetching: fetchingTimekeeping,
  } = useQuery<TimekeepingListResponse>({
    queryKey: ['timekeeping-month', monthRange.start, monthRange.end, department, search, page],
    queryFn: () =>
      timekeepingAPI.getAll({
        start_date: monthRange.start,
        end_date: monthRange.end,
        department: department === 'all' ? undefined : department,
        search,
        page,
        limit,
        archived: false,
      }),
    enabled: !!selectedMonth,
    placeholderData: keepPreviousData,
  });

  const timekeepingRecords = Array.isArray(timekeepingData)
    ? timekeepingData
    : (timekeepingData?.data || []);

  const handleExport = () => alert(t('reports.exportNotReady'));
  const handleSearch = () => setPage(1);

  return (
    <>
      <div className="p-4 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">{t('common.filter')}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="period-month">{t('reports.selectMonth')}</Label>
            <Input
              id="period-month"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="period-month-dept">{t('reports.department')}</Label>
            <DepartmentSelect
              id="period-month-dept"
              value={department}
              onValueChange={setDepartment}
              t={t}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="period-month-search">{t('reports.search')}</Label>
            <div className="flex gap-2">
              <Input
                id="period-month-search"
                placeholder={t('reports.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} size="icon" type="button">
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleSearch} disabled={!selectedMonth} type="button">
            {t('reports.viewReport')}
          </Button>
          <Button onClick={handleExport} variant="outline" disabled={!selectedMonth} type="button">
            <Download className="w-4 h-4 mr-2" />
            {t('reports.exportExcel')}
          </Button>
        </div>
      </div>

      {stats && !loadingStats && (
        <div className="p-4 bg-card border border-border rounded-lg">
          <h3 className="font-semibold text-lg mb-4">
            {t('reports.statisticsForMonth')} {monthDisplay}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">{t('reports.totalEmployees')}</span>
              </div>
              <div className="text-2xl font-bold">{stats.totalEmployees || 0}</div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-info" />
                <span className="text-sm text-muted-foreground">{t('reports.totalWorkDays')}</span>
              </div>
              <div className="text-2xl font-bold">{stats.totalDays || 0}</div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-success" />
                <span className="text-sm text-muted-foreground">{t('reports.totalHours')}</span>
              </div>
              <div className="text-2xl font-bold">{stats.totalHours || 0}h</div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-warning" />
                <span className="text-sm text-muted-foreground">{t('reports.totalOvertime')}</span>
              </div>
              <div className="text-2xl font-bold">{stats.totalOvertime || 0}h</div>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 bg-card border border-border rounded-lg">
        <h3 className="font-semibold text-lg mb-4">{t('reports.detailedData')}</h3>
        {pendingTimekeeping ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : timekeepingRecords?.length > 0 ? (
          <>
            <ReportTableFetchOverlay show={fetchingTimekeeping && !pendingTimekeeping}>
              <DataTable
                clientPagination={false}
                showToolbar={false}
                data={timekeepingRowsWithIds(timekeepingRecords as Record<string, unknown>[], 'month')}
                columns={[
                  { key: 'employee_code', header: t('dashboard.employeeCode') },
                  { key: 'employee_name', header: t('realtime.name') },
                  { key: 'department', header: t('dashboard.department') },
                  { key: 'date', header: t('dashboard.date') },
                  { key: 'check_in', header: t('dashboard.timeIn') },
                  { key: 'check_out', header: t('dashboard.timeOut') },
                  { key: 'total_hours', header: t('dashboard.totalHoursLabel') },
                  { key: 'overtime_hours', header: t('reports.overtime') },
                ]}
              />
            </ReportTableFetchOverlay>
            <ReportServerPaginationBar
              page={page}
              limit={limit}
              total={timekeepingListTotal(timekeepingData)}
              onPageChange={setPage}
              t={t}
              isBusy={fetchingTimekeeping && !pendingTimekeeping}
            />
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {selectedMonth ? t('reports.noDataForMonth') : t('reports.pleaseSelectMonth')}
          </div>
        )}
      </div>
    </>
  );
}

export default ReportsPeriodPage;

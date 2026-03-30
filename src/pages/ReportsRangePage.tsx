import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Calendar, Search, Download, Filter, Building2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  statisticsAPI,
  timekeepingAPI,
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

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthRangeFromYm(ym: string): { start: string; end: string } {
  const [y, mo] = ym.split('-').map(Number);
  const start = new Date(y, mo - 1, 1);
  const end = new Date(y, mo, 0);
  return { start: formatYmd(start), end: formatYmd(end) };
}

/** Hiển thị giá trị ô tháng khi khoảng đúng bằng cả tháng lịch */
function fullMonthValue(start: string, end: string): string {
  if (!start || !end || start.slice(0, 7) !== end.slice(0, 7)) return '';
  const [y, m] = start.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastD = new Date(y, m, 0).getDate();
  const last = `${y}-${String(m).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
  return start === first && end === last ? start.slice(0, 7) : '';
}

const ReportsRangePage = () => {
  const { t } = useI18n();
  // Tự động set date range mặc định: từ đầu tháng trước đến cuối tháng hiện tại (bao gồm cả tháng trước)
  const getDefaultDateRange = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-based
    
    // Bắt đầu từ đầu tháng trước
    const start = new Date(year, month - 1, 1);
    // Kết thúc ở cuối tháng hiện tại
    const end = new Date(year, month + 1, 0);
    
    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    
    return {
      start: formatDate(start),
      end: formatDate(end),
    };
  };

  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [department, setDepartment] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Fetch statistics
  const { data: stats, isLoading: loadingStats } = useQuery<StatisticsRangeSummary>({
    queryKey: ['statistics-range', startDate, endDate, department],
    queryFn: () => statisticsAPI.getRange({
      start_date: startDate,
      end_date: endDate,
      department: department === 'all' ? undefined : department,
    }),
    enabled: !!startDate && !!endDate,
  });

  // Fetch timekeeping data - tự động load khi có date range
  const {
    data: timekeepingData,
    isPending: pendingTimekeeping,
    isFetching: fetchingTimekeeping,
  } = useQuery<TimekeepingListResponse>({
    queryKey: ['timekeeping-range', startDate, endDate, department, search, page],
    queryFn: () => timekeepingAPI.getAll({
      start_date: startDate,
      end_date: endDate,
      department: department === 'all' ? undefined : department,
      search,
      page,
      limit,
      archived: false, // CHỈ lấy dữ liệu mới (hiển thị ở Báo cáo)
    }),
    enabled: !!startDate && !!endDate,
    placeholderData: keepPreviousData,
  });

  const timekeepingRecords = Array.isArray(timekeepingData)
    ? timekeepingData
    : (timekeepingData?.data || []);

  const handleExport = () => {
    // TODO: Implement export to Excel
    alert('Tính năng export Excel sẽ được triển khai sau');
  };

  const handleSearch = () => {
    setPage(1);
    // Query will refetch automatically
  };

  return (
    <div>
      <PageHeader 
        title={t('reports.byPeriodTitle')}
        description={t('reports.byPeriodDescription')}
      />

      {/* Bộ lọc */}
      <div className="mb-6 p-4 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">{t('reports.filter')}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">{t('reports.fromDate')}</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              max={endDate || undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-date">{t('reports.toDate')}</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              min={startDate}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="range-month">{t('reports.quickPickMonth')}</Label>
            <Input
              id="range-month"
              type="month"
              value={fullMonthValue(startDate, endDate)}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                const { start, end } = monthRangeFromYm(v);
                setStartDate(start);
                setEndDate(end);
                setPage(1);
              }}
            />
            <p className="text-xs text-muted-foreground">{t('reports.quickPickMonthHint')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="range-single-day">{t('reports.quickPickDay')}</Label>
            <Input
              id="range-single-day"
              type="date"
              value={startDate === endDate ? startDate : ''}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setStartDate(v);
                setEndDate(v);
                setPage(1);
              }}
            />
            <p className="text-xs text-muted-foreground">{t('reports.quickPickDayHint')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="department">{t('reports.department')}</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger id="department">
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="search">{t('common.search')}</Label>
            <div className="flex gap-2">
              <Input
                id="search"
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
        <div className="flex gap-2">
          <Button onClick={handleSearch} disabled={!startDate || !endDate}>
            {t('reports.viewReport')}
          </Button>
          <Button onClick={handleExport} variant="outline" disabled={!startDate || !endDate}>
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Thống kê tổng hợp */}
      {stats && (
        <div className="mb-6 p-4 bg-card border border-border rounded-lg">
          <h3 className="font-semibold text-lg mb-4">{t('reports.statisticsSummary')}</h3>
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

      {/* Bảng dữ liệu chi tiết */}
      <div className="p-4 bg-card border border-border rounded-lg">
        <h3 className="font-semibold text-lg mb-4">{t('reports.detailedData')}</h3>
        {pendingTimekeeping ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : timekeepingRecords.length > 0 ? (
          <>
            <ReportTableFetchOverlay show={fetchingTimekeeping && !pendingTimekeeping}>
              <DataTable
                data={timekeepingRowsWithIds(timekeepingRecords as Record<string, unknown>[], 'range')}
                clientPagination={false}
                showToolbar={false}
                columns={[
                  { key: 'employee_code', header: t('dashboard.employeeCode') },
                  { key: 'employee_name', header: t('realtime.name') },
                  { key: 'department', header: t('dashboard.department') },
                  { key: 'date', header: t('dashboard.date') },
                  { key: 'check_in', header: t('dashboard.timeIn') },
                  { key: 'check_out', header: t('dashboard.timeOut') },
                  { key: 'total_hours', header: t('dashboard.totalHoursLabel') },
                  { key: 'overtime', header: t('reports.overtime') },
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
            {startDate && endDate ? t('common.noData') : t('reports.pleaseSelectPeriod')}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsRangePage;



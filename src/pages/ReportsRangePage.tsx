import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Search, Download, Filter, Building2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { statisticsAPI, timekeepingAPI } from '@/services/api';
import { DataTable } from '@/components/shared/DataTable';
import { useI18n } from '@/contexts/I18nContext';

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
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['statistics-range', startDate, endDate, department],
    queryFn: () => statisticsAPI.getRange({
      start_date: startDate,
      end_date: endDate,
      department: department === 'all' ? undefined : department,
    }),
    enabled: !!startDate && !!endDate,
  });

  // Fetch timekeeping data - tự động load khi có date range
  const { data: timekeepingData, isLoading: loadingData } = useQuery({
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
  });

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">{t('reports.fromDate')}</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={endDate || undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-date">{t('reports.toDate')}</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
            />
          </div>
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
              <Button onClick={handleSearch} size="icon">
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
        {loadingData ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : timekeepingData && timekeepingData.data && timekeepingData.data.length > 0 ? (
          <>
            <DataTable
              data={timekeepingData.data}
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
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                {t('common.page')} {page} / {Math.ceil((timekeepingData.total || 0) / limit)}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  {t('reports.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil((timekeepingData.total || 0) / limit)}
                >
                  {t('reports.next')}
                </Button>
              </div>
            </div>
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



import { useState } from 'react';
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

const ReportsDayPage = () => {
  const { t } = useI18n();
  // Mặc định là ngày hôm nay
  const getToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [selectedDate, setSelectedDate] = useState(getToday());
  const [department, setDepartment] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Fetch statistics cho ngày được chọn
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['statistics-day', selectedDate, department],
    queryFn: () => statisticsAPI.getDashboard({
      date: selectedDate,
    }),
    enabled: !!selectedDate,
  });

  // Fetch timekeeping data cho ngày được chọn
  const { data: timekeepingData, isLoading: loadingData } = useQuery({
    queryKey: ['timekeeping-day', selectedDate, department, search, page],
    queryFn: () => timekeepingAPI.getAll({
      date: selectedDate,
      department: department === 'all' ? undefined : department,
      search,
      page,
      limit,
      archived: false,
    }),
    enabled: !!selectedDate,
  });

  const handleExport = () => {
    // TODO: Implement export to Excel
    alert('Tính năng export Excel sẽ được triển khai sau');
  };

  const handleSearch = () => {
    setPage(1);
  };

  // Extract data from API response
  const timekeepingRecords = Array.isArray(timekeepingData) 
    ? timekeepingData 
    : (timekeepingData?.data || []);

  return (
    <div>
      <PageHeader 
        title={t('reports.byDayTitle')} 
        description={t('reports.byDayDescription')}
      />

      {/* Bộ lọc */}
      <div className="mb-6 p-4 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">{t('common.filter')}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="date">{t('reports.selectDate')}</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
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
            <Label htmlFor="search">{t('reports.search')}</Label>
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
          <Button onClick={handleSearch} disabled={!selectedDate}>
            {t('reports.viewReport')}
          </Button>
          <Button onClick={handleExport} variant="outline" disabled={!selectedDate}>
            <Download className="w-4 h-4 mr-2" />
            {t('reports.exportExcel')}
          </Button>
        </div>
      </div>

      {/* Thống kê tổng hợp */}
      {stats && (
        <div className="mb-6 p-4 bg-card border border-border rounded-lg">
          <h3 className="font-semibold text-lg mb-4">{t('reports.statisticsForDay')} {selectedDate}</h3>
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

      {/* Bảng dữ liệu chi tiết */}
      <div className="p-4 bg-card border border-border rounded-lg">
        <h3 className="font-semibold text-lg mb-4">{t('reports.detailedData') || 'Bảng dữ liệu chi tiết'}</h3>
        {loadingData ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : timekeepingRecords && timekeepingRecords.length > 0 ? (
          <>
            <DataTable
              data={timekeepingRecords}
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
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                {t('common.page')} {page} / {Math.ceil((timekeepingData?.total || 0) / limit)}
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
                  disabled={page >= Math.ceil((timekeepingData?.total || 0) / limit)}
                >
                  {t('reports.next')}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {selectedDate ? t('reports.noDataForDay') : t('reports.pleaseSelectDay')}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsDayPage;



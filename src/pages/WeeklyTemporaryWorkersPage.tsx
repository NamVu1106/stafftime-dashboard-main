import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Users, TrendingUp, Building2, Loader2, Download, FileSpreadsheet } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/shared/DataTable';
import { statisticsAPI } from '@/services/api';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

const WeeklyTemporaryWorkersPage = () => {
  const { t } = useI18n();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Tính toán tuần hiện tại nếu chưa có date
  const getCurrentWeek = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0],
    };
  };

  const currentWeek = getCurrentWeek();
  const weekStart = startDate || currentWeek.start;
  const weekEnd = endDate || currentWeek.end;
  const hasExplicitRange = !!startDate && !!endDate;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['weekly-temporary-workers', weekStart, weekEnd, hasExplicitRange],
    queryFn: () => statisticsAPI.getWeeklyTemporaryWorkers(
      hasExplicitRange ? { start_date: weekStart, end_date: weekEnd } : undefined
    ),
    enabled: true,
  });

  // Đồng bộ ô chọn tuần với tuần API trả về (khi mở trang lần đầu — tuần có dữ liệu)
  useEffect(() => {
    if (!data?.week_start || !data?.week_end || hasExplicitRange) return;
    setStartDate(data.week_start);
    setEndDate(data.week_end);
  }, [data?.week_start, data?.week_end, hasExplicitRange]);

  const handleExportExcel = () => {
    if (!data || !data.workers || data.workers.length === 0) {
      toast({
        title: t('common.error') || 'Lỗi',
        description: 'Không có dữ liệu để xuất',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Tạo workbook mới
      const workbook = XLSX.utils.book_new();

      // Sheet 1: Danh sách công nhân
      const workersData = [
        ['STT', 'Mã nhân viên', 'Tên nhân viên', 'Phòng ban', 'Loại hình', 'Ngày làm việc', 'Giờ vào', 'Giờ ra'],
        ...data.workers.map((worker: any, index: number) => [
          index + 1,
          worker.employee_code,
          worker.name,
          worker.department,
          worker.employment_type || '—',
          worker.work_date,
          worker.check_in || '',
          worker.check_out || '',
        ]),
      ];
      const workersSheet = XLSX.utils.aoa_to_sheet(workersData);
      XLSX.utils.book_append_sheet(workbook, workersSheet, 'Danh sách công nhân');

      // Sheet 2: Tổng hợp theo ngày
      const byDateData = [
        ['Ngày', 'Số lượng công nhân'],
        ...Object.entries(data.summary.by_date).map(([date, count]) => [date, count]),
      ];
      const byDateSheet = XLSX.utils.aoa_to_sheet(byDateData);
      XLSX.utils.book_append_sheet(workbook, byDateSheet, 'Tổng hợp theo ngày');

      // Sheet 3: Tổng hợp theo phòng ban
      const byDeptData = [
        ['Phòng ban', 'Số lượng công nhân'],
        ...Object.entries(data.summary.by_department).map(([dept, count]) => [dept, count]),
      ];
      const byDeptSheet = XLSX.utils.aoa_to_sheet(byDeptData);
      XLSX.utils.book_append_sheet(workbook, byDeptSheet, 'Tổng hợp theo phòng ban');

      // Xuất file
      const fileName = `Cong_nhan_thoi_vu_1_ngay_${weekStart}_${weekEnd}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        title: t('common.success') || 'Thành công',
        description: 'Đã xuất file Excel thành công',
      });
    } catch (error: any) {
      toast({
        title: t('common.error') || 'Lỗi',
        description: error.message || 'Có lỗi xảy ra khi xuất file',
        variant: 'destructive',
      });
    }
  };

  const columns = [
    { key: 'employee_code', header: 'Mã nhân viên' },
    { key: 'name', header: 'Tên nhân viên' },
    { key: 'department', header: 'Phòng ban' },
    {
      key: 'work_date',
      header: 'Ngày làm việc',
      render: (item: any) => {
        const date = new Date(item.work_date);
        return date.toLocaleDateString('vi-VN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      },
    },
    { key: 'check_in', header: 'Giờ vào' },
    { key: 'check_out', header: 'Giờ ra' },
  ];

  return (
    <div>
      <PageHeader
        title="Công nhân thời vụ đi làm 1 ngày"
        description="Thống kê công nhân thời vụ đi làm đúng 1 ngày trong tuần"
        breadcrumbs={[
          { label: t('sidebar.home') || 'Trang chủ', href: '/' },
          { label: 'Công nhân thời vụ đi làm 1 ngày' },
        ]}
      />

      <div className="space-y-6">
        {/* Filter Section */}
        <Card className="animate-fade-in-up">
          <CardHeader>
            <CardTitle>Chọn tuần</CardTitle>
            <CardDescription>Chọn khoảng thời gian để xem thống kê</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="start-date">Từ ngày</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate || currentWeek.start}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="end-date">Đến ngày</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate || currentWeek.end}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={() => refetch()} className="w-full">
                  <Calendar className="w-4 h-4 mr-2" />
                  Xem thống kê
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card className="animate-fade-in-up">
            <CardContent className="pt-6">
              <div className="text-center text-destructive">
                Có lỗi xảy ra khi tải dữ liệu
              </div>
            </CardContent>
          </Card>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="stat-card animate-fade-in-up">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Tổng công nhân thời vụ
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.total_temporary_workers}</div>
                  <p className="text-xs text-muted-foreground">
                    Tổng số công nhân thời vụ trong hệ thống
                  </p>
                </CardContent>
              </Card>

              <Card className="stat-card animate-fade-in-up animate-delay-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Đi làm 1 ngày
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.workers_with_one_day}</div>
                  <p className="text-xs text-muted-foreground">
                    Công nhân đi làm đúng 1 ngày trong tuần
                  </p>
                </CardContent>
              </Card>

              <Card className="stat-card animate-fade-in-up animate-delay-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Tỷ lệ
                  </CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {data.total_temporary_workers > 0
                      ? ((data.workers_with_one_day / data.total_temporary_workers) * 100).toFixed(1)
                      : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tỷ lệ công nhân đi làm 1 ngày
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Export Button */}
            {data.workers && data.workers.length > 0 && (
              <div className="flex justify-end">
                <Button onClick={handleExportExcel} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Xuất Excel
                </Button>
              </div>
            )}

            {/* Data Table */}
            <Card className="chart-container animate-fade-in-up">
              <CardHeader>
                <CardTitle>Danh sách công nhân thời vụ đi làm 1 ngày</CardTitle>
                <CardDescription>
                  Tuần từ {new Date(weekStart).toLocaleDateString('vi-VN')} đến{' '}
                  {new Date(weekEnd).toLocaleDateString('vi-VN')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.workers && data.workers.length > 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-3">
                      Chỉ hiển thị công nhân <strong>thời vụ</strong> đi làm đúng 1 ngày trong tuần (không bao gồm nhân viên VPQL hay bộ phận khác).
                    </p>
                    <DataTable
                      columns={columns}
                      data={data.workers.map((w: any, i: number) => ({ ...w, id: (w as any).id ?? `${w.employee_code}-${w.work_date}-${i}` }))}
                      searchKey="name"
                      searchPlaceholder="Tìm kiếm theo tên hoặc mã nhân viên..."
                    />
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground space-y-2">
                    <p>Không có nhân viên nào đi làm đúng 1 ngày trong tuần này.</p>
                    {(data as any)?.debug && (
                      <p className="text-xs">
                        Trong tuần: {(data as any).debug.total_records_in_week} bản ghi chấm công, {(data as any).debug.unique_workers_in_week} mã nhân viên.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary by Date */}
            {data.summary && Object.keys(data.summary.by_date).length > 0 && (
              <Card className="chart-container animate-fade-in-up">
                <CardHeader>
                  <CardTitle>Tổng hợp theo ngày</CardTitle>
                  <CardDescription>Số lượng công nhân thời vụ đi làm 1 ngày theo từng ngày</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="data-table w-full">
                      <thead>
                        <tr>
                          <th>Ngày</th>
                          <th>Số lượng công nhân</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(data.summary.by_date)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([date, count]) => (
                            <tr key={date}>
                              <td>
                                {new Date(date).toLocaleDateString('vi-VN', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })}
                              </td>
                              <td className="text-center font-semibold">{count as number}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Summary by Department */}
            {data.summary && Object.keys(data.summary.by_department).length > 0 && (
              <Card className="chart-container animate-fade-in-up">
                <CardHeader>
                  <CardTitle>Tổng hợp theo phòng ban</CardTitle>
                  <CardDescription>Số lượng công nhân thời vụ đi làm 1 ngày theo phòng ban</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="data-table w-full">
                      <thead>
                        <tr>
                          <th>Phòng ban</th>
                          <th>Số lượng công nhân</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(data.summary.by_department)
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .map(([dept, count]) => (
                            <tr key={dept}>
                              <td>{dept}</td>
                              <td className="text-center font-semibold">{count as number}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default WeeklyTemporaryWorkersPage;



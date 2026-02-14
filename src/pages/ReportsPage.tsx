import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Filter, Loader2 } from 'lucide-react';
import { useTimeFilter } from '@/contexts/TimeFilterContext';
import * as XLSX from 'xlsx';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { timekeepingAPI } from '@/services/api';
import { TimekeepingRecord } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';

const ReportsPage = () => {
  const { toast } = useToast();
  const { params } = useTimeFilter();
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  const startDate = params.start_date || params.date || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = params.end_date || params.date || new Date().toISOString().split('T')[0];

  // Fetch timekeeping data from API - CHỈ lấy dữ liệu mới nhất (is_archived = 0) — dùng bộ lọc chung từ Sidebar
  const { data: timekeepingResponse, isLoading, error } = useQuery({
    queryKey: ['timekeeping', startDate, endDate, selectedDepartment],
    queryFn: () => timekeepingAPI.getAll({
      start_date: startDate,
      end_date: endDate,
      department: selectedDepartment !== 'all' ? selectedDepartment : undefined,
      archived: false, // CHỈ lấy dữ liệu mới (hiển thị ở Báo cáo)
    }),
  });
  
  // Extract data array from API response
  const timekeepingData = Array.isArray(timekeepingResponse) 
    ? timekeepingResponse 
    : (timekeepingResponse?.data || []);
  
  // Debug: Log data
  if (timekeepingData.length > 0) {
    console.log('Timekeeping data loaded:', timekeepingData.length, 'records');
  } else if (!isLoading) {
    console.log('No timekeeping data found for date range:', startDate, endDate);
  }

  // Get unique departments from data
  const departments = useMemo(() => {
    const depts = new Set<string>();
    timekeepingData.forEach((record: TimekeepingRecord) => {
      if (record.department) depts.add(record.department);
    });
    return Array.from(depts);
  }, [timekeepingData]);

  // Use data directly (no client-side filtering)
  const filteredData = timekeepingData;

  // Calculate summary stats - tính từ timekeepingData (đã filter theo date range và department)
  // KHÔNG bị ảnh hưởng bởi search query để thống kê chính xác
  const summaryStats = useMemo(() => {
    // Tính từ timekeepingData (dữ liệu từ API sau khi filter theo date range và department)
    // Không dùng filteredData vì filteredData bị ảnh hưởng bởi search query
    const uniqueEmployees = new Set(timekeepingData.map(r => r.employee_code)).size;
    const totalDays = new Set(timekeepingData.map(r => r.date)).size;
    const totalHours = timekeepingData.reduce((sum, r) => sum + (r.total_hours || 0), 0);
    const totalOvertime = timekeepingData.reduce((sum, r) => sum + (r.overtime_hours || 0), 0);
    
    return {
      uniqueEmployees,
      totalDays,
      totalHours: totalHours.toFixed(1),
      totalOvertime: totalOvertime.toFixed(1),
    };
  }, [timekeepingData]); // Chỉ phụ thuộc vào timekeepingData, không phụ thuộc vào searchQuery

  const columns = [
    { 
      key: 'id' as const, 
      header: 'STT', 
      sortable: false,
      render: (_: any, index?: number) => {
        if (index !== undefined) {
          return index + 1;
        }
        return '';
      }
    },
    { key: 'employee_code' as const, header: 'Mã NV', sortable: true },
    { key: 'employee_name' as const, header: 'Tên nhân viên', sortable: true },
    { key: 'department' as const, header: 'Phòng ban', sortable: true },
    { key: 'date' as const, header: 'Ngày', sortable: true },
    { key: 'day_of_week' as const, header: 'Thứ' },
    { key: 'check_in' as const, header: 'Giờ vào' },
    { key: 'check_out' as const, header: 'Giờ ra' },
    { 
      key: 'late_minutes' as const, 
      header: 'Trễ (phút)',
      render: (record: TimekeepingRecord) => (
        <span className={record.late_minutes > 0 ? 'text-destructive font-medium' : ''}>
          {record.late_minutes}
        </span>
      )
    },
    { key: 'early_minutes' as const, header: 'Sớm (phút)' },
    { key: 'workday' as const, header: 'Công' },
    { key: 'total_hours' as const, header: 'Tổng giờ' },
    { key: 'overtime_hours' as const, header: 'Tăng ca' },
    { key: 'total_all_hours' as const, header: 'Tổng toàn bộ' },
    { 
      key: 'shift' as const, 
      header: 'Ca',
      render: (record: TimekeepingRecord) => (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
          record.shift === 'CA NGAY' 
            ? 'bg-success/10 text-success' 
            : record.shift === 'CA DEM' 
            ? 'bg-warning/10 text-warning' 
            : 'bg-muted text-muted-foreground'
        }`}>
          {record.shift}
        </span>
      )
    },
  ];

  // Export to Excel function
  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      toast({
        title: 'Cảnh báo',
        description: 'Không có dữ liệu để xuất',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Prepare data for export
      const exportData = filteredData.map((record, index) => ({
        'STT': index + 1,
        'Mã NV': record.employee_code,
        'Tên nhân viên': record.employee_name,
        'Phòng ban': record.department,
        'Ngày': record.date,
        'Thứ': record.day_of_week,
        'Giờ vào': record.check_in,
        'Giờ ra': record.check_out,
        'Trễ (phút)': record.late_minutes,
        'Sớm (phút)': record.early_minutes,
        'Công': record.workday,
        'Tổng giờ': record.total_hours,
        'Tăng ca': record.overtime_hours,
        'Tổng toàn bộ': record.total_all_hours,
        'Ca': record.shift,
      }));

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Báo cáo chấm công');

      // Set column widths
      const columnWidths = [
        { wch: 5 },  // STT
        { wch: 12 }, // Mã NV
        { wch: 25 }, // Tên nhân viên
        { wch: 15 }, // Phòng ban
        { wch: 12 }, // Ngày
        { wch: 10 }, // Thứ
        { wch: 10 }, // Giờ vào
        { wch: 10 }, // Giờ ra
        { wch: 12 }, // Trễ (phút)
        { wch: 12 }, // Sớm (phút)
        { wch: 8 },  // Công
        { wch: 10 }, // Tổng giờ
        { wch: 10 }, // Tăng ca
        { wch: 12 }, // Tổng toàn bộ
        { wch: 10 }, // Ca
      ];
      worksheet['!cols'] = columnWidths;

      // Generate filename with date range
      const startStr = startDate.replace(/-/g, '');
      const endStr = endDate.replace(/-/g, '');
      const filename = `Bao_cao_cham_cong_${startStr}_${endStr}.xlsx`;

      // Write file
      XLSX.writeFile(workbook, filename);

      toast({
        title: 'Thành công',
        description: `Đã xuất ${filteredData.length} bản ghi ra file Excel`,
      });
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Có lỗi xảy ra khi xuất file Excel',
        variant: 'destructive',
      });
    }
  };

  return (
    <div>
      <PageHeader
        title="Báo cáo chấm công"
        description="Chi tiết dữ liệu chấm công theo ngày (chỉ hiển thị dữ liệu mới nhất, không bao gồm dữ liệu đã lưu trữ)"
        breadcrumbs={[{ label: 'Báo cáo' }]}
        action={
          <Button variant="outline" onClick={handleExportExcel} disabled={isLoading || filteredData.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Tổng nhân viên</p>
          <p className="text-2xl font-bold">{summaryStats.uniqueEmployees}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Số ngày làm việc</p>
          <p className="text-2xl font-bold">{summaryStats.totalDays}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Tổng giờ làm</p>
          <p className="text-2xl font-bold">{summaryStats.totalHours}h</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Tổng tăng ca</p>
          <p className="text-2xl font-bold">{summaryStats.totalOvertime}h</p>
        </div>
      </div>

      {/* Filters — Từ ngày/Đến ngày dùng chung từ Sidebar */}
      <div className="chart-container mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">Bộ lọc</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Phòng ban</Label>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn phòng ban" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-destructive mb-2">Lỗi khi tải dữ liệu</p>
            <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          </div>
        </div>
      ) : (
      <DataTable
        data={filteredData}
        columns={columns}
        pageSize={25}
      />
      )}
    </div>
  );
};

export default ReportsPage;

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Filter, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { timekeepingAPI } from '@/services/api';
import { TimekeepingRecord } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';

const HistoryPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Default to last 90 days to show more historical data
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  // Fetch archived timekeeping data from API
  const { data: timekeepingData = [], isLoading, error } = useQuery({
    queryKey: ['timekeeping-history', dateRange.start, dateRange.end, selectedDepartment],
    queryFn: () => timekeepingAPI.getAll({
      start_date: dateRange.start,
      end_date: dateRange.end,
      department: selectedDepartment !== 'all' ? selectedDepartment : undefined,
      archived: true, // Chỉ lấy dữ liệu lịch sử (đã được archive)
    }),
  });

  // Get unique departments from current filtered data
  const departments = useMemo(() => {
    const depts = new Set<string>();
    timekeepingData.forEach((record: TimekeepingRecord) => {
      if (record.department) depts.add(record.department);
    });
    return Array.from(depts).sort();
  }, [timekeepingData]);

  // Use server-side filtered data directly (no client-side filtering needed)
  const filteredData = timekeepingData;

  // Delete all archived records mutation
  const deleteAllMutation = useMutation({
    mutationFn: () => timekeepingAPI.deleteAllArchived(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timekeeping-history'] });
      toast({
        title: 'Thành công',
        description: 'Đã xóa tất cả dữ liệu lịch sử',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Lỗi',
        description: error.message || 'Có lỗi xảy ra khi xóa dữ liệu',
        variant: 'destructive',
      });
    },
  });

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


  return (
    <div>
      <PageHeader
        title="Lịch sử chấm công"
        description="Dữ liệu chấm công đã được lưu trữ (dữ liệu cũ)"
        breadcrumbs={[{ label: 'Lịch sử' }]}
        action={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isLoading || filteredData.length === 0}>
                <Trash2 className="w-4 h-4 mr-2" />
                Xóa tất cả
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Xác nhận xóa tất cả dữ liệu lịch sử
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Bạn có chắc chắn muốn xóa tất cả {filteredData.length} bản ghi lịch sử không? 
                  Hành động này không thể hoàn tác.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Hủy</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteAllMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteAllMutation.isPending}
                >
                  {deleteAllMutation.isPending ? 'Đang xóa...' : 'Xóa tất cả'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />

      {/* Filters */}
      <div className="chart-container mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">Bộ lọc</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Từ ngày</Label>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Đến ngày</Label>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>
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

export default HistoryPage;


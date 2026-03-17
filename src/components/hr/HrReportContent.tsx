import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExcelGrid } from '@/components/shared/ExcelGrid';
import { hrExcelAPI, hrTemplatesAPI } from '@/services/api';
import { formatNumberPlain } from '@/lib/utils';
import { hasBuiltInGrid } from '@/data/hrReportTemplates';
import { useTimeFilterOptional } from '@/contexts/TimeFilterContext';

export const HR_REPORT_DEFS: Record<
  string,
  { title: string; description: string; defaultRowLimit?: number; defaultColLimit?: number }
> = {
  payroll: {
    title: 'HR - Lương / Thuế / BHXH',
    description: 'Upload và xem các sheet về lương, thuế, BHXH…',
  },
  'payroll-kpi': {
    title: 'HR - Báo cáo KPI nhân sự',
    description: 'KPI phòng nhân sự theo ngày: số NV đi làm, OT, tỉ lệ… Tự tính từ dữ liệu chấm công.',
    defaultRowLimit: 50,
    defaultColLimit: 45,
  },
  'workforce-summary': {
    title: 'HR - Báo cáo tổng hợp nhân lực',
    description: '근태 현황 보고서: tổng hợp nhân lực, 출근인원, 출근율, 퇴사인원, 부서별 출근 현황. Tự tính từ dữ liệu chấm công.',
    defaultRowLimit: 100,
    defaultColLimit: 60,
  },
  'temp-timesheet': {
    title: 'HR - Bảng chốt công Thời vụ',
    description: 'Upload và xem bảng chốt công thời vụ.',
    defaultRowLimit: 200,
    defaultColLimit: 60,
  },
  'daily-wage': {
    title: 'HR - Báo cáo tiền công hàng ngày',
    description: 'Upload và xem báo cáo tiền công hàng ngày.',
  },
  'drug-inventory': {
    title: 'HR - Xuất nhập tồn thuốc',
    description: 'Upload và xem báo cáo xuất/nhập/tồn thuốc theo tháng.',
  },
  'medical-room-usage': {
    title: 'HR - Hiện trạng sử dụng phòng y tế',
    description: 'Upload và xem báo cáo phòng y tế (ưu tiên các sheet báo cáo).',
  },
  'attendance-count': {
    title: 'HR - Số lượng đi làm',
    description: 'Upload và xem báo cáo số lượng đi làm.',
    defaultRowLimit: 100,
    defaultColLimit: 200,
  },
  'weekly-one-day-workers': {
    title: 'HR - Thời vụ làm 1 công/tuần',
    description: 'Upload và xem báo cáo số lượng làm 1 công trong tuần.',
  },
  'labor-rate': {
    title: 'HR - Tỉ lệ nhân lực',
    description: 'Upload và xem báo cáo tỉ lệ nhân lực.',
  },
  'official-timesheet': {
    title: 'HR - Chốt công Chính thức',
    description: 'Upload và xem file chốt công chính thức.',
  },
  'bhxh-list': {
    title: 'HR - Danh sách tham gia BHXH',
    description: 'Upload và xem danh sách tham gia BHXH (tăng/giảm…).',
  },
  'insurance-master': {
    title: 'HR - Biểu mẫu bảo hiểm',
    description: 'Upload và xem các sheet dữ liệu/bảng kê/tổng hợp bảo hiểm.',
  },
  'attendance-rate': {
    title: 'HR - Tỉ lệ đi làm',
    description: 'Upload và xem báo cáo tỉ lệ đi làm (thường theo Vendor, theo tháng/tuần).',
    defaultRowLimit: 60,
    defaultColLimit: 200,
  },
  'arrears-collection': {
    title: 'HR - Truy thu',
    description: 'Upload và xem biểu mẫu truy thu theo tháng.',
  },
};

function safeParseSheetNames(sheetNamesRaw: any): string[] {
  if (!sheetNamesRaw) return [];
  if (Array.isArray(sheetNamesRaw)) return sheetNamesRaw.map(String);
  if (typeof sheetNamesRaw === 'string') {
    try {
      const v = JSON.parse(sheetNamesRaw);
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

interface HrReportContentProps {
  reportType: string;
  /** Khi embed inline (không có padding wrapper) */
  compact?: boolean;
}

export const HrReportContent = ({ reportType, compact }: HrReportContentProps) => {
  const reportKey = reportType || '';
  const reportDef = HR_REPORT_DEFS[reportKey];

  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rowLimit, setRowLimit] = useState<number>(200);
  const [colLimit, setColLimit] = useState<number>(80);

  const {
    data: latestUpload,
    isLoading: loadingLatest,
    refetch: refetchLatest,
  } = useQuery({
    queryKey: ['hrExcel', 'latest', reportKey],
    queryFn: () => hrExcelAPI.getLatest(reportKey),
    enabled: !!reportKey,
  });

  const sheetNames = useMemo(() => safeParseSheetNames((latestUpload as any)?.sheet_names), [latestUpload]);

  useEffect(() => {
    if (!latestUpload) return;

    const defRow = reportDef?.defaultRowLimit ?? 200;
    const defCol = reportDef?.defaultColLimit ?? 80;
    setRowLimit(defRow);
    setColLimit(defCol);

    const defaultSheet = (latestUpload as any)?.default_sheet as string | undefined;
    const initial = defaultSheet || sheetNames[0] || '';
    setSelectedSheet(prev => (prev ? prev : initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(latestUpload as any)?.id]);

  const uploadMutation = useMutation({
    mutationFn: async (f: File) => {
      return hrExcelAPI.upload(reportKey, f);
    },
    onSuccess: async () => {
      toast.success('Upload HR Excel thành công');
      setFile(null);
      setSelectedSheet('');
      await queryClient.invalidateQueries({ queryKey: ['hrExcel', 'latest', reportKey] });
      await refetchLatest();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Upload thất bại');
    },
  });

  const {
    data: sheetView,
    isLoading: loadingSheet,
    error: sheetError,
  } = useQuery({
    queryKey: ['hrExcel', 'sheet', (latestUpload as any)?.id, selectedSheet, rowLimit, colLimit],
    queryFn: () =>
      hrExcelAPI.getSheet((latestUpload as any).id, selectedSheet, {
        rowStart: 0,
        rowLimit,
        colStart: 0,
        colLimit,
      }),
    enabled: !!(latestUpload as any)?.id && !!selectedSheet,
  });

  const { data: reportStats } = useQuery({
    queryKey: ['hrExcel', 'stats', reportKey],
    queryFn: () => hrExcelAPI.getStats(reportKey),
    enabled: !!reportKey,
  });

  const timeFilter = useTimeFilterOptional();
  const gridParams = (() => {
    if (timeFilter?.params?.start_date && timeFilter?.params?.end_date) {
      return { start_date: timeFilter.params.start_date, end_date: timeFilter.params.end_date };
    }
    if (timeFilter?.filterMode === 'month' && timeFilter?.baseDate) {
      const { start, end } = timeFilter.getMonthRange(timeFilter.baseDate);
      return { start_date: start, end_date: end };
    }
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return { start_date: `${y}-${m}-01`, end_date: `${y}-${m}-${new Date(y, now.getMonth() + 1, 0).getDate()}` };
  })();

  const { data: templateGrid, isLoading: loadingGrid } = useQuery({
    queryKey: ['hrTemplates', 'grid', reportKey, gridParams.start_date, gridParams.end_date],
    queryFn: () => hrTemplatesAPI.getGrid(reportKey, gridParams),
    enabled: !!reportKey && hasBuiltInGrid(reportKey),
  });

  if (!reportDef) {
    return (
      <div className={compact ? 'py-4' : 'p-6'}>
        <PageHeader title="HR Report" description="Report type không tồn tại" />
      </div>
    );
  }

  const createdAt = (latestUpload as any)?.created_at
    ? new Date((latestUpload as any).created_at).toLocaleString()
    : '';

  const statsOverall = (reportStats as any)?.stats?.overall;
  const statsAttendanceCount = (reportStats as any)?.stats?.attendanceCount;
  const statsBhxhList = (reportStats as any)?.stats?.bhxhList;
  const statsPayroll = (reportStats as any)?.stats?.payroll;
  const statsTimesheet = (reportStats as any)?.stats?.timesheet;
  const statsDailyWage = (reportStats as any)?.stats?.dailyWage;
  const statsArrears = (reportStats as any)?.stats?.arrearsCollection;
  const statsInsurance = (reportStats as any)?.stats?.insuranceMaster;
  const statsMedical = (reportStats as any)?.stats?.medicalRoomUsage;
  const statsDrug = (reportStats as any)?.stats?.drugInventory;
  const statsTotalRow = (reportStats as any)?.stats?.totalRow;
  const statsTotalRowSummary = (reportStats as any)?.stats?.totalRowSummary;

  const wrapperClass = compact ? 'space-y-6' : 'p-6 space-y-6';

  const templateMerges = (templateGrid && 'merges' in templateGrid && templateGrid.merges) ? (templateGrid.merges || []).map((m: { s: { r: number; c: number }; e: { r: number; c: number } }) => ({ s: m.s, e: m.e })) : [];
  type SheetItem = { name: string; rows: (string | number)[][]; merges?: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>; rowStyles?: Record<number, { backgroundColor?: string; color?: string; fontWeight?: string; textAlign?: 'left' | 'center' | 'right' }>; cellStyles?: Record<string, { color?: string }> };
  const hasSheets = templateGrid && 'sheets' in templateGrid && Array.isArray((templateGrid as { sheets?: SheetItem[] }).sheets);
  const multiSheets = hasSheets ? (templateGrid as { sheets: SheetItem[] }).sheets : null;
  const isBuiltIn = hasBuiltInGrid(reportKey);

  return (
    <div className={wrapperClass}>
      <PageHeader title={reportDef.title} description={reportDef.description} />

      {isBuiltIn && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Báo cáo từ dữ liệu hệ thống</CardTitle>
            <CardDescription>
              Dữ liệu chấm công và nhân viên được tính tự động theo biểu mẫu. Bộ lọc thời gian (Sidebar) áp dụng cho khoảng: {gridParams.start_date} → {gridParams.end_date}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingGrid ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Đang tải dữ liệu...</div>
            ) : multiSheets && multiSheets.length > 0 ? (
              <div className="space-y-6">
                {multiSheets.map((sheet) => (
                  <div key={sheet.name}>
                    <h3 className="text-sm font-semibold mb-2 border-b pb-1">{sheet.name}</h3>
                    <ExcelGrid
                      rows={sheet.rows}
                      merges={sheet.merges}
                      rowStyles={sheet.rowStyles}
                      cellStyles={sheet.cellStyles}
                    />
                  </div>
                ))}
              </div>
            ) : templateGrid && 'rows' in templateGrid && (templateGrid.rows?.length ?? 0) > 0 ? (
              <ExcelGrid rows={templateGrid.rows} merges={templateMerges} />
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">Chưa có dữ liệu cho khoảng thời gian này.</div>
            )}
          </CardContent>
        </Card>
      )}

      {!isBuiltIn && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Chỉ số</CardTitle>
              <CardDescription>Trích từ sheet mặc định (nếu có)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {statsOverall ? (
                <>
                  <div>
                    <span className="font-medium">Tổng:</span> {statsOverall.total}
                  </div>
                  <div>
                    <span className="font-medium">Đi làm:</span> {statsOverall.attended}
                  </div>
                  <div>
                    <span className="font-medium">Tỉ lệ:</span>{' '}
                    {statsOverall.rate !== null && statsOverall.rate !== undefined ? `${statsOverall.rate}%` : '—'}
                  </div>
                </>
              ) : statsAttendanceCount ? (
                <>
                  <div className="font-medium">Tổng theo nhóm (cộng tất cả cột)</div>
                  <div>
                    <span className="font-medium">Chính thức:</span> {statsAttendanceCount.sums?.official ?? 0}
                  </div>
                  <div>
                    <span className="font-medium">Thời vụ:</span> {statsAttendanceCount.sums?.seasonal ?? 0}
                  </div>
                  <div>
                    <span className="font-medium">Người mới:</span> {statsAttendanceCount.sums?.newEmployees ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Triples: {statsAttendanceCount.triplesCount ?? 0}
                  </div>
                </>
              ) : statsBhxhList?.soPhaiNop ? (
                <>
                  <div className="font-medium">BHXH - Tóm tắt</div>
                  <div>
                    <span className="font-medium">Số phải nộp:</span>{' '}
                    {formatNumberPlain(statsBhxhList.soPhaiNop.value)}
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground">Chưa có chỉ số (cần upload hoặc report chưa hỗ trợ).</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!isBuiltIn && latestUpload && sheetNames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sheet</CardTitle>
            <CardDescription>Chọn sheet để xem nội dung (hỗ trợ file nhiều sheet).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="space-y-2 flex-1">
                <Label>Sheet</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                >
                  {sheetNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setRowLimit((v) => v + 100)}
                  disabled={!sheetView || !(sheetView as any).hasMoreRows}
                >
                  +100 dòng
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setColLimit((v) => v + 50)}
                  disabled={!sheetView || !(sheetView as any).hasMoreCols}
                >
                  +50 cột
                </Button>
              </div>
            </div>

            {loadingSheet ? (
              <div className="text-sm text-muted-foreground">Đang tải sheet...</div>
            ) : sheetError ? (
              <div className="text-sm text-destructive">
                {(sheetError as any)?.message || 'Có lỗi khi tải sheet'}
              </div>
            ) : sheetView ? (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  Đang hiển thị {(sheetView as any)?.slice?.rows}×{(sheetView as any)?.slice?.cols} ô. Tổng sheet{' '}
                  {(sheetView as any)?.total?.rows}×{(sheetView as any)?.total?.cols}.
                </div>
                <ExcelGrid rows={(sheetView as any).rows || []} merges={(sheetView as any).merges || []} />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Chưa có dữ liệu sheet.</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

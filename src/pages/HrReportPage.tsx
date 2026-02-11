import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExcelGrid } from '@/components/shared/ExcelGrid';
import { hrExcelAPI } from '@/services/api';
import { formatNumberPlain } from '@/lib/utils';

const HR_REPORT_DEFS: Record<
  string,
  { title: string; description: string; defaultRowLimit?: number; defaultColLimit?: number }
> = {
  payroll: {
    title: 'HR - Lương / Thuế / BHXH',
    description: 'Upload và xem các sheet về lương, thuế, BHXH…',
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

const HrReportPage = () => {
  const { reportType } = useParams();
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

  if (!reportDef) {
    return (
      <div className="p-6">
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

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={reportDef.title} description={reportDef.description} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Upload</CardTitle>
            <CardDescription>Upload đúng file Excel của biểu mẫu này để hiển thị lên trang.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hr-file">File Excel</Label>
              <Input
                id="hr-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={uploadMutation.isPending}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => {
                  if (!file) {
                    toast.error('Vui lòng chọn file Excel trước');
                    return;
                  }
                  uploadMutation.mutate(file);
                }}
                disabled={!file || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? 'Đang upload...' : 'Upload'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                }}
                disabled={uploadMutation.isPending}
              >
                Xóa
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              {loadingLatest ? (
                'Đang tải thông tin file gần nhất...'
              ) : latestUpload ? (
                <>
                  <div>
                    <span className="font-medium text-foreground">File gần nhất:</span>{' '}
                    {(latestUpload as any).original_file_name}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Uploaded:</span> {createdAt}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Default sheet:</span>{' '}
                    {(latestUpload as any).default_sheet || '—'}
                  </div>
                </>
              ) : (
                'Chưa có file nào được upload cho biểu mẫu này.'
              )}
            </div>
          </CardContent>
        </Card>

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
                {statsBhxhList.phatSinhPhaiDong?.value !== null && statsBhxhList.phatSinhPhaiDong?.value !== undefined ? (
                  <div>
                    <span className="font-medium">Phát sinh phải đóng:</span>{' '}
                    {formatNumberPlain(statsBhxhList.phatSinhPhaiDong.value)}
                  </div>
                ) : null}
                {statsBhxhList.truyThu?.value !== null && statsBhxhList.truyThu?.value !== undefined ? (
                  <div>
                    <span className="font-medium">Truy thu:</span>{' '}
                    {formatNumberPlain(statsBhxhList.truyThu.value)}
                  </div>
                ) : null}
              </>
            ) : statsTimesheet ? (
              <>
                <div className="font-medium">Chốt công - Tóm tắt</div>
                <div>
                  <span className="font-medium">Số người:</span> {statsTimesheet.employeesCount ?? 0}
                </div>
                <div>
                  <span className="font-medium">Tổng công:</span> {statsTimesheet.sums?.workDays ?? 0}
                </div>
                <div>
                  <span className="font-medium">Tổng giờ:</span> {statsTimesheet.sums?.workHours ?? 0}
                </div>
                {statsTimesheet.sums?.paidHours !== null && statsTimesheet.sums?.paidHours !== undefined ? (
                  <div>
                    <span className="font-medium">Giờ tính lương:</span> {statsTimesheet.sums?.paidHours ?? 0}
                  </div>
                ) : null}
              </>
            ) : statsInsurance?.employeesCount !== null && statsInsurance?.employeesCount !== undefined ? (
              <>
                <div className="font-medium">Bảo hiểm - Tóm tắt</div>
                <div>
                  <span className="font-medium">Số lao động:</span> {statsInsurance.employeesCount ?? 0}
                </div>
                <div>
                  <span className="font-medium">Số thành viên:</span> {statsInsurance.familyMembersCount ?? 0}
                </div>
              </>
            ) : statsMedical?.money ? (
              <>
                <div className="font-medium">Phòng y tế - Tóm tắt</div>
                <div>
                  <span className="font-medium">Tổng tiền:</span>{' '}
                  {statsMedical.money.sum !== null && statsMedical.money.sum !== undefined
                    ? formatNumberPlain(statsMedical.money.sum)
                    : '—'}
                </div>
                <div>
                  <span className="font-medium">Tổng người:</span>{' '}
                  {statsMedical.people?.sum !== null && statsMedical.people?.sum !== undefined
                    ? formatNumberPlain(statsMedical.people.sum)
                    : '—'}
                </div>
                <div>
                  <span className="font-medium">Max tỉ lệ(%):</span>{' '}
                  {statsMedical.rate?.max !== null && statsMedical.rate?.max !== undefined
                    ? `${statsMedical.rate.max}%`
                    : '—'}
                </div>
              </>
            ) : statsDrug ? (
              <>
                <div className="font-medium">Xuất nhập tồn thuốc - Tóm tắt</div>
                <div>
                  <span className="font-medium">Xuất (qty):</span> {statsDrug.exportQty ?? 0}
                </div>
                <div>
                  <span className="font-medium">Nhập (qty):</span> {statsDrug.importQty ?? 0}
                </div>
              </>
            ) : statsArrears ? (
              <>
                <div className="font-medium">Truy thu - Tóm tắt</div>
                <div>
                  <span className="font-medium">Tổng (max):</span>{' '}
                  {statsArrears.amountMax !== null && statsArrears.amountMax !== undefined
                    ? formatNumberPlain(statsArrears.amountMax)
                    : '—'}
                </div>
                <div>
                  <span className="font-medium">Tổng (sum):</span>{' '}
                  {statsArrears.amountSum !== null && statsArrears.amountSum !== undefined
                    ? formatNumberPlain(statsArrears.amountSum)
                    : '—'}
                </div>
              </>
            ) : statsPayroll?.bhxh || statsPayroll?.tax ? (
              <>
                <div className="font-medium">Payroll - Tóm tắt</div>
                {statsPayroll?.bhxh?.vietnamese?.rate !== null && statsPayroll?.bhxh?.vietnamese?.rate !== undefined ? (
                  <div>
                    <span className="font-medium">BHXH VN (tổng):</span> {statsPayroll.bhxh.vietnamese.rate}%
                  </div>
                ) : null}
                {statsPayroll?.bhxh?.korean?.rate !== null && statsPayroll?.bhxh?.korean?.rate !== undefined ? (
                  <div>
                    <span className="font-medium">BHXH KR (tổng):</span> {statsPayroll.bhxh.korean.rate}%
                  </div>
                ) : null}
                {statsPayroll?.tax?.totalSum !== null && statsPayroll?.tax?.totalSum !== undefined ? (
                  <div>
                    <span className="font-medium">Thuế TNCN (sum):</span>{' '}
                    {formatNumberPlain(statsPayroll.tax.totalSum)}
                  </div>
                ) : null}
              </>
            ) : statsDailyWage ? (
              <>
                <div className="font-medium">Tiền công hàng ngày - Tóm tắt</div>
                <div>
                  <span className="font-medium">Tổng:</span>{' '}
                  {statsDailyWage.grandTotal !== null && statsDailyWage.grandTotal !== undefined
                    ? formatNumberPlain(statsDailyWage.grandTotal)
                    : '—'}
                </div>
              </>
            ) : statsTotalRow ? (
              <>
                <div className="text-muted-foreground">
                  Tìm thấy dòng <span className="font-medium">Total/Tổng</span>. (Hiển thị 8 ô đầu)
                </div>
                <div className="space-y-1">
                  {(statsTotalRow.values || [])
                    .slice(0, 8)
                    .map((x: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">C{x.c1}</span>
                        <span className="font-mono text-xs">{String(x.value)}</span>
                      </div>
                    ))}
                </div>
              </>
            ) : statsTotalRowSummary ? (
              <>
                <div className="text-muted-foreground">Tóm tắt dòng Total/Tổng</div>
                <div>
                  <span className="font-medium">Số lượng số:</span> {statsTotalRowSummary.numbersCount ?? 0}
                </div>
                <div>
                  <span className="font-medium">Tổng (sum):</span> {statsTotalRowSummary.numbersSum ?? 0}
                </div>
                <div>
                  <span className="font-medium">Max:</span> {statsTotalRowSummary.numbersMax ?? '—'}
                </div>
                <div>
                  <span className="font-medium">Min:</span> {statsTotalRowSummary.numbersMin ?? '—'}
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">Chưa có chỉ số (cần upload hoặc report chưa hỗ trợ).</div>
            )}
          </CardContent>
        </Card>
      </div>

      {latestUpload && sheetNames.length > 0 && (
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

export default HrReportPage;


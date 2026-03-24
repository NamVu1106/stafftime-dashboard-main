import { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Loader2, Info, LayoutDashboard, Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { uploadAPI, hrExcelAPI } from '@/services/api';
import { useI18n } from '@/hooks/useI18n';

interface UploadedFile {
  name: string;
  size: number;
  status: 'pending' | 'success' | 'error';
}

type EmployeeUploadType = 'employee' | 'timekeeping' | 'official' | 'seasonal';

/** Loại báo cáo Dashboard — upload Excel riêng, không ghi vào danh sách nhân viên */
const HR_REPORT_GROUPS: { group: string; items: { value: string; label: string }[] }[] = [
  {
    group: 'Tổng quan / Vendor / Ca',
    items: [
      { value: 'labor-rate', label: 'Tỷ lệ lao động — cung cấp nhân lực vendor (BC tỷ lệ…)' },
      { value: 'attendance-rate', label: 'Tỉ lệ đi làm' },
      { value: 'attendance-count', label: 'Số lượng đi làm' },
      { value: 'weekly-one-day-workers', label: 'Công nhân 1 ngày / tuần' },
    ],
  },
  {
    group: 'Công — chấm công (biểu mẫu Excel)',
    items: [
      { value: 'temp-timesheet', label: 'Công thời vụ (timesheet Excel)' },
      { value: 'official-timesheet', label: 'Công chính thức (timesheet Excel)' },
    ],
  },
  {
    group: 'BHXH — Lương — Kế toán',
    items: [
      { value: 'insurance-master', label: 'Bảo hiểm / master' },
      { value: 'bhxh-list', label: 'Danh sách BHXH' },
      { value: 'payroll', label: 'Bảng lương' },
      { value: 'daily-wage', label: 'Tiền công' },
      { value: 'arrears-collection', label: 'Truy thu' },
    ],
  },
  {
    group: 'Hành chính / Y tế',
    items: [
      { value: 'drug-inventory', label: 'Kho thuốc' },
      { value: 'medical-room-usage', label: 'Sử dụng phòng y tế' },
    ],
  },
  {
    group: 'Khác',
    items: [{ value: 'other', label: 'File Excel tổng hợp / Sheet tùy chỉnh' }],
  },
];

const UploadPage = () => {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const employeeFileInputRef = useRef<HTMLInputElement>(null);
  const timekeepingFileInputRef = useRef<HTMLInputElement>(null);
  const officialFileInputRef = useRef<HTMLInputElement>(null);
  const seasonalFileInputRef = useRef<HTMLInputElement>(null);
  const reportExcelInputRef = useRef<HTMLInputElement>(null);
  const [employeeFile, setEmployeeFile] = useState<UploadedFile | null>(null);
  const [timekeepingFile, setTimekeepingFile] = useState<UploadedFile | null>(null);
  const [officialFile, setOfficialFile] = useState<UploadedFile | null>(null);
  const [seasonalFile, setSeasonalFile] = useState<UploadedFile | null>(null);
  const [previewData, setPreviewData] = useState<Array<Record<string, string>>>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [reportType, setReportType] = useState<string>('labor-rate');
  const [reportFile, setReportFile] = useState<UploadedFile | null>(null);
  const [reportExcelFile, setReportExcelFile] = useState<File | null>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent, type: EmployeeUploadType) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
        const uploadedFile: UploadedFile = { name: file.name, size: file.size, status: 'pending' };
        if (type === 'employee') setEmployeeFile(uploadedFile);
        else if (type === 'timekeeping') setTimekeepingFile(uploadedFile);
        else if (type === 'official') setOfficialFile(uploadedFile);
        else if (type === 'seasonal') setSeasonalFile(uploadedFile);
        setSelectedFile(file);
        setPreviewData([]);
      } else {
        toast({ title: t('common.error'), description: t('upload.invalidFile'), variant: 'destructive' });
      }
    },
    [toast, t]
  );

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: EmployeeUploadType) => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      const uploadedFile: UploadedFile = { name: file.name, size: file.size, status: 'pending' };
      if (type === 'employee') setEmployeeFile(uploadedFile);
      else if (type === 'timekeeping') setTimekeepingFile(uploadedFile);
      else if (type === 'official') setOfficialFile(uploadedFile);
      else if (type === 'seasonal') setSeasonalFile(uploadedFile);
      setSelectedFile(file);
      setPreviewData([]);
    }
  }, []);

  const handleReportDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
        setReportFile({ name: file.name, size: file.size, status: 'pending' });
        setReportExcelFile(file);
      } else {
        toast({ title: t('common.error'), description: t('upload.invalidFile'), variant: 'destructive' });
      }
    },
    [toast, t]
  );

  const handleReportFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setReportFile({ name: file.name, size: file.size, status: 'pending' });
      setReportExcelFile(file);
    }
  }, []);

  const uploadEmployeeMutation = useMutation({
    mutationFn: (file: File) => uploadAPI.uploadEmployees(file),
    onSuccess: (data) => {
      if (employeeFile) setEmployeeFile({ ...employeeFile, status: 'success' });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'employees' });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'statistics' });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.refetchQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      queryClient.refetchQueries({ queryKey: ['notifications', 'unread-count'] });
      let description = t('upload.uploadSuccessMessage', {
        count: data.count || 0,
        totalRows: data.totalRows || 0,
      });
      if (data.skippedRows > 0) description += t('upload.uploadSuccessSkipped', { skippedRows: data.skippedRows });
      toast({
        title: data.count > 0 ? t('common.success') : t('common.warning') || 'Cảnh báo',
        description,
        variant: data.count === 0 ? 'destructive' : 'default',
      });
      setSelectedFile(null);
      if (employeeFileInputRef.current) employeeFileInputRef.current.value = '';
    },
    onError: (error: any) => {
      if (employeeFile) setEmployeeFile({ ...employeeFile, status: 'error' });
      toast({ title: t('common.error'), description: error.message || t('upload.uploadError'), variant: 'destructive' });
    },
  });

  const uploadTimekeepingMutation = useMutation({
    mutationFn: (file: File) => uploadAPI.uploadTimekeeping(file),
    onSuccess: (data) => {
      if (timekeepingFile) setTimekeepingFile({ ...timekeepingFile, status: 'success' });
      const timekeepingRelated = ['timekeeping', 'timekeeping-history', 'timekeeping-day', 'timekeeping-month', 'timekeeping-year', 'timekeeping-range', 'recentTimekeeping'];
      timekeepingRelated.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && q.queryKey[0].startsWith('timekeeping') });
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && q.queryKey[0].startsWith('dashboard') });
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && q.queryKey[0].startsWith('statistics') });
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && q.queryKey[0].startsWith('department') });
      ['attendanceByDate', 'gender', 'age', 'employmentType', 'genderByEmploymentType', 'weekly-temporary-workers', 'realtime', 'departments-list'].forEach((k) =>
        queryClient.invalidateQueries({ queryKey: [k] })
      );
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.refetchQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      queryClient.refetchQueries({ queryKey: ['notifications', 'unread-count'] });
      queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'hrExcel' });
      let description = t('upload.timekeepingUploadSuccessMessage', { count: data.count || 0, totalRows: data.totalRows || 0 });
      description += t('upload.timekeepingUploadNote');
      toast({ title: t('common.success'), description, duration: 8000 });
      setSelectedFile(null);
      if (timekeepingFileInputRef.current) timekeepingFileInputRef.current.value = '';
    },
    onError: (error: any) => {
      if (timekeepingFile) setTimekeepingFile({ ...timekeepingFile, status: 'error' });
      toast({ title: t('common.error'), description: error.message || t('upload.uploadError'), variant: 'destructive' });
    },
  });

  const uploadOfficialMutation = useMutation({
    mutationFn: (file: File) => uploadAPI.uploadEmployeesOfficial(file),
    onSuccess: (data) => {
      if (officialFile) setOfficialFile({ ...officialFile, status: 'success' });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'employees' });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'statistics', 'notifications'] });
      queryClient.refetchQueries({ queryKey: ['notifications'] });
      toast({
        title: t('common.success'),
        description: `Đã đồng bộ ${data.upserted ?? data.count ?? 0} nhân viên chính thức vào Danh sách nhân viên.`,
      });
      setSelectedFile(null);
      if (officialFileInputRef.current) officialFileInputRef.current.value = '';
    },
    onError: (error: any) => {
      if (officialFile) setOfficialFile({ ...officialFile, status: 'error' });
      toast({ title: t('common.error'), description: error.message || t('upload.uploadError'), variant: 'destructive' });
    },
  });

  const uploadSeasonalMutation = useMutation({
    mutationFn: (file: File) => uploadAPI.uploadEmployeesSeasonal(file),
    onSuccess: (data) => {
      if (seasonalFile) setSeasonalFile({ ...seasonalFile, status: 'success' });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'employees' });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'statistics', 'notifications'] });
      queryClient.refetchQueries({ queryKey: ['notifications'] });
      toast({
        title: t('common.success'),
        description: `Đã đồng bộ ${data.upserted ?? data.count ?? 0} nhân viên thời vụ vào Danh sách nhân viên.`,
      });
      setSelectedFile(null);
      if (seasonalFileInputRef.current) seasonalFileInputRef.current.value = '';
    },
    onError: (error: any) => {
      if (seasonalFile) setSeasonalFile({ ...seasonalFile, status: 'error' });
      toast({ title: t('common.error'), description: error.message || t('upload.uploadError'), variant: 'destructive' });
    },
  });

  const uploadReportExcelMutation = useMutation({
    mutationFn: ({ file, rt }: { file: File; rt: string }) => hrExcelAPI.upload(rt, file),
    onSuccess: (_data, { rt }) => {
      queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'hrExcel' });
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && q.queryKey[0].startsWith('dashboard') });
      toast({
        title: 'Đã tải lên báo cáo',
        description: `File đã gắn với loại «${HR_REPORT_GROUPS.flatMap((g) => g.items).find((i) => i.value === rt)?.label || rt}». Mở Trang chủ / Tổng quan hoặc menu Nhân sự → chức năng tương ứng để xem.`,
        duration: 10000,
      });
      setReportFile(null);
      setReportExcelFile(null);
      if (reportExcelInputRef.current) reportExcelInputRef.current.value = '';
    },
    onError: (error: any) => {
      setReportFile((f) => (f ? { ...f, status: 'error' } : null));
      toast({ title: t('common.error'), description: error.message || 'Upload báo cáo thất bại', variant: 'destructive' });
    },
  });

  const handleUpload = async (type: EmployeeUploadType) => {
    const ref =
      type === 'employee'
        ? employeeFileInputRef
        : type === 'timekeeping'
          ? timekeepingFileInputRef
          : type === 'official'
            ? officialFileInputRef
            : seasonalFileInputRef;
    const file = selectedFile || ref.current?.files?.[0];
    if (!file) {
      toast({ title: t('common.error'), description: t('upload.selectFileFirst'), variant: 'destructive' });
      return;
    }
    if (type === 'employee') uploadEmployeeMutation.mutate(file);
    else if (type === 'timekeeping') uploadTimekeepingMutation.mutate(file);
    else if (type === 'official') uploadOfficialMutation.mutate(file);
    else if (type === 'seasonal') uploadSeasonalMutation.mutate(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const UploadZone = ({
    type,
    file,
    setFile,
    title,
    desc,
    uploadLabel,
  }: {
    type: EmployeeUploadType;
    file: UploadedFile | null;
    setFile: (file: UploadedFile | null) => void;
    title?: string;
    desc?: string;
    uploadLabel?: string;
  }) => {
    const inputRef =
      type === 'employee'
        ? employeeFileInputRef
        : type === 'timekeeping'
          ? timekeepingFileInputRef
          : type === 'official'
            ? officialFileInputRef
            : seasonalFileInputRef;
    const isPending =
      type === 'employee'
        ? uploadEmployeeMutation.isPending
        : type === 'timekeeping'
          ? uploadTimekeepingMutation.isPending
          : type === 'official'
            ? uploadOfficialMutation.isPending
            : uploadSeasonalMutation.isPending;
    return (
      <div className="space-y-4">
        {(title || desc) && (
          <div className="mb-2">
            {title && <h4 className="font-semibold text-base">{title}</h4>}
            {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
          </div>
        )}
        {!file ? (
          <div className="upload-zone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, type)}>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => handleFileChange(e, type)}
              className="hidden"
              id={`file-${type}`}
            />
            <label htmlFor={`file-${type}`} className="cursor-pointer">
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground mb-1">{t('upload.selectFile')}</p>
              <p className="text-xs text-muted-foreground">{t('upload.fileFormat')}</p>
            </label>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {file.status === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-success" />
                ) : file.status === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-destructive" />
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setFile(null);
                    setPreviewData([]);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
        {file && previewData.length > 0 && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/50">
              <p className="text-sm font-medium">{t('upload.preview')}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table text-sm">
                <thead>
                  <tr>
                    {Object.keys(previewData[0]).map((key) => (
                      <th key={key}>{previewData[0][key]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(1).map((row, idx) => (
                    <tr key={idx}>
                      {Object.values(row).map((val, i) => (
                        <td key={i}>{val}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {file && file.status === 'pending' && (
          <Button onClick={() => handleUpload(type)} disabled={isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('upload.uploading')}
              </>
            ) : (
              uploadLabel ?? t('upload.upload')
            )}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title={t('upload.title')}
        description={t('upload.description')}
        breadcrumbs={[{ label: t('upload.title') }]}
      />

      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4" />
        <AlertTitle>Hai luồng upload — chọn đúng chỗ</AlertTitle>
        <AlertDescription className="mt-2 space-y-2 text-sm">
          <p>
            <strong className="text-foreground">① Nhân sự &amp; chấm công</strong> — Upload nhân viên / chấm công. Báo cáo
            «Tỉ lệ đi làm» theo <em>nhà cung cấp (Vendor)</em>: vào{' '}
            <Link to="/hr/vendor-assignments" className="font-medium text-primary underline">
              Gán Vendor (NCC)
            </Link>{' '}
            (Mã NV → NCC), không dùng phòng ban làm Vendor.{' '}
            <Link to="/employees" className="font-medium text-primary underline inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Danh sách NV
            </Link>
            .
          </p>
          <p>
            <strong className="text-foreground">② Excel báo cáo Dashboard</strong> — Các bảng kiểu vendor, ca ngày/đêm,
            Sheet3, BHXH, lương…{' '}
            <em>không</em> đưa vào danh sách nhân viên: dùng khối &quot;Upload Excel cho báo cáo&quot;, chọn đúng{' '}
            <em>loại báo cáo</em>, rồi mở{' '}
            <Link to="/" className="font-medium text-primary underline inline-flex items-center gap-1">
              <LayoutDashboard className="w-3.5 h-3.5" /> Trang chủ / Tổng quan
            </Link>{' '}
            hoặc menu Nhân sự để xem.
          </p>
        </AlertDescription>
      </Alert>

      {/* —— Luồng 1 —— */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            ① Dữ liệu nhân sự &amp; chấm công (vào hệ thống)
          </CardTitle>
          <CardDescription>
            Upload đúng file nhân viên (chính thức / thời vụ / chung) và file chấm công máy. Sau khi tải lên, dữ liệu
            đồng bộ bảng nhân viên và bảng công — không dùng cho các lưới vendor trên Dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="employee" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="employee">Nhân viên → Danh sách NV</TabsTrigger>
              <TabsTrigger value="timekeeping">Chấm công → Lịch sử &amp; thống kê</TabsTrigger>
            </TabsList>

            <TabsContent value="employee">
              <div className="space-y-8">
                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  <li>
                    <strong className="text-foreground">Chính thức / Thời vụ:</strong> đúng mẫu Excel công ty → cột map
                    vào Mã NV, Họ tên, Giới tính, Ngày sinh, Phòng ban, Loại hình, v.v.
                  </li>
                  <li>
                    <strong className="text-foreground">Upload chung:</strong> file có cột Mã NV, Tên, Giới tính, Ngày
                    sinh, Phòng ban…
                  </li>
                </ul>
                <div className="grid gap-8 md:grid-cols-2">
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <UploadZone
                      type="official"
                      file={officialFile}
                      setFile={setOfficialFile}
                      title="Nhân viên chính thức"
                      desc="Mẫu: THÔNG TIN CNV TỔNG VINA (sheet Thông tin công nhân). → Cập nhật Quản lý nhân viên (chính thức)."
                      uploadLabel="Tải lên"
                    />
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <UploadZone
                      type="seasonal"
                      file={seasonalFile}
                      setFile={setSeasonalFile}
                      title="Nhân viên thời vụ"
                      desc="Mẫu: Thời vụ tổng (sheet TT). → Cập nhật Quản lý nhân viên (thời vụ)."
                      uploadLabel="Tải lên"
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-dashed border-border bg-muted/10 p-4">
                  <p className="text-sm font-medium mb-1">Upload chung (tự nhận dạng cột)</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Một file Excel bất kỳ có đủ cột chuẩn — gộp vào danh sách nhân viên.
                  </p>
                  <UploadZone type="employee" file={employeeFile} setFile={setEmployeeFile} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="timekeeping">
              <div className="space-y-4">
                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  <li>File xuất từ <strong className="text-foreground">máy chấm công</strong> (theo ngày/tuần).</li>
                  <li>
                    Dữ liệu vào <strong className="text-foreground">bảng chấm công</strong> — dùng cho lịch sử, báo cáo
                    theo ngày/tháng, đi trễ, tăng ca…
                  </li>
                  <li>Không thay thế file vendor / BC tỷ lệ nhà thầu (dùng khối báo cáo bên dưới).</li>
                </ul>
                <UploadZone type="timekeeping" file={timekeepingFile} setFile={setTimekeepingFile} />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* —— Luồng 2 —— */}
      <Card className="border-amber-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-amber-600" />
            ② Upload Excel riêng — chỉ cho báo cáo Dashboard
          </CardTitle>
          <CardDescription>
            Dùng cho các sheet <strong>không</strong> có cấu trúc &quot;một dòng = một nhân viên&quot;: vendor, PO, ca
            ngày/đêm, Sheet3, BHXH, lương… Chọn <strong>đúng loại báo cáo</strong> trước khi tải file — dữ liệu hiển thị
            trên Tổng quan / menu Nhân sự, <em>không</em> ghi vào danh sách nhân viên.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Loại báo cáo</label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn loại" />
                </SelectTrigger>
                <SelectContent className="max-h-[320px]">
                  {HR_REPORT_GROUPS.map(({ group, items }) => (
                    <SelectGroup key={group}>
                      <SelectLabel>{group}</SelectLabel>
                      {items.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!reportFile ? (
            <div
              className="upload-zone min-h-[160px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleReportDrop}
            >
              <input
                ref={reportExcelInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleReportFileChange}
                className="hidden"
                id="file-report-excel"
              />
              <label htmlFor="file-report-excel" className="cursor-pointer block text-center py-6">
                <FileSpreadsheet className="w-10 h-10 mx-auto text-amber-600/80 mb-3" />
                <p className="font-medium">Chọn hoặc kéo thả file Excel báo cáo</p>
                <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls — khớp với loại báo cáo đã chọn</p>
              </label>
            </div>
          ) : (
            <div className="rounded-lg border border-border p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-amber-600" />
                <div>
                  <p className="font-medium">{reportFile.name}</p>
                  <p className="text-sm text-muted-foreground">{formatFileSize(reportFile.size)}</p>
                </div>
                {reportFile.status === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
                {reportFile.status === 'error' && <AlertCircle className="w-5 h-5 text-destructive" />}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReportFile(null);
                    setReportExcelFile(null);
                    if (reportExcelInputRef.current) reportExcelInputRef.current.value = '';
                  }}
                >
                  Chọn file khác
                </Button>
                {reportFile.status === 'pending' && (
                  <Button
                    disabled={uploadReportExcelMutation.isPending || !reportExcelFile}
                    onClick={() => reportExcelFile && uploadReportExcelMutation.mutate({ file: reportExcelFile, rt: reportType })}
                  >
                    {uploadReportExcelMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Đang tải…
                      </>
                    ) : (
                      'Tải lên báo cáo'
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}

          {reportFile && reportFile.status === 'pending' && !reportExcelFile && (
            <p className="text-sm text-destructive">Chưa chọn file.</p>
          )}

          <p className="text-xs text-muted-foreground">
            Sau khi upload thành công: vào <Link to="/" className="underline text-primary">Trang chủ</Link> — các ô báo
            cáo từ Excel sẽ lấy file mới nhất theo từng loại. Một số mục menu Nhân sự cũng đọc đúng loại tương ứng.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default UploadPage;

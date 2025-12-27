import { useState, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { uploadAPI } from '@/services/api';
import { useI18n } from '@/contexts/I18nContext';

interface UploadedFile {
  name: string;
  size: number;
  status: 'pending' | 'success' | 'error';
}

const UploadPage = () => {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const employeeFileInputRef = useRef<HTMLInputElement>(null);
  const timekeepingFileInputRef = useRef<HTMLInputElement>(null);
  const [employeeFile, setEmployeeFile] = useState<UploadedFile | null>(null);
  const [timekeepingFile, setTimekeepingFile] = useState<UploadedFile | null>(null);
  const [previewData, setPreviewData] = useState<Array<Record<string, string>>>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrop = useCallback((e: React.DragEvent, type: 'employee' | 'timekeeping') => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      const uploadedFile: UploadedFile = {
        name: file.name,
        size: file.size,
        status: 'pending',
      };
      
      if (type === 'employee') {
        setEmployeeFile(uploadedFile);
      } else {
        setTimekeepingFile(uploadedFile);
      }
      setSelectedFile(file);
      setPreviewData([]); // Clear preview, will be shown after upload
    } else {
      toast({
        title: t('common.error'),
        description: t('upload.invalidFile'),
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'employee' | 'timekeeping') => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      const uploadedFile: UploadedFile = {
        name: file.name,
        size: file.size,
        status: 'pending',
      };
      
      if (type === 'employee') {
        setEmployeeFile(uploadedFile);
      } else {
        setTimekeepingFile(uploadedFile);
      }
      setSelectedFile(file);
      setPreviewData([]); // Clear preview
    }
  }, []);

  // Upload mutations
  const uploadEmployeeMutation = useMutation({
    mutationFn: (file: File) => uploadAPI.uploadEmployees(file),
    onSuccess: (data) => {
      if (employeeFile) {
        setEmployeeFile({ ...employeeFile, status: 'success' });
      }
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'employees' });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'statistics' });
      // Invalidate và refetch notifications ngay lập tức
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.refetchQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      queryClient.refetchQueries({ queryKey: ['notifications', 'unread-count'] });
      
      let description = t('upload.uploadSuccessMessage', { 
        count: data.count || 0, 
        totalRows: data.totalRows || 0 
      });
      if (data.skippedRows > 0) {
        description += t('upload.uploadSuccessSkipped', { skippedRows: data.skippedRows });
        if (data.skippedReasons && data.skippedReasons.length > 0) {
          console.warn('Skipped reasons:', data.skippedReasons);
        }
      }
      
      toast({
        title: data.count > 0 ? t('common.success') : t('common.warning') || 'Cảnh báo',
        description,
        variant: data.count === 0 ? 'destructive' : 'default',
      });
      setSelectedFile(null);
      if (employeeFileInputRef.current) employeeFileInputRef.current.value = '';
    },
    onError: (error: any) => {
      if (employeeFile) {
        setEmployeeFile({ ...employeeFile, status: 'error' });
      }
      toast({
        title: t('common.error'),
        description: error.message || t('upload.uploadError'),
        variant: 'destructive',
      });
    },
  });

  const uploadTimekeepingMutation = useMutation({
    mutationFn: (file: File) => uploadAPI.uploadTimekeeping(file),
    onSuccess: (data) => {
      if (timekeepingFile) {
        setTimekeepingFile({ ...timekeepingFile, status: 'success' });
      }
      queryClient.invalidateQueries({ queryKey: ['timekeeping'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'timekeeping' });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'dashboard' });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'statistics' });
      // Invalidate và refetch notifications ngay lập tức
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.refetchQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      queryClient.refetchQueries({ queryKey: ['notifications', 'unread-count'] });
      let description = t('upload.timekeepingUploadSuccessMessage', { 
        count: data.count || 0, 
        totalRows: data.totalRows || 0 
      });
      description += t('upload.timekeepingUploadNote');
      
      toast({
        title: t('common.success'),
        description,
        duration: 8000, // Hiển thị lâu hơn để user đọc được
      });
      setSelectedFile(null);
      if (timekeepingFileInputRef.current) timekeepingFileInputRef.current.value = '';
    },
    onError: (error: any) => {
      if (timekeepingFile) {
        setTimekeepingFile({ ...timekeepingFile, status: 'error' });
      }
      toast({
        title: t('common.error'),
        description: error.message || t('upload.uploadError'),
        variant: 'destructive',
      });
    },
  });

  const handleUpload = async (type: 'employee' | 'timekeeping') => {
    const file = selectedFile || (type === 'employee' ? employeeFileInputRef.current?.files?.[0] : timekeepingFileInputRef.current?.files?.[0]);
    
    if (!file) {
    toast({
        title: t('common.error'),
        description: t('upload.selectFileFirst'),
        variant: 'destructive',
      });
      return;
    }
    
    if (type === 'employee') {
      uploadEmployeeMutation.mutate(file);
    } else {
      uploadTimekeepingMutation.mutate(file);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const UploadZone = ({ type, file, setFile }: { 
    type: 'employee' | 'timekeeping'; 
    file: UploadedFile | null; 
    setFile: (file: UploadedFile | null) => void;
  }) => (
    <div className="space-y-4">
      {!file ? (
        <div
          className="upload-zone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, type)}
        >
          <input
            ref={type === 'employee' ? employeeFileInputRef : timekeepingFileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => handleFileChange(e, type)}
            className="hidden"
            id={`file-${type}`}
          />
          <label htmlFor={`file-${type}`} className="cursor-pointer">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground mb-1">
              {t('upload.selectFile')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('upload.fileFormat')}
            </p>
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

      {/* Preview Table */}
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
        <Button 
          onClick={() => handleUpload(type)} 
          disabled={type === 'employee' ? uploadEmployeeMutation.isPending : uploadTimekeepingMutation.isPending}
          className="w-full"
        >
          {(type === 'employee' ? uploadEmployeeMutation.isPending : uploadTimekeepingMutation.isPending) ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('upload.uploading')}
            </>
          ) : (
            t('upload.upload')
          )}
        </Button>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        title={t('upload.title')}
        description={t('upload.description')}
        breadcrumbs={[{ label: t('upload.title') }]}
      />

      <Tabs defaultValue="employee" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="employee">{t('upload.employees')}</TabsTrigger>
          <TabsTrigger value="timekeeping">{t('upload.timekeeping')}</TabsTrigger>
        </TabsList>

        <TabsContent value="employee">
          <div className="chart-container">
            <h3 className="text-lg font-semibold mb-4">{t('upload.uploadEmployeeFile')}</h3>
            <p className="text-muted-foreground mb-6">
              {t('upload.employeeFileUploadDescription')}
            </p>
            <UploadZone 
              type="employee" 
              file={employeeFile} 
              setFile={setEmployeeFile} 
            />
          </div>
        </TabsContent>

        <TabsContent value="timekeeping">
          <div className="chart-container">
            <h3 className="text-lg font-semibold mb-4">{t('upload.uploadTimekeepingFile')}</h3>
            <p className="text-muted-foreground mb-6">
              {t('upload.timekeepingFileUploadDescription')}
            </p>
            <UploadZone 
              type="timekeeping" 
              file={timekeepingFile} 
              setFile={setTimekeepingFile} 
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UploadPage;

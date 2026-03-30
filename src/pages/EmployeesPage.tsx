import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Download, X, Loader2, Eye, AlertTriangle, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { employeesAPI, uploadAPI } from '@/services/api';
import { Employee, FamilyMember } from '@/data/mockData';
import { useI18n } from '@/hooks/useI18n';

function stripVi(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function excelCellStr(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'object' && v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
  return String(v).trim();
}

/** Cột mã NV (file chính thức / thời vụ có header khác nhau) */
function isLikelyEmployeeCodeColumn(header: string): boolean {
  const x = stripVi(header);
  if (/\bma\s*nv\b/.test(x)) return true;
  if (x.includes('ma nhan vien')) return true;
  return false;
}

function isLikelyEmployeeNameColumn(header: string): boolean {
  const x = stripVi(header);
  if (x.includes('ho') && x.includes('ten')) return true;
  return false;
}

/** Lọc dòng Excel theo mã và/hoặc họ tên (không phân biệt hoa thường, bỏ dấu) */
function filterExcelEmployeeRows(
  rows: Record<string, unknown>[],
  headers: string[],
  codeQuery: string,
  nameQuery: string,
): Record<string, unknown>[] {
  const cq = stripVi(codeQuery);
  const nq = stripVi(nameQuery);
  if (!cq && !nq) return rows;

  const codeCols = headers.filter((h) => h && isLikelyEmployeeCodeColumn(h));
  const nameCols = headers.filter((h) => h && isLikelyEmployeeNameColumn(h));

  return rows.filter((row) => {
    if (cq) {
      const fromCodeCols = codeCols.map((h) => stripVi(excelCellStr(row[h]))).join('\u0000');
      const haystack =
        codeCols.length > 0
          ? fromCodeCols
          : headers.map((h) => stripVi(excelCellStr(row[h]))).join('\u0000');
      if (!haystack.includes(cq)) return false;
    }
    if (nq) {
      const fromNameCols = nameCols.map((h) => stripVi(excelCellStr(row[h]))).join('\u0000');
      const haystack =
        nameCols.length > 0
          ? fromNameCols
          : headers.map((h) => stripVi(excelCellStr(row[h]))).join('\u0000');
      if (!haystack.includes(nq)) return false;
    }
    return true;
  });
}

const EmployeesPage = () => {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const EXCEL_PAGE_SIZE = 200;
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [debouncedSearchFilter, setDebouncedSearchFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'list' | 'official' | 'seasonal'>('list');
  const [officialPage, setOfficialPage] = useState(1);
  const [seasonalPage, setSeasonalPage] = useState(1);
  const [excelCodeSearch, setExcelCodeSearch] = useState('');
  const [excelNameSearch, setExcelNameSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [isAvatarCropOpen, setIsAvatarCropOpen] = useState(false);
  const [avatarCropSrc, setAvatarCropSrc] = useState<string>('');
  const [avatarCropZoom, setAvatarCropZoom] = useState(1);
  const [avatarCropOffsetX, setAvatarCropOffsetX] = useState(0);
  const [avatarCropOffsetY, setAvatarCropOffsetY] = useState(0);

  // Auto-open form if route is /employees/new
  useEffect(() => {
    if (location.pathname === '/employees/new') {
      // Reset form and open dialog
      setEditingEmployee(null);
      setFormData({
        employee_code: '',
        name: '',
        gender: 'Nam',
        date_of_birth: '',
        department: '',
        employment_type: 'Chính thức',
        cccd: '',
        hometown: '',
        permanent_residence: '',
        temporary_residence: '',
        marital_status: 'Độc thân',
        family_relations: [],
        phone: '',
        avatar: '',
      });
      setFamilyMemberForm({ relation: '', name: '', occupation: '' });
      setIsFormOpen(true);
      // Navigate back to /employees to avoid blank page
      navigate('/employees', { replace: true });
    }
  }, [location.pathname, navigate]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchFilter(searchFilter);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchFilter]);

  // Fetch employees from API
  const { data: employees = [], isLoading, error } = useQuery({
    queryKey: ['employees', { department: departmentFilter, search: debouncedSearchFilter }],
    queryFn: () => employeesAPI.getAll({ 
      department: departmentFilter !== 'all' ? departmentFilter : undefined,
      search: debouncedSearchFilter.trim() || undefined,
    }),
    staleTime: 30_000,
  });

  // Raw Excel data for display (y hệt form Excel)
  const { data: officialData, isLoading: loadingOfficial } = useQuery({
    queryKey: ['employees', 'official'],
    queryFn: () => employeesAPI.getOfficial(),
    enabled: activeTab === 'official',
    staleTime: 5 * 60_000,
  });
  const { data: seasonalData, isLoading: loadingSeasonal } = useQuery({
    queryKey: ['employees', 'seasonal'],
    queryFn: () => employeesAPI.getSeasonal(),
    enabled: activeTab === 'seasonal',
    staleTime: 5 * 60_000,
  });
  const officialHeaders = officialData?.headers ?? [];
  const officialRows = officialData?.rows ?? [];
  const seasonalHeaders = seasonalData?.headers ?? [];
  const seasonalRows = seasonalData?.rows ?? [];

  const filteredOfficialRows = useMemo(
    () => filterExcelEmployeeRows(officialRows, officialHeaders, excelCodeSearch, excelNameSearch),
    [officialRows, officialHeaders, excelCodeSearch, excelNameSearch],
  );
  const filteredSeasonalRows = useMemo(
    () => filterExcelEmployeeRows(seasonalRows, seasonalHeaders, excelCodeSearch, excelNameSearch),
    [seasonalRows, seasonalHeaders, excelCodeSearch, excelNameSearch],
  );

  useEffect(() => {
    setOfficialPage(1);
    setSeasonalPage(1);
  }, [excelCodeSearch, excelNameSearch]);

  // Transform data to match frontend format (convert family_members to family_relations)
  const transformedEmployees = useMemo(() => {
    return employees.map((emp: any) => ({
      ...emp,
      avatar: emp.avatar_url || emp.avatar,
      family_relations: emp.family_members || emp.family_relations || [],
    }));
  }, [employees]);

  // Get unique departments from employees
  const departments = useMemo(() => {
    const depts = new Set<string>();
    transformedEmployees.forEach((emp: Employee) => {
      if (emp.department) depts.add(emp.department);
    });
    return Array.from(depts);
  }, [transformedEmployees]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => employeesAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'employees' });
      // Invalidate và refetch notifications ngay lập tức
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.refetchQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      queryClient.refetchQueries({ queryKey: ['notifications', 'unread-count'] });
      toast({
        title: t('common.success'),
        description: t('employees.addSuccess'),
      });
      setIsFormOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('employees.addError'),
        variant: 'destructive',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => employeesAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'employees' });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'statistics' });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({
        title: t('common.success'),
        description: t('employees.updateSuccess'),
      });
      setIsFormOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('employees.updateError'),
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => employeesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'employees' });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'statistics' });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({
        title: t('common.success'),
        description: t('employees.deleteSuccess'),
      });
      setIsDeleteDialogOpen(false);
      setDeletingEmployee(null);
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('employees.deleteError'),
        variant: 'destructive',
      });
    },
  });
  
  // Delete all employees mutation
  const deleteAllEmployeesMutation = useMutation({
    mutationFn: () => employeesAPI.deleteAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'employees' });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'statistics' });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({
        title: t('common.success'),
        description: t('employees.deleteAllSuccess'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('employees.deleteAllError'),
        variant: 'destructive',
      });
    },
  });
  
  // Form state
  const [formData, setFormData] = useState({
    employee_code: '',
    name: '',
    gender: 'Nam' as 'Nam' | 'Nữ',
    date_of_birth: '',
    department: '',
    employment_type: 'Chính thức' as 'Chính thức' | 'Thời vụ',
    cccd: '',
    hometown: '',
    permanent_residence: '',
    temporary_residence: '',
    marital_status: 'Độc thân' as 'Độc thân' | 'Đã kết hôn' | 'Ly hôn' | 'Góa',
    family_relations: [] as FamilyMember[],
    phone: '',
    avatar: '',
  });
  
  // Family member form state
  const [familyMemberForm, setFamilyMemberForm] = useState({
    relation: '',
    name: '',
    occupation: '',
  });

  // Filter employees (API already filters, but we can do client-side filtering if needed)
  const filteredEmployees = transformedEmployees;

  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const openAddForm = () => {
    setEditingEmployee(null);
    setFormData({
      employee_code: '',
      name: '',
      gender: 'Nam',
      date_of_birth: '',
      department: '',
      employment_type: 'Chính thức',
      cccd: '',
      hometown: '',
      permanent_residence: '',
      temporary_residence: '',
      marital_status: 'Độc thân',
      family_relations: [],
      phone: '',
      avatar: '',
    });
    setFamilyMemberForm({ relation: '', name: '', occupation: '' });
    setIsFormOpen(true);
  };

  const openEditForm = (employee: Employee) => {
    setEditingEmployee(employee);
    
    // Convert date_of_birth to YYYY-MM-DD format for input type="date"
    let formattedDate = '';
    if (employee.date_of_birth) {
      try {
        // Try to parse the date - could be ISO string, DD/MM/YYYY, or other format
        let date: Date;
        if (typeof employee.date_of_birth === 'string') {
          // Check if it's DD/MM/YYYY format
          const ddmmyyyyMatch = employee.date_of_birth.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (ddmmyyyyMatch) {
            const [, day, month, year] = ddmmyyyyMatch;
            date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          } else {
            date = new Date(employee.date_of_birth);
          }
        } else {
          date = new Date(employee.date_of_birth);
        }
        
        if (!isNaN(date.getTime())) {
          // Format as YYYY-MM-DD for input type="date"
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          formattedDate = `${year}-${month}-${day}`;
        }
      } catch (error) {
        console.warn('Failed to parse date_of_birth:', employee.date_of_birth, error);
      }
    }
    
    setFormData({
      employee_code: employee.employee_code,
      name: employee.name,
      gender: employee.gender,
      date_of_birth: formattedDate,
      department: employee.department,
      employment_type: employee.employment_type,
      cccd: employee.cccd || '',
      hometown: employee.hometown || '',
      permanent_residence: employee.permanent_residence || '',
      temporary_residence: employee.temporary_residence || '',
      marital_status: employee.marital_status || 'Độc thân',
      family_relations: employee.family_relations || (employee as any).family_members || [],
      phone: employee.phone || '',
      avatar: employee.avatar || (employee as any).avatar_url || '',
    });
    setFamilyMemberForm({ relation: '', name: '', occupation: '' });
    setIsFormOpen(true);
  };
  
  const addFamilyMember = () => {
    if (familyMemberForm.relation && familyMemberForm.name && familyMemberForm.occupation) {
      setFormData(prev => ({
        ...prev,
        family_relations: [...prev.family_relations, { ...familyMemberForm }]
      }));
      setFamilyMemberForm({ relation: '', name: '', occupation: '' });
    }
  };
  
  const removeFamilyMember = (index: number) => {
    setFormData(prev => ({
      ...prev,
      family_relations: prev.family_relations.filter((_, i) => i !== index)
    }));
  };
  
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({
        title: t('common.error'),
        description: t('employees.avatarPickImage'),
        variant: 'destructive',
      });
      return;
    }
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast({
        title: t('common.error'),
        description: t('employees.avatarTooLarge'),
        variant: 'destructive',
      });
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = () => {
        setAvatarCropSrc(String(reader.result || ''));
        setAvatarCropZoom(1);
        setAvatarCropOffsetX(0);
        setAvatarCropOffsetY(0);
        setIsAvatarCropOpen(true);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast({
        title: t('common.error'),
        description: err?.message || t('employees.avatarReadError'),
        variant: 'destructive',
      });
    }
  };

  const handleConfirmAvatarCrop = async () => {
    if (!avatarCropSrc) return;
    setAvatarUploading(true);
    try {
      const img = new Image();
      img.src = avatarCropSrc;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(t('employees.avatarCropImageLoadError')));
      });

      const sourceSizeBase = Math.min(img.naturalWidth, img.naturalHeight);
      const sourceSize = Math.max(1, Math.round(sourceSizeBase / avatarCropZoom));
      const maxOffsetX = Math.max(0, (img.naturalWidth - sourceSize) / 2);
      const maxOffsetY = Math.max(0, (img.naturalHeight - sourceSize) / 2);
      const sx = Math.round(
        Math.min(
          Math.max(img.naturalWidth / 2 - sourceSize / 2 + (avatarCropOffsetX / 100) * maxOffsetX, 0),
          img.naturalWidth - sourceSize
        )
      );
      const sy = Math.round(
        Math.min(
          Math.max(img.naturalHeight / 2 - sourceSize / 2 + (avatarCropOffsetY / 100) * maxOffsetY, 0),
          img.naturalHeight - sourceSize
        )
      );

      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error(t('employees.avatarCanvasError'));
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sourceSize, sourceSize, 0, 0, 512, 512);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error(t('employees.avatarExportError')))),
          'image/jpeg',
          0.9
        );
      });
      const croppedFile = new File([blob], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const data = await uploadAPI.uploadAvatar(croppedFile);
      const url = data.avatar_url?.startsWith('http') ? data.avatar_url : data.avatar_url || '';
      setFormData((prev) => ({ ...prev, avatar: url }));
      setIsAvatarCropOpen(false);
      setAvatarCropSrc('');
      toast({
        title: t('common.success'),
        description: t('employees.avatarUploadSuccess'),
      });
    } catch (err: any) {
      toast({
        title: t('common.error'),
        description: err?.message || t('employees.avatarCropUploadError'),
        variant: 'destructive',
      });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!formData.employee_code || !formData.name || !formData.date_of_birth || !formData.department) {
      toast({
        title: t('common.error'),
        description: t('employees.fillRequiredFields'),
        variant: 'destructive',
      });
      return;
    }

    // Ensure date_of_birth is in YYYY-MM-DD format (input type="date" returns this format)
    let formattedDateOfBirth = formData.date_of_birth;
    if (formattedDateOfBirth) {
      // Input type="date" already returns YYYY-MM-DD, but ensure it's valid
      const dateMatch = formattedDateOfBirth.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!dateMatch) {
        // Try to parse and reformat if needed
        try {
          const date = new Date(formattedDateOfBirth);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            formattedDateOfBirth = `${year}-${month}-${day}`;
          }
        } catch (error) {
          console.warn('Failed to format date_of_birth:', formattedDateOfBirth, error);
        }
      }
    }

    // When editing, always send all fields (even if empty) to allow clearing/updating
    // When creating, only send required fields and optional fields if they have values
    const submitData: any = {
      employee_code: formData.employee_code,
      name: formData.name,
      gender: formData.gender,
      date_of_birth: formattedDateOfBirth,
      department: formData.department,
      employment_type: formData.employment_type,
    };

    if (editingEmployee) {
      // When editing: always send all fields, even if empty (to allow clearing)
      submitData.cccd = formData.cccd || null;
      submitData.hometown = formData.hometown || null;
      submitData.permanent_residence = formData.permanent_residence || null;
      submitData.temporary_residence = formData.temporary_residence || null;
      submitData.marital_status = formData.marital_status || null;
      submitData.phone = formData.phone || null;
      submitData.avatar_url = formData.avatar || null;
      submitData.family_relations = formData.family_relations; // Always send array (can be empty to clear all)
    } else {
      // When creating: only send optional fields if they have values
      if (formData.cccd) submitData.cccd = formData.cccd;
      if (formData.hometown) submitData.hometown = formData.hometown;
      if (formData.permanent_residence) submitData.permanent_residence = formData.permanent_residence;
      if (formData.temporary_residence) submitData.temporary_residence = formData.temporary_residence;
      if (formData.marital_status) submitData.marital_status = formData.marital_status;
      if (formData.phone) submitData.phone = formData.phone;
      if (formData.avatar) submitData.avatar_url = formData.avatar;
      if (formData.family_relations.length > 0) submitData.family_relations = formData.family_relations;
    }

    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = () => {
    if (deletingEmployee) {
      deleteMutation.mutate(deletingEmployee.id);
    }
  };

  // Export to Excel function
  const handleExportExcel = () => {
    try {
      // Define headers first
      const headers = [
        t('employees.stt'),
        t('employees.photo'),
        t('employees.employeeCode'),
        t('employees.name'),
        t('employees.gender'),
        t('employees.dateOfBirth'),
        t('employees.age'),
        t('employees.department'),
        t('employees.employmentType'),
        t('employees.cccd'),
        t('employees.phoneShort'),
        t('employees.hometown'),
        t('employees.permanentResidenceShort'),
        t('employees.temporaryResidenceShort'),
        t('employees.maritalStatus'),
        t('employees.familyRelations'),
      ];

      // Helper function to truncate text to Excel's max cell length (32767 characters)
      const truncateForExcel = (text: string, maxLength: number = 32767): string => {
        if (!text) return '';
        const str = String(text);
        return str.length > maxLength ? str.substring(0, maxLength) : str;
      };

      // Prepare data for export - always export, even if empty
      const exportData = filteredEmployees.length > 0 
        ? filteredEmployees.map((emp, index) => ({
            [t('employees.stt')]: index + 1,
            [t('employees.photo')]: truncateForExcel(emp.avatar || (emp as any).avatar_url || ''),
            [t('employees.employeeCode')]: truncateForExcel(emp.employee_code),
            [t('employees.name')]: truncateForExcel(emp.name),
            [t('employees.gender')]: truncateForExcel(translateValue(emp.gender)),
            [t('employees.dateOfBirth')]: emp.date_of_birth 
              ? (() => {
                  try {
                    const date = new Date(emp.date_of_birth);
                    if (!isNaN(date.getTime())) {
                      const day = String(date.getDate()).padStart(2, '0');
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const year = date.getFullYear();
                      return `${day}/${month}/${year}`;
                    }
                  } catch {}
                  return truncateForExcel(emp.date_of_birth);
                })()
              : '',
            [t('employees.age')]: emp.age || 0,
            [t('employees.department')]: truncateForExcel(emp.department),
            [t('employees.employmentType')]: truncateForExcel(translateValue(emp.employment_type)),
            [t('employees.cccd')]: truncateForExcel(emp.cccd || ''),
            [t('employees.phoneShort')]: truncateForExcel(emp.phone || ''),
            [t('employees.hometown')]: truncateForExcel(emp.hometown || ''),
            [t('employees.permanentResidenceShort')]: truncateForExcel(emp.permanent_residence || ''),
            [t('employees.temporaryResidenceShort')]: truncateForExcel(emp.temporary_residence || ''),
            [t('employees.maritalStatus')]: truncateForExcel(translateValue(emp.marital_status || '')),
            [t('employees.familyRelations')]: emp.family_relations && emp.family_relations.length > 0 
              ? truncateForExcel(
                  emp.family_relations.map((f: FamilyMember) => 
                    `${f.relation}: ${f.name}${f.occupation ? ` (${f.occupation})` : ''}`
                  ).join('; ')
                )
              : '',
          }))
        : []; // Empty array if no data

      // Create workbook and worksheet
      // If no data, create worksheet with headers only
      let worksheet;
      if (exportData.length === 0) {
        // Create worksheet with headers only
        worksheet = XLSX.utils.aoa_to_sheet([headers]);
      } else {
        worksheet = XLSX.utils.json_to_sheet(exportData);
      }
      
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, t('employees.list'));

      // Set column widths - matching table columns order
      const columnWidths = [
        { wch: 5 },  // STT
        { wch: 15 }, // Ảnh (URL)
        { wch: 12 }, // Mã NV
        { wch: 25 }, // Tên nhân viên
        { wch: 10 }, // Giới tính
        { wch: 12 }, // Ngày sinh
        { wch: 5 },  // Tuổi
        { wch: 15 }, // Phòng ban
        { wch: 15 }, // Loại hợp đồng
        { wch: 15 }, // CCCD
        { wch: 12 }, // SĐT
        { wch: 20 }, // Quê quán
        { wch: 25 }, // Thường trú
        { wch: 25 }, // Tạm trú
        { wch: 18 }, // Tình trạng hôn nhân
        { wch: 40 }, // Quan hệ gia đình
      ];
      worksheet['!cols'] = columnWidths;

      // Generate filename with current date
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const filename = `Danh_sach_nhan_vien_${today}.xlsx`;

      // Write file
      XLSX.writeFile(workbook, filename);

      toast({
        title: 'Thành công',
        description: filteredEmployees.length > 0 
          ? `Đã xuất ${filteredEmployees.length} nhân viên ra file Excel`
          : 'Đã xuất file Excel (không có dữ liệu)',
      });
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Có lỗi xảy ra khi xuất file Excel',
        variant: 'destructive',
      });
    }
  };

  // Helper function to translate values
  const translateValue = (value: string): string => {
    const translations: Record<string, string> = {
      'Nam': t('employees.male'),
      'Nữ': t('employees.female'),
      'Chính thức': t('employees.official'),
      'Thời vụ': t('employees.seasonal'),
      'Độc thân': t('employees.single'),
      'Đã kết hôn': t('employees.married'),
      'Đã có gia đình': t('employees.marriedWithFamily'),
      'Ly hôn': t('employees.divorced'),
      'Góa': t('employees.widowed'),
    };
    return translations[value] || value;
  };

  const columns = [
    { 
      key: 'id' as const, 
      header: t('employees.stt'), 
      sortable: false,
      render: (_: Employee, index?: number) => {
        // STT should be 1-based index from the current page
        return index !== undefined ? index + 1 : '';
      }
    },
    { 
      key: 'avatar' as const, 
      header: t('employees.photo'),
      render: (emp: Employee) => (
        emp.avatar ? (
          <img src={emp.avatar} alt={emp.name} className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs">
            {emp.name.charAt(0)}
          </div>
        )
      )
    },
    { key: 'employee_code' as const, header: t('employees.employeeCode'), sortable: true },
    { key: 'name' as const, header: t('employees.name'), sortable: true },
    { 
      key: 'gender' as const, 
      header: t('employees.gender'),
      render: (emp: Employee) => (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
          emp.gender === 'Nam' ? 'bg-primary/10 text-primary' : 'bg-pink-100 text-pink-700'
        }`}>
          {translateValue(emp.gender)}
        </span>
      )
    },
    { 
      key: 'date_of_birth' as const, 
      header: t('employees.dateOfBirth'), 
      sortable: true,
      render: (emp: Employee) => {
        if (!emp.date_of_birth) return '-';
        try {
          const date = new Date(emp.date_of_birth);
          if (isNaN(date.getTime())) return emp.date_of_birth;
          // Format as DD/MM/YYYY
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          return `${day}/${month}/${year}`;
        } catch {
          return emp.date_of_birth;
        }
      }
    },
    { key: 'age' as const, header: t('employees.age'), sortable: true },
    { key: 'department' as const, header: t('employees.department'), sortable: true },
    { 
      key: 'employment_type' as const, 
      header: t('employees.employmentType'),
      render: (emp: Employee) => (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
          emp.employment_type === 'Chính thức' 
            ? 'bg-green-100 text-green-700' 
            : 'bg-orange-100 text-orange-700'
        }`}>
          {translateValue(emp.employment_type)}
        </span>
      )
    },
    {
      key: 'phone' as const,
      header: t('employees.phoneShort'),
      render: (emp: Employee) => emp.phone || '-',
    },
    {
      key: 'actions',
      header: t('employees.actions'),
      render: (emp: Employee) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setViewingEmployee(emp);
              setIsViewDialogOpen(true);
            }}
            title={t('employees.view')}
          >
            <Eye className="w-4 h-4 text-blue-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEditForm(emp)}
            title={t('employees.edit')}
          >
            <Pencil className="w-4 h-4 text-primary" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setDeletingEmployee(emp);
              setIsDeleteDialogOpen(true);
            }}
            title={t('employees.delete')}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const ExcelTable = ({
    headers,
    rows,
    loading,
    page,
    onPageChange,
  }: {
    headers: string[];
    rows: Record<string, unknown>[];
    loading: boolean;
    page: number;
    onPageChange: (page: number) => void;
  }) => {
    const displayHeaders = headers.filter(Boolean);
    const totalPages = Math.max(1, Math.ceil(rows.length / EXCEL_PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * EXCEL_PAGE_SIZE;
    const visibleRows = rows.slice(start, start + EXCEL_PAGE_SIZE);

    useEffect(() => {
      if (page > totalPages) {
        onPageChange(totalPages);
      }
    }, [page, totalPages, onPageChange]);

    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }
    if (displayHeaders.length === 0 && rows.length === 0) {
      return (
        <p className="text-muted-foreground py-8 text-center">
          {t('employees.excelTabEmpty')}
        </p>
      );
    }
    return (
      <div className="rounded-lg border border-border overflow-auto max-h-[calc(100vh-260px)]">
        <table className="w-full border-collapse text-sm data-table min-w-max">
          <thead className="sticky top-0 z-10 bg-muted/50">
            <tr>
              {displayHeaders.map((h, i) => (
                <th key={i} className="border border-border px-3 py-2 text-left font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rIdx) => (
              <tr key={start + rIdx} className="hover:bg-muted/30">
                {displayHeaders.map((h, i) => (
                  <td key={i} className="border border-border px-3 py-2">
                    {row[h] != null && row[h] !== '' ? (
                      typeof row[h] === 'object' && row[h] instanceof Date
                        ? row[h].toISOString().slice(0, 10)
                        : String(row[h])
                    ) : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > EXCEL_PAGE_SIZE && (
          <div className="sticky bottom-0 z-20 border-t border-border bg-background px-3 py-2 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Hiển thị {start + 1}-{Math.min(start + EXCEL_PAGE_SIZE, rows.length)} / {rows.length} dòng
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
              >
                Trước
              </Button>
              <span className="text-xs text-muted-foreground">
                {currentPage}/{totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
              >
                Sau
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const excelEmployeeSearchToolbar = (
    <div className="rounded-md border border-border bg-card/50 p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="w-full md:w-64">
          <Label className="text-xs text-muted-foreground">{t('employees.excelSearchCode')}</Label>
          <Input
            className="h-9 mt-1"
            value={excelCodeSearch}
            onChange={(e) => setExcelCodeSearch(e.target.value)}
            placeholder={t('employees.excelSearchCodePlaceholder')}
          />
        </div>
        <div className="w-full md:flex-1">
          <Label className="text-xs text-muted-foreground">{t('employees.excelSearchName')}</Label>
          <Input
            className="h-9 mt-1"
            value={excelNameSearch}
            onChange={(e) => setExcelNameSearch(e.target.value)}
            placeholder={t('employees.excelSearchNamePlaceholder')}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={t('employees.title')}
        description={t('employees.description')}
        breadcrumbs={[{ label: t('employees.title') }]}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportExcel}>
              <Download className="w-4 h-4 mr-2" />
              {t('employees.exportExcel')}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={isLoading || transformedEmployees.length === 0 || deleteAllEmployeesMutation.isPending}
                >
                  {deleteAllEmployeesMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('employees.deleting')}
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t('employees.deleteAll')}
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    {t('employees.deleteAllConfirm')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('employees.deleteAllDescription')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => deleteAllEmployeesMutation.mutate()}
                  >
                    Tôi hiểu, xóa tất cả
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'list' | 'official' | 'seasonal')} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="list">Danh sách chung</TabsTrigger>
          <TabsTrigger value="official">Nhân viên chính thức (y hệt Excel)</TabsTrigger>
          <TabsTrigger value="seasonal">Nhân viên thời vụ (y hệt Excel)</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* Filters */}
          <div className="mb-4 rounded-md border border-border bg-card/50 p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="w-full md:w-64">
                <Label className="text-xs text-muted-foreground">{t('employees.department')}</Label>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t('employees.selectDepartment')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('employees.all')}</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:flex-1">
                <Label className="text-xs text-muted-foreground">Tìm kiếm nhân viên</Label>
                <Input
                  className="h-9"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Nhập mã hoặc tên nhân viên"
                />
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
                <p className="text-destructive mb-2">{t('employees.loadingError')}</p>
                <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
              </div>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <DataTable
                data={filteredEmployees}
                columns={columns}
                pageSize={25}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="official" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Dữ liệu từ file mẫu THÔNG TIN CNV TỔNG VINA. Hiển thị đúng cột và thứ tự như Excel. Thanh cuộn ngang luôn nằm dưới vùng bảng, kéo ngang để xem đủ cột.
          </p>
          {excelEmployeeSearchToolbar}
          {!loadingOfficial &&
            officialRows.length > 0 &&
            filteredOfficialRows.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('employees.excelSearchNoMatch')}</p>
            )}
          <ExcelTable
            headers={officialHeaders}
            rows={filteredOfficialRows}
            loading={loadingOfficial}
            page={officialPage}
            onPageChange={setOfficialPage}
          />
        </TabsContent>

        <TabsContent value="seasonal" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Dữ liệu từ file mẫu Thời vụ tổng 2024. Hiển thị đúng cột và thứ tự như Excel. Thanh cuộn ngang luôn nằm dưới vùng bảng, kéo ngang để xem đủ cột.
          </p>
          {excelEmployeeSearchToolbar}
          {!loadingSeasonal &&
            seasonalRows.length > 0 &&
            filteredSeasonalRows.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('employees.excelSearchNoMatch')}</p>
            )}
          <ExcelTable
            headers={seasonalHeaders}
            rows={filteredSeasonalRows}
            loading={loadingSeasonal}
            page={seasonalPage}
            onPageChange={setSeasonalPage}
          />
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? t('employees.updateSuccess') : t('employees.addNew')}
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">{t('employees.workInfo')}</TabsTrigger>
              <TabsTrigger value="personal">{t('employees.personalInfo')}</TabsTrigger>
              <TabsTrigger value="family">{t('employees.familyInfo')}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee_code">{t('employees.employeeCodeLabel')} *</Label>
              <Input
                id="employee_code"
                value={formData.employee_code}
                onChange={(e) => setFormData(prev => ({ ...prev, employee_code: e.target.value }))}
                placeholder="VD: 23046559HG"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t('employees.nameLabel')} *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('employees.exampleName')}
                />
            </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('employees.gender')} *</Label>
              <RadioGroup
                value={formData.gender}
                onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value as 'Nam' | 'Nữ' }))}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Nam" id="male" />
                  <Label htmlFor="male" className="font-normal">{t('employees.male')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Nữ" id="female" />
                  <Label htmlFor="female" className="font-normal">{t('employees.female')}</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">{t('employees.dateOfBirth')} *</Label>
              <Input
                id="dob"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
              />
            </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department">{t('employees.department')} *</Label>
              <Select
                value={formData.department}
                onValueChange={(value) => setFormData(prev => ({ ...prev, department: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('employees.selectDepartment')} />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
                <div className="space-y-2">
                  <Label>{t('employees.employmentType')} *</Label>
                  <RadioGroup
                    value={formData.employment_type}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, employment_type: value as 'Chính thức' | 'Thời vụ' }))}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Chính thức" id="chinhthuc" />
                      <Label htmlFor="chinhthuc" className="font-normal">{t('employees.official')}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Thời vụ" id="thoivu" />
                      <Label htmlFor="thoivu" className="font-normal">{t('employees.seasonal')}</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t('employees.phoneLabel')}</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder={t('employees.examplePhone')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="avatar">{t('employees.avatar')}</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border bg-muted">
                    {formData.avatar ? (
                      <img src={formData.avatar} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        —
                      </div>
                    )}
                    {avatarUploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <input
                    ref={avatarFileInputRef}
                    id="avatar"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={handleAvatarUpload}
                    disabled={avatarUploading}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={avatarUploading}
                      onClick={() => avatarFileInputRef.current?.click()}
                    >
                      Chọn ảnh hồ sơ
                    </Button>
                    {formData.avatar ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={avatarUploading}
                        onClick={() => {
                          setAvatarCropSrc(formData.avatar);
                          setAvatarCropZoom(1);
                          setAvatarCropOffsetX(0);
                          setAvatarCropOffsetY(0);
                          setIsAvatarCropOpen(true);
                        }}
                      >
                        Chỉnh sửa/Crop ảnh
                      </Button>
                    ) : null}
                    {formData.avatar ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={avatarUploading}
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, avatar: '' }));
                          if (avatarFileInputRef.current) avatarFileInputRef.current.value = '';
                        }}
                      >
                        Xóa ảnh
                      </Button>
                    ) : null}
                  </div>
                  <p className="w-full text-xs text-muted-foreground">
                    JPG, PNG, WebP hoặc GIF — tối đa 10MB. Chọn ảnh để crop trước khi tải lên máy chủ.
                  </p>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="personal" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cccd">{t('employees.cccd')}</Label>
                  <Input
                    id="cccd"
                    value={formData.cccd}
                    onChange={(e) => setFormData(prev => ({ ...prev, cccd: e.target.value }))}
                    placeholder={t('employees.exampleCccd')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hometown">{t('employees.hometown')}</Label>
                  <Input
                    id="hometown"
                    value={formData.hometown}
                    onChange={(e) => setFormData(prev => ({ ...prev, hometown: e.target.value }))}
                    placeholder={t('employees.exampleHometown')}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="permanent_residence">{t('employees.permanentResidence')}</Label>
                <Textarea
                  id="permanent_residence"
                  value={formData.permanent_residence}
                  onChange={(e) => setFormData(prev => ({ ...prev, permanent_residence: e.target.value }))}
                  placeholder={t('employees.exampleAddress')}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="temporary_residence">{t('employees.temporaryResidence')}</Label>
                <Textarea
                  id="temporary_residence"
                  value={formData.temporary_residence}
                  onChange={(e) => setFormData(prev => ({ ...prev, temporary_residence: e.target.value }))}
                  placeholder={t('employees.exampleAddress')}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marital_status">{t('employees.maritalStatus')}</Label>
                <Select
                  value={formData.marital_status}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, marital_status: value as 'Độc thân' | 'Đã kết hôn' | 'Ly hôn' | 'Góa' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('employees.selectStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Độc thân">{t('employees.single')}</SelectItem>
                    <SelectItem value="Đã kết hôn">{t('employees.married')}</SelectItem>
                    <SelectItem value="Ly hôn">{t('employees.divorced')}</SelectItem>
                    <SelectItem value="Góa">{t('employees.widowed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
            
            <TabsContent value="family" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>{t('employees.familyRelationsLabel')}</Label>
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="family_relation">{t('employees.relation')}</Label>
                      <Input
                        id="family_relation"
                        value={familyMemberForm.relation}
                        onChange={(e) => setFamilyMemberForm(prev => ({ ...prev, relation: e.target.value }))}
                        placeholder={t('employees.exampleRelation')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="family_name">{t('employees.fullName')}</Label>
                      <Input
                        id="family_name"
                        value={familyMemberForm.name}
                        onChange={(e) => setFamilyMemberForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder={t('employees.exampleFamilyName')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="family_occupation">{t('employees.occupation')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="family_occupation"
                          value={familyMemberForm.occupation}
                          onChange={(e) => setFamilyMemberForm(prev => ({ ...prev, occupation: e.target.value }))}
                          placeholder={t('employees.exampleOccupation')}
                        />
                        <Button type="button" onClick={addFamilyMember} size="sm">{t('employees.add')}</Button>
                      </div>
                    </div>
                  </div>
                  {formData.family_relations.length > 0 && (
                    <div className="space-y-2">
                      <Label>{t('employees.familyMemberList')}</Label>
                      <div className="space-y-2">
                        {formData.family_relations.map((member, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                            <span className="text-sm">
                              <strong>{member.relation}</strong>: {member.name} - {member.occupation}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFamilyMember(index)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
            </div>
          </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('employees.processing')}
                </>
              ) : (
                editingEmployee ? t('employees.update') : t('employees.addNew')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Avatar Crop Dialog */}
      <Dialog open={isAvatarCropOpen} onOpenChange={setIsAvatarCropOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Cắt ảnh hồ sơ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="mx-auto h-72 w-72 overflow-hidden rounded-xl border bg-muted">
              {avatarCropSrc ? (
                <img
                  src={avatarCropSrc}
                  alt="Crop preview"
                  className="h-full w-full object-cover"
                  style={{
                    transform: `translate(${avatarCropOffsetX}%, ${avatarCropOffsetY}%) scale(${avatarCropZoom})`,
                    transformOrigin: 'center',
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                  Chưa có ảnh
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Phóng to/thu nhỏ</Label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={avatarCropZoom}
                  onChange={(e) => setAvatarCropZoom(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <Label>Dịch trái/phải</Label>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={avatarCropOffsetX}
                  onChange={(e) => setAvatarCropOffsetX(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <Label>Dịch lên/xuống</Label>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={avatarCropOffsetY}
                  onChange={(e) => setAvatarCropOffsetY(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Khung crop là ảnh vuông 1:1, phù hợp cho avatar hiển thị tròn trong danh sách.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAvatarCropOpen(false);
                setAvatarCropSrc('');
              }}
              disabled={avatarUploading}
            >
              Hủy
            </Button>
            <Button onClick={handleConfirmAvatarCrop} disabled={avatarUploading || !avatarCropSrc}>
              {avatarUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                'Lưu ảnh đã crop'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible print:border-0 print:shadow-none">
          <DialogHeader className="print:hidden">
            <DialogTitle>Hồ sơ nhân sự</DialogTitle>
          </DialogHeader>
          {viewingEmployee && (
            <div id="employee-cv-print-root" className="space-y-5">
              {/* CV Header */}
              <div className="rounded-xl border bg-gradient-to-r from-primary/5 to-background p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    {viewingEmployee.avatar ? (
                      <img
                        src={viewingEmployee.avatar}
                        alt={viewingEmployee.name}
                        className="w-20 h-20 rounded-xl object-cover border"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center text-2xl font-semibold text-muted-foreground">
                        {viewingEmployee.name?.charAt(0) || '?'}
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="text-2xl font-semibold leading-tight">{viewingEmployee.name}</p>
                      <p className="text-sm text-muted-foreground">{viewingEmployee.employee_code}</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          viewingEmployee.employment_type === 'Chính thức'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {translateValue(viewingEmployee.employment_type)}
                        </span>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          viewingEmployee.gender === 'Nam' ? 'bg-primary/10 text-primary' : 'bg-pink-100 text-pink-700'
                        }`}>
                          {translateValue(viewingEmployee.gender)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t('employees.department')}</p>
                      <p className="font-medium">{viewingEmployee.department || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('employees.phoneShort')}</p>
                      <p className="font-medium">{viewingEmployee.phone || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('employees.dateOfBirth')}</p>
                      <p className="font-medium">
                        {viewingEmployee.date_of_birth
                          ? (() => {
                              try {
                                const date = new Date(viewingEmployee.date_of_birth);
                                if (!isNaN(date.getTime())) {
                                  const day = String(date.getDate()).padStart(2, '0');
                                  const month = String(date.getMonth() + 1).padStart(2, '0');
                                  const year = date.getFullYear();
                                  return `${day}/${month}/${year}`;
                                }
                              } catch {}
                              return viewingEmployee.date_of_birth;
                            })()
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('employees.age')}</p>
                      <p className="font-medium">{viewingEmployee.age || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* CV Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-lg border p-4 space-y-3">
                  <h3 className="text-base font-semibold">{t('employees.workInfo')}</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t('employees.employeeCodeLabel')}</p>
                      <p className="font-medium">{viewingEmployee.employee_code}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('employees.nameLabel')}</p>
                      <p className="font-medium">{viewingEmployee.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('employees.gender')}</p>
                      <p className="font-medium">{translateValue(viewingEmployee.gender)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('employees.employmentType')}</p>
                      <p className="font-medium">{translateValue(viewingEmployee.employment_type)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">{t('employees.department')}</p>
                      <p className="font-medium">{viewingEmployee.department || '-'}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <h3 className="text-base font-semibold">{t('employees.personalInfo')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t('employees.cccd')}</p>
                      <p className="font-medium">{viewingEmployee.cccd || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('employees.phoneShort')}</p>
                      <p className="font-medium">{viewingEmployee.phone || '-'}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-muted-foreground">{t('employees.hometown')}</p>
                      <p className="font-medium">{viewingEmployee.hometown || '-'}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-muted-foreground">{t('employees.permanentResidenceShort')}</p>
                      <p className="font-medium">{viewingEmployee.permanent_residence || '-'}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-muted-foreground">{t('employees.temporaryResidenceShort')}</p>
                      <p className="font-medium">{viewingEmployee.temporary_residence || '-'}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-muted-foreground">{t('employees.maritalStatus')}</p>
                      <p className="font-medium">{translateValue(viewingEmployee.marital_status || '-')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Family Relations */}
              <div className="rounded-lg border p-4">
                <h3 className="text-base font-semibold mb-3">{t('employees.familyRelations')}</h3>
                {viewingEmployee.family_relations && viewingEmployee.family_relations.length > 0 ? (
                  <div className="space-y-2">
                    {viewingEmployee.family_relations.map((member: FamilyMember, index: number) => (
                      <div key={index} className="p-3 bg-muted/60 rounded-lg border border-border">
                        <p className="font-medium">{member.relation}: {member.name}</p>
                        {member.occupation && (
                          <p className="text-sm text-muted-foreground">Nghề nghiệp: {member.occupation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Không có thông tin</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="print:hidden gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Đóng
            </Button>
            {viewingEmployee && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const prevTitle = document.title;
                    document.title = `Hồ sơ — ${viewingEmployee.name || viewingEmployee.employee_code}`;
                    let restored = false;
                    const restore = () => {
                      if (restored) return;
                      restored = true;
                      document.title = prevTitle;
                    };
                    window.addEventListener('afterprint', restore, { once: true });
                    window.print();
                    window.setTimeout(restore, 3000);
                  }}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  In hồ sơ
                </Button>
                <Button
                  onClick={() => {
                    setIsViewDialogOpen(false);
                    openEditForm(viewingEmployee);
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Sửa thông tin
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa nhân viên "{deletingEmployee?.name}"? 
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Hủy</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Đang xóa...
                </>
              ) : (
                'Xóa'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EmployeesPage;

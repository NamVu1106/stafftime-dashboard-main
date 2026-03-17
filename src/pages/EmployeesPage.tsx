import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Download, X, Loader2, Eye, AlertTriangle, Filter } from 'lucide-react';
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
import { employeesAPI } from '@/services/api';
import { Employee, FamilyMember } from '@/data/mockData';
import { useI18n } from '@/contexts/I18nContext';

const EmployeesPage = () => {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  
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

  // Fetch employees from API
  const { data: employees = [], isLoading, error } = useQuery({
    queryKey: ['employees', { department: departmentFilter }],
    queryFn: () => employeesAPI.getAll({ 
      department: departmentFilter !== 'all' ? departmentFilter : undefined 
    }),
  });

  // Raw Excel data for display (y hệt form Excel)
  const { data: officialData, isLoading: loadingOfficial } = useQuery({
    queryKey: ['employees', 'official'],
    queryFn: () => employeesAPI.getOfficial(),
  });
  const { data: seasonalData, isLoading: loadingSeasonal } = useQuery({
    queryKey: ['employees', 'seasonal'],
    queryFn: () => employeesAPI.getSeasonal(),
  });
  const officialHeaders = officialData?.headers ?? [];
  const officialRows = officialData?.rows ?? [];
  const seasonalHeaders = seasonalData?.headers ?? [];
  const seasonalRows = seasonalData?.rows ?? [];

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
  
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Tạo URL tạm thời cho preview (trong thực tế sẽ upload lên server)
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (!formData.employee_code || !formData.name || !formData.date_of_birth || !formData.department) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng điền đầy đủ thông tin bắt buộc',
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
      key: 'cccd' as const, 
      header: t('employees.cccd'),
      render: (emp: Employee) => emp.cccd || '-'
    },
    { 
      key: 'phone' as const, 
      header: t('employees.phoneShort'),
      render: (emp: Employee) => emp.phone || '-'
    },
    { 
      key: 'hometown' as const, 
      header: t('employees.hometown'),
      render: (emp: Employee) => (
        <div className="max-w-md whitespace-normal break-words">
          {emp.hometown || '-'}
        </div>
      )
    },
    { 
      key: 'permanent_residence' as const, 
      header: t('employees.permanentResidenceShort'),
      render: (emp: Employee) => (
        <div className="max-w-md whitespace-normal break-words" title={emp.permanent_residence || ''}>
          {emp.permanent_residence || '-'}
        </div>
      )
    },
    { 
      key: 'temporary_residence' as const, 
      header: t('employees.temporaryResidenceShort'),
      render: (emp: Employee) => (
        <div className="max-w-md whitespace-normal break-words" title={emp.temporary_residence || ''}>
          {emp.temporary_residence || '-'}
        </div>
      )
    },
    { 
      key: 'marital_status' as const, 
      header: t('employees.maritalStatus'),
      render: (emp: Employee) => translateValue(emp.marital_status || '-')
    },
    { 
      key: 'family_relations' as const, 
      header: t('employees.familyRelations'),
      render: (emp: Employee) => {
        const familyRelations = emp.family_relations || (emp as any).family_members || [];
        if (familyRelations.length === 0) return '-';
        const relationsText = familyRelations.map((f: FamilyMember) => `${f.relation}: ${f.name}${f.occupation ? ` (${f.occupation})` : ''}`).join('; ');
        return (
          <div className="max-w-md whitespace-normal break-words" title={relationsText}>
            {relationsText}
          </div>
        );
      }
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

  const ExcelTable = ({ headers, rows, loading }: { headers: string[]; rows: Record<string, any>[]; loading: boolean }) => {
    const displayHeaders = headers.filter(Boolean);
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
          Chưa có dữ liệu. Vui lòng upload file Excel tại trang Upload Data (Nhân viên chính thức / Nhân viên thời vụ).
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
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-muted/30">
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
      </div>
    );
  };

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

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="list">Danh sách chung</TabsTrigger>
          <TabsTrigger value="official">Nhân viên chính thức (y hệt Excel)</TabsTrigger>
          <TabsTrigger value="seasonal">Nhân viên thời vụ (y hệt Excel)</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* Filters */}
          <div className="chart-container mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-semibold">{t('employees.filter')}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label>{t('employees.department')}</Label>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger>
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
          <ExcelTable headers={officialHeaders} rows={officialRows} loading={loadingOfficial} />
        </TabsContent>

        <TabsContent value="seasonal" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Dữ liệu từ file mẫu Thời vụ tổng 2024. Hiển thị đúng cột và thứ tự như Excel. Thanh cuộn ngang luôn nằm dưới vùng bảng, kéo ngang để xem đủ cột.
          </p>
          <ExcelTable headers={seasonalHeaders} rows={seasonalRows} loading={loadingSeasonal} />
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
                <div className="flex items-center gap-4">
                  {formData.avatar && (
                    <img src={formData.avatar} alt="Avatar" className="w-20 h-20 rounded-full object-cover border" />
                  )}
                  <Input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="flex-1"
                  />
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

      {/* View Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('employees.title')}</DialogTitle>
          </DialogHeader>
          {viewingEmployee && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4">{t('employees.workInfo')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">{t('employees.employeeCodeLabel')}</Label>
                    <p className="font-medium">{viewingEmployee.employee_code}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('employees.nameLabel')}</Label>
                    <p className="font-medium">{viewingEmployee.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('employees.gender')}</Label>
                    <p className="font-medium">{translateValue(viewingEmployee.gender)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('employees.dateOfBirth')}</Label>
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
                    <Label className="text-muted-foreground">{t('employees.age')}</Label>
                    <p className="font-medium">{viewingEmployee.age}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('employees.department')}</Label>
                    <p className="font-medium">{viewingEmployee.department}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('employees.employmentType')}</Label>
                    <p className="font-medium">{translateValue(viewingEmployee.employment_type)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('employees.phoneShort')}</Label>
                    <p className="font-medium">{viewingEmployee.phone || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4">{t('employees.personalInfo')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">{t('employees.cccd')}</Label>
                    <p className="font-medium">{viewingEmployee.cccd || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('employees.hometown')}</Label>
                    <p className="font-medium">{viewingEmployee.hometown || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">{t('employees.permanentResidenceShort')}</Label>
                    <p className="font-medium">{viewingEmployee.permanent_residence || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">{t('employees.temporaryResidenceShort')}</Label>
                    <p className="font-medium">{viewingEmployee.temporary_residence || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('employees.maritalStatus')}</Label>
                    <p className="font-medium">{translateValue(viewingEmployee.marital_status || '-')}</p>
                  </div>
                </div>
              </div>

              {/* Family Relations */}
              <div>
                <h3 className="text-lg font-semibold mb-4">{t('employees.familyRelations')}</h3>
                {viewingEmployee.family_relations && viewingEmployee.family_relations.length > 0 ? (
                  <div className="space-y-2">
                    {viewingEmployee.family_relations.map((member: FamilyMember, index: number) => (
                      <div key={index} className="p-3 bg-muted rounded-lg">
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

              {/* Avatar */}
              {viewingEmployee.avatar && (
                <div>
                  <Label className="text-muted-foreground">{t('employees.avatar')}</Label>
                  <div className="mt-2">
                    <img 
                      src={viewingEmployee.avatar} 
                      alt={viewingEmployee.name}
                      className="w-32 h-32 rounded-full object-cover border"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Đóng
            </Button>
            {viewingEmployee && (
              <Button onClick={() => {
                setIsViewDialogOpen(false);
                openEditForm(viewingEmployee);
              }}>
                <Pencil className="w-4 h-4 mr-2" />
                Sửa thông tin
              </Button>
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

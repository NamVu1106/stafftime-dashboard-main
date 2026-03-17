import { Package, Stethoscope, LayoutGrid, Wallet, Banknote, FileCheck, TrendingUp, ClipboardList, Shield, Users, Building2, Upload, History, FileText, Calendar, GitCompare, Clock } from 'lucide-react';
import type { MenuTreeItem } from '@/components/dashboard/DepartmentMenuTree';

export type DeptId = 'accounting' | 'administration' | 'hr' | 'congvu' | 'muahang' | 'ehs';

/** Chức năng của Hành chính — gồm Thuốc, Phòng y tế, Phòng ban, Upload, Lịch sử */
export const administrationMenu: MenuTreeItem[] = [
  { id: 'all', label: 'Tổng quan', labelKey: 'deptMenu.overview', icon: LayoutGrid },
  { id: 'drug', label: 'Thuốc', labelKey: 'deptMenu.drug', icon: Package },
  { id: 'medical', label: 'Phòng y tế', labelKey: 'deptMenu.medical', icon: Stethoscope },
  { id: 'departments', label: 'Phòng ban', labelKey: 'deptMenu.departments', icon: Building2 },
  { id: 'upload', label: 'Upload Data', labelKey: 'deptMenu.uploadData', icon: Upload },
  { id: 'history', label: 'Lịch sử', labelKey: 'deptMenu.history', icon: History },
];

/** Hành chính: id → route (navigate) hoặc dashboard view */
export const administrationMenuRoute: Record<string, string> = {
  'departments': '/departments',
  'upload': '/upload',
  'history': '/history',
};

/** Chức năng của Kế toán */
export const accountingMenu: MenuTreeItem[] = [
  { id: 'all', label: 'Tổng quan', labelKey: 'deptMenu.overview', icon: LayoutGrid },
  { id: 'bhxh', label: 'BHXH', labelKey: 'deptMenu.bhxh', icon: Shield },
  { id: 'payroll', label: 'Lương/Thuế/BHXH', labelKey: 'deptMenu.payroll', icon: Wallet },
  { id: 'daily-wage', label: 'Tiền công hàng ngày', labelKey: 'deptMenu.dailyWage', icon: Banknote },
  { id: 'arrears', label: 'Truy thu', labelKey: 'deptMenu.arrears', icon: FileCheck },
];

/** Chức năng của Nhân sự — gồm Nhân viên, Báo cáo, HR reports */
export const hrMenu: MenuTreeItem[] = [
  { id: 'all', label: 'Tổng quan', labelKey: 'deptMenu.overview', icon: LayoutGrid },
  { id: 'employees', label: 'Danh sách nhân viên', labelKey: 'deptMenu.employeesList', icon: Users },
  { id: 'employees-new', label: 'Thêm nhân viên', labelKey: 'deptMenu.addEmployee', icon: Users },
  { id: 'reports-day', label: 'Báo cáo theo ngày', labelKey: 'deptMenu.reportsDay', icon: Calendar },
  { id: 'reports-month', label: 'Báo cáo theo tháng', labelKey: 'deptMenu.reportsMonth', icon: Calendar },
  { id: 'reports-year', label: 'Báo cáo theo năm', labelKey: 'deptMenu.reportsYear', icon: Calendar },
  { id: 'reports-range', label: 'Báo cáo theo giai đoạn', labelKey: 'deptMenu.reportsRange', icon: Calendar },
  { id: 'reports-compare', label: 'So sánh báo cáo', labelKey: 'deptMenu.reportsCompare', icon: GitCompare },
  { id: 'weekly-temporary-workers', label: 'Công nhân thời vụ 1 ngày', labelKey: 'deptMenu.weeklyTempWorker', icon: Clock },
  { id: 'attendance-rate', label: 'Tỉ lệ đi làm', labelKey: 'deptMenu.attendanceRate', icon: TrendingUp },
  { id: 'temp-timesheet', label: 'Công thời vụ', labelKey: 'deptMenu.tempTimesheet', icon: ClipboardList },
  { id: 'official-timesheet', label: 'Công chính thức', labelKey: 'deptMenu.officialTimesheet', icon: ClipboardList },
  { id: 'insurance-master', label: 'Bảo hiểm', labelKey: 'deptMenu.insurance', icon: Shield },
  { id: 'attendance-count', label: 'Số lượng đi làm', labelKey: 'deptMenu.attendanceCount', icon: FileText },
  { id: 'weekly-one-day-workers', label: 'Công nhân 1 ngày/tuần', labelKey: 'deptMenu.weeklyOneDay', icon: FileText },
  { id: 'daily-wage', label: 'Tiền công', labelKey: 'deptMenu.dailyWageShort', icon: FileText },
  { id: 'labor-rate', label: 'Tỷ lệ lao động', labelKey: 'deptMenu.laborRate', icon: FileText },
  { id: 'bhxh-list', label: 'Danh sách BHXH', labelKey: 'deptMenu.bhxhList', icon: FileText },
  { id: 'payroll', label: 'Bảng lương', labelKey: 'deptMenu.payrollTable', icon: FileText },
  { id: 'drug-inventory', label: 'Kho thuốc', labelKey: 'deptMenu.drugInventory', icon: Package },
  { id: 'medical-room-usage', label: 'Sử dụng phòng y tế', labelKey: 'deptMenu.medicalRoomUsage', icon: Stethoscope },
  { id: 'arrears-collection', label: 'Truy thu', labelKey: 'deptMenu.arrearsCollection', icon: FileCheck },
];

/** HR report IDs hiển thị inline thay vì navigate */
export const HR_REPORT_INLINE_IDS = new Set([
  'temp-timesheet', 'official-timesheet', 'attendance-rate', 'insurance-master', 'attendance-count',
  'weekly-one-day-workers', 'daily-wage', 'labor-rate', 'bhxh-list', 'payroll', 'drug-inventory',
  'medical-room-usage', 'arrears-collection',
]);

/** HR & Reports: id → route path (navigate) */
export const hrMenuRoute: Record<string, string> = {
  'employees': '/employees',
  'employees-new': '/employees/new',
  'reports-day': '/reports/day',
  'reports-month': '/reports/month',
  'reports-year': '/reports/year',
  'reports-range': '/reports/range',
  'reports-compare': '/reports/compare',
  'weekly-temporary-workers': '/reports/weekly-temporary-workers',
  'attendance-rate': '/hr/attendance-rate',
  'temp-timesheet': '/hr/temp-timesheet',
  'official-timesheet': '/hr/official-timesheet',
  'insurance-master': '/hr/insurance-master',
  'attendance-count': '/hr/attendance-count',
  'weekly-one-day-workers': '/hr/weekly-one-day-workers',
  'daily-wage': '/hr/daily-wage',
  'labor-rate': '/hr/labor-rate',
  'bhxh-list': '/hr/bhxh-list',
  'payroll': '/hr/payroll',
  'drug-inventory': '/hr/drug-inventory',
  'medical-room-usage': '/hr/medical-room-usage',
  'arrears-collection': '/hr/arrears-collection',
};

/** Công vụ, Mua hàng, EHS: placeholder */
export const congvuMenu: MenuTreeItem[] = [
  { id: 'coming', label: 'Đang phát triển', labelKey: 'deptMenu.inDevelopment', icon: LayoutGrid },
];
export const muahangMenu: MenuTreeItem[] = [
  { id: 'coming', label: 'Đang phát triển', labelKey: 'deptMenu.inDevelopment', icon: LayoutGrid },
];
export const ehsMenu: MenuTreeItem[] = [
  { id: 'coming', label: 'Đang phát triển', labelKey: 'deptMenu.inDevelopment', icon: LayoutGrid },
];

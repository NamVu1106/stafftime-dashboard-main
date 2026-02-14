import { Package, Stethoscope, LayoutGrid, Wallet, Receipt, Banknote, FileCheck, TrendingUp, ClipboardList, Shield } from 'lucide-react';
import type { MenuTreeItem } from '@/components/dashboard/DepartmentMenuTree';

export type DeptId = 'accounting' | 'administration' | 'hr' | 'congvu' | 'muahang';

/** Chức năng của Hành chính */
export const administrationMenu: MenuTreeItem[] = [
  { id: 'all', label: 'Tổng quan', icon: LayoutGrid },
  { id: 'drug', label: 'Thuốc', icon: Package },
  { id: 'medical', label: 'Phòng y tế', icon: Stethoscope },
];

/** Chức năng của Kế toán */
export const accountingMenu: MenuTreeItem[] = [
  { id: 'all', label: 'Tổng quan', icon: LayoutGrid },
  { id: 'bhxh', label: 'BHXH', icon: Shield },
  { id: 'payroll', label: 'Lương/Thuế/BHXH', icon: Wallet },
  { id: 'daily-wage', label: 'Tiền công hàng ngày', icon: Banknote },
  { id: 'arrears', label: 'Truy thu', icon: FileCheck },
];

/** Chức năng của Nhân sự - id maps to /hr/:reportType */
export const hrMenu: MenuTreeItem[] = [
  { id: 'all', label: 'Tổng quan', icon: LayoutGrid },
  { id: 'attendance-rate', label: 'Tỉ lệ đi làm', icon: TrendingUp },
  { id: 'temp-timesheet', label: 'Công thời vụ', icon: ClipboardList },
  { id: 'official-timesheet', label: 'Công chính thức', icon: ClipboardList },
  { id: 'insurance-master', label: 'Bảo hiểm', icon: Shield },
];

/** HR: id → route path (for navigate) */
export const hrMenuRoute: Record<string, string> = {
  'attendance-rate': '/hr/attendance-rate',
  'temp-timesheet': '/hr/temp-timesheet',
  'official-timesheet': '/hr/official-timesheet',
  'insurance-master': '/hr/insurance-master',
};

/** Công vụ, Mua hàng: placeholder */
export const congvuMenu: MenuTreeItem[] = [
  { id: 'coming', label: 'Đang phát triển', icon: LayoutGrid },
];
export const muahangMenu: MenuTreeItem[] = [
  { id: 'coming', label: 'Đang phát triển', icon: LayoutGrid },
];

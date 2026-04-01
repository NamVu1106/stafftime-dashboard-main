import type { LucideIcon } from 'lucide-react';
import { Activity, Home, ListTree, Sparkles, Upload } from 'lucide-react';
import {
  accountingMenu,
  administrationMenu,
  hrMenu,
  congvuMenu,
  muahangMenu,
  ehsMenu,
} from '@/data/departmentMenu';
import type { MenuTreeItem } from '@/components/dashboard/DepartmentMenuTree';

export type QuickSearchDept = 'accounting' | 'administration' | 'hr' | 'congvu' | 'muahang' | 'ehs';

/** Mục từ menu bộ phận */
export type QuickSearchDeptItem = {
  kind: 'dept';
  dept: QuickSearchDept;
  deptLabelKey: string;
  fnId: string;
  item: MenuTreeItem;
};

/** Mục đi thẳng route (không qua menu bộ phận) */
export type QuickSearchRouteItem = {
  kind: 'route';
  path: string;
  titleKey: string;
  icon: LucideIcon;
};

export type QuickSearchRegistryEntry = QuickSearchDeptItem | QuickSearchRouteItem;

const DEPT_LABEL: Record<QuickSearchDept, string> = {
  accounting: 'deptMenu.accounting',
  administration: 'deptMenu.administration',
  hr: 'deptMenu.hr',
  congvu: 'deptMenu.congvu',
  muahang: 'deptMenu.muahang',
  ehs: 'deptMenu.ehs',
};

function mapMenu(dept: QuickSearchDept, items: MenuTreeItem[]): QuickSearchDeptItem[] {
  return items.map((item) => ({
    kind: 'dept' as const,
    dept,
    deptLabelKey: DEPT_LABEL[dept],
    fnId: item.id,
    item,
  }));
}

/** Toàn bộ chức năng dùng cho ô tìm kiếm nhanh */
export function getQuickSearchRegistry(): QuickSearchRegistryEntry[] {
  return [
    { kind: 'route', path: '/', titleKey: 'sidebar.dashboard', icon: Home },
    { kind: 'route', path: '/realtime', titleKey: 'sidebar.realtime', icon: Activity },
    { kind: 'route', path: '/revision-history', titleKey: 'sidebar.revisionHistory', icon: ListTree },
    { kind: 'route', path: '/upload', titleKey: 'sidebar.uploadData', icon: Upload },
    { kind: 'route', path: '/introduction', titleKey: 'hrProIntro.navTitle', icon: Sparkles },
    ...mapMenu('accounting', accountingMenu),
    ...mapMenu('administration', administrationMenu),
    ...mapMenu('hr', hrMenu),
    ...mapMenu('congvu', congvuMenu),
    ...mapMenu('muahang', muahangMenu),
    ...mapMenu('ehs', ehsMenu),
  ];
}

export function normalizeQuickSearchText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

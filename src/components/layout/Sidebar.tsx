import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { 
  LayoutDashboard, 
  Upload, 
  Users, 
  FileText,
  History,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Activity,
  Building2,
  Clock,
  TrendingUp,
  Calendar,
  GitCompare,
  ScrollText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimeFilter } from '@/components/shared/TimeFilter';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useI18n } from '@/contexts/I18nContext';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface MenuItem {
  path?: string;
  icon: any;
  label: string;
  children?: MenuItem[];
}

const getMenuItems = (t: (key: string) => string): MenuItem[] => [
  { path: '/', icon: LayoutDashboard, label: t('sidebar.home') },
  { path: '/revision-history', icon: ScrollText, label: t('sidebar.revisionHistory') },
  {
    icon: TrendingUp,
    label: t('sidebar.overview'),
    children: [
      { path: '/', icon: LayoutDashboard, label: t('sidebar.dashboard') },
      { path: '/realtime', icon: Activity, label: t('sidebar.realtime') },
    ],
  },
  {
    icon: Users,
    label: t('sidebar.employees'),
    children: [
      { path: '/employees', icon: Users, label: t('sidebar.list') },
      { path: '/employees/new', icon: Users, label: t('sidebar.addNew') },
    ],
  },
  {
    icon: FileText,
    label: t('sidebar.reports'),
    children: [
      { path: '/reports/day', icon: Calendar, label: t('sidebar.byDay') },
      { path: '/reports/month', icon: Calendar, label: t('sidebar.byMonth') },
      { path: '/reports/year', icon: Calendar, label: t('sidebar.byYear') },
      { path: '/reports/range', icon: Calendar, label: t('sidebar.byPeriod') },
      { path: '/reports/compare', icon: GitCompare, label: t('sidebar.compare') },
      { path: '/reports/weekly-temporary-workers', icon: Clock, label: 'Công nhân thời vụ 1 ngày' },
    ],
  },
  {
    icon: FileText,
    label: t('sidebar.hr'),
    children: [
      { path: '/hr/attendance-rate', icon: FileText, label: t('sidebar.hrAttendanceRate') },
      { path: '/hr/attendance-count', icon: FileText, label: t('sidebar.hrAttendanceCount') },
      { path: '/hr/weekly-one-day-workers', icon: FileText, label: t('sidebar.hrWeeklyOneDayWorkers') },
      { path: '/hr/temp-timesheet', icon: FileText, label: t('sidebar.hrTempTimesheet') },
      { path: '/hr/official-timesheet', icon: FileText, label: t('sidebar.hrOfficialTimesheet') },
      { path: '/hr/daily-wage', icon: FileText, label: t('sidebar.hrDailyWage') },
      { path: '/hr/labor-rate', icon: FileText, label: t('sidebar.hrLaborRate') },
      { path: '/hr/bhxh-list', icon: FileText, label: t('sidebar.hrBhxhList') },
      { path: '/hr/insurance-master', icon: FileText, label: t('sidebar.hrInsuranceMaster') },
      { path: '/hr/payroll', icon: FileText, label: t('sidebar.hrPayroll') },
      { path: '/hr/drug-inventory', icon: FileText, label: t('sidebar.hrDrugInventory') },
      { path: '/hr/medical-room-usage', icon: FileText, label: t('sidebar.hrMedicalRoomUsage') },
      { path: '/hr/arrears-collection', icon: FileText, label: t('sidebar.hrArrearsCollection') },
    ],
  },
  { path: '/departments', icon: Building2, label: t('sidebar.departments') },
  { path: '/upload', icon: Upload, label: t('sidebar.uploadData') },
  { path: '/history', icon: History, label: t('sidebar.history') },
];

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const { t } = useI18n();
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const menuItems = getMenuItems(t);

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => 
      prev.includes(label) 
        ? prev.filter(m => m !== label)
        : [...prev, label]
    );
  };

  const isMenuOpen = (label: string) => openMenus.includes(label);
  const hasActiveChild = (item: MenuItem) => {
    if (!item.children) return false;
    return item.children.some(child => child.path === location.pathname);
  };

  const renderMenuItem = (item: MenuItem, index: number) => {
    // Menu item có children (submenu)
    if (item.children && item.children.length > 0) {
      const isOpen = isMenuOpen(item.label);
      const hasActive = hasActiveChild(item);

      return (
        <li key={`${item.label}-${index}`}>
          <Collapsible open={isOpen} onOpenChange={() => toggleMenu(item.label)}>
            <CollapsibleTrigger
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 ease-out",
                "text-sidebar-foreground hover:bg-sidebar-hover hover:translate-x-1",
                hasActive && "bg-primary/10 text-primary",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110" />
              {!collapsed && (
                <>
                  <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                  <ChevronDown className={cn(
                    "w-4 h-4 transition-transform duration-300 ease-out",
                    isOpen && "rotate-180"
                  )} />
                </>
              )}
            </CollapsibleTrigger>
            {!collapsed && (
              <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                <ul className="ml-4 mt-1 space-y-1 border-l border-sidebar-hover pl-4">
                  {item.children.map((child, childIndex) => {
                    const isActive = child.path === location.pathname;
                    return (
                      <li key={`${child.path}-${childIndex}`}>
                        <NavLink
                          to={child.path || '#'}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-300 ease-out",
                            "text-sm text-sidebar-foreground/80 hover:bg-sidebar-hover hover:text-sidebar-foreground hover:translate-x-1",
                            isActive && "bg-primary text-primary-foreground font-medium"
                          )}
                        >
                          <child.icon className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
                          <span>{child.label}</span>
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </CollapsibleContent>
            )}
          </Collapsible>
        </li>
      );
    }

    // Menu item không có children (link đơn)
    if (item.path) {
      const isActive = item.path === location.pathname;
      return (
        <li key={item.path}>
          <NavLink
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 ease-out",
                "text-sidebar-foreground hover:bg-sidebar-hover hover:translate-x-1",
                isActive && "bg-primary text-primary-foreground hover:bg-primary",
                collapsed && "justify-center px-2"
              )
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110" />
            {!collapsed && (
              <span className="text-sm font-medium">{item.label}</span>
            )}
          </NavLink>
        </li>
      );
    }

    return null;
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar-bg transition-all duration-300 ease-out flex flex-col shadow-lg",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo - YS-Smart branding */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-hover shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[hsl(200,80%,50%)] rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-white text-sm">
            YS
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sidebar-foreground font-bold text-base leading-tight">
                YS-Smart
              </span>
              <span className="text-sidebar-foreground/70 text-xs">
                You Sung Vina
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto scrollbar-thin">
        <ul className="space-y-1">
          {menuItems.map((item, index) => renderMenuItem(item, index))}
        </ul>
        {/* Bộ lọc thời gian - ngay dưới Lịch sử, đồng bộ toàn hệ thống */}
        <TimeFilter collapsed={collapsed} />
      </nav>

      {/* Footer - New Idea, NO.1 Production */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-sidebar-hover shrink-0">
          <p className="text-xs text-sidebar-foreground/60 text-center">
            New Idea, NO.1 Production
          </p>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center shadow-sm hover:bg-muted hover:scale-110 active:scale-95 transition-all duration-300 ease-out"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform duration-300" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-muted-foreground transition-transform duration-300" />
        )}
      </button>
    </aside>
  );
};

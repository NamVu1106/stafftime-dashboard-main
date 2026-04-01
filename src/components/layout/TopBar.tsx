import { useEffect, useRef, useState } from 'react';
import { Bell, Menu, User, LogOut, X, Trash2, AlertTriangle, Settings, Calculator, FileText, Users, Briefcase, ShoppingCart, Home, HelpCircle, ShieldCheck, ChevronDown, LayoutGrid, FolderOpen, FileSpreadsheet, ListTree } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/hooks/useI18n';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsAPI, type ApiNotification } from '@/services/api';
import { resolveNotificationPath } from '@/lib/notificationNavigation';
import { QuickFunctionSearch } from '@/components/layout/QuickFunctionSearch';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { useDashboardTab } from '@/contexts/DashboardTabContext';
import { accountingMenu, administrationMenu, hrMenu, congvuMenu, muahangMenu, ehsMenu, hrMenuRoute, administrationMenuRoute, HR_REPORT_INLINE_IDS } from '@/data/departmentMenu';
import * as XLSX from 'xlsx';
import type { MenuTreeItem } from '@/components/dashboard/DepartmentMenuTree';

interface TopBarProps {
  onMenuClick: () => void;
}

/** Popup chọn chức năng - hover hiện, layout giống ảnh (4 cột + sidebar) */
function DeptDropdown({
  value,
  label,
  icon: Icon,
  items,
  activeDeptTab,
  onSelect,
}: {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuTreeItem[];
  activeDeptTab: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOpen = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOpen(true);
  };

  const handleClose = () => {
    closeTimeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  const handleDownloadExcel = () => {
    const data = items.map((item) => ({
      [t('deptMenu.department')]: label,
      [t('deptMenu.function')]: item.labelKey ? t(item.labelKey) : item.label,
      'ID': item.id,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MenuTree');
    XLSX.writeFile(wb, `YS-Smart_MenuTree_${label.replace(/\s/g, '_')}.xlsx`);
  };

  const n = Math.min(4, Math.max(1, Math.ceil(items.length / 2)));
  const perCol = Math.ceil(items.length / n);
  const cols = Array.from({ length: n }, (_, i) =>
    items.slice(i * perCol, (i + 1) * perCol).map((x) => x.id)
  );
  const getColumnItems = (ids: string[]) => items.filter((item) => ids.includes(item.id));
  const groupLabel = label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 shrink-0 ${
            activeDeptTab === value
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
              : 'hover:bg-muted text-muted-foreground hover:text-foreground hover:shadow-md'
          }`}
        >
          <Icon className="w-4 h-4" />
          {label}
          <ChevronDown className={`w-3.5 h-3.5 opacity-70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        className="w-[980px] max-w-[95vw] p-0 overflow-hidden border border-primary/20 rounded-xl bg-white dept-popup-content"
      >
        <div className="flex">
          {/* Grid 4 cột - hệt ảnh 1: header xanh, badge trắng, card trắng */}
          <div className="flex-1 p-5 overflow-auto max-h-[75vh]">
            <div className="dept-popup-header bg-[hsl(215,75%,32%)] -mx-5 -mt-5 px-5 py-4 mb-5 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white drop-shadow-sm">{label} — {t('deptMenu.selectFunction')}</h2>
              <div className="flex items-center gap-2">
                <span className="dept-popup-badge px-3 py-1.5 rounded-lg bg-white text-primary text-sm font-medium shadow-sm cursor-default">
                  {items.length} {t('deptMenu.functionsCount')}
                </span>
                <span className="dept-popup-badge px-3 py-1.5 rounded-lg bg-white text-primary text-sm font-medium shadow-sm cursor-default">
                  {t('deptMenu.detailDescription')}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {cols.map((ids, colIdx) => {
                const colItems = getColumnItems(ids);
                if (colItems.length === 0) return null;
                return (
                  <div key={colIdx} className="dept-popup-card border border-border rounded-xl overflow-hidden bg-white shadow-sm min-w-[180px]">
                    <div className="bg-muted/80 px-4 py-3 text-sm font-semibold text-foreground">{groupLabel}</div>
                    <ul className="divide-y divide-border bg-white">
                      {colItems.map((item) => {
                        const ItemIcon = item.icon ?? FolderOpen;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => {
                                onSelect(item.id);
                                setOpen(false);
                              }}
                              className="dept-popup-item w-full flex items-center gap-2.5 px-4 py-3 hover:bg-primary/5 text-left text-sm min-w-0"
                            >
                              <ItemIcon className="w-4 h-4 text-primary shrink-0" />
                              <span className="break-words min-w-0">{item.labelKey ? t(item.labelKey) : item.label}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Right sidebar - 세부 설명 - hệt ảnh 1 */}
          <div className="w-64 shrink-0 border-l border-border bg-white p-5">
            <p className="text-sm text-muted-foreground mb-4">
              {t('deptMenu.selectFromTable')}
            </p>
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 h-9 text-sm transition-all duration-200 hover:bg-primary/10 hover:translate-x-1"
                onClick={handleDownloadExcel}
              >
                <FileSpreadsheet className="w-4 h-4" />
                {t('dashboard.downloadExcel')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 h-9 text-sm transition-all duration-200 hover:bg-primary/10 hover:translate-x-1"
                onClick={() => sonnerToast('Menu Structure')}
              >
                <ListTree className="w-4 h-4" />
                {t('dashboard.menuStructure')}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Helper function to format time ago
const formatTimeAgo = (dateString: string, t: (k: string, p?: Record<string, string | number>) => string, language: 'vi' | 'ko'): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return t('common.justNow');
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return t('common.minutesAgo', { n: diffInMinutes });
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return t('common.hoursAgo', { n: diffInHours });
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return t('common.daysAgo', { n: diffInDays });
  }
  
  const locale = language === 'ko' ? 'ko-KR' : 'vi-VN';
  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const TopBar = ({ onMenuClick }: TopBarProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { toast: uiToast } = useToast();
  const { t, language } = useI18n();
  const { activeDeptTab, setActiveDeptTab, setSelectedFunction } = useDashboardTab();
  const isDashboard = location.pathname === '/';

  useEffect(() => {
    const path = location.pathname;
    if (path === '/') return;

    if (
      path.startsWith('/hr/') ||
      path.startsWith('/employees') ||
      path.startsWith('/reports')
    ) {
      if (activeDeptTab !== 'hr') setActiveDeptTab('hr');
      return;
    }

    if (
      path.startsWith('/upload') ||
      path.startsWith('/history') ||
      path.startsWith('/departments')
    ) {
      if (activeDeptTab !== 'administration') setActiveDeptTab('administration');
      return;
    }
  }, [activeDeptTab, location.pathname, setActiveDeptTab]);

  // Fetch notifications
  const { data: notifications = [], refetch: refetchNotifications } = useQuery<ApiNotification[]>({
    queryKey: ['notifications'],
    queryFn: () => notificationsAPI.getAll({ limit: 10 }),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch unread count
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsAPI.getUnreadCount(),
    refetchInterval: 30000,
  });

  const unreadCount = unreadData?.count || 0;

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => notificationsAPI.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsAPI.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: (id: number) => notificationsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      uiToast({
        title: t('common.success'),
        description: t('common.notificationDeleted'),
      });
    },
    onError: (error: any) => {
      uiToast({
        title: t('common.error'),
        description: error.message || t('common.notificationDeleteError'),
        variant: 'destructive',
      });
    },
  });

  // Delete all notifications mutation
  const deleteAllNotificationsMutation = useMutation({
    mutationFn: () => notificationsAPI.deleteAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      uiToast({
        title: t('common.success'),
        description: t('common.allNotificationsDeleted'),
      });
    },
    onError: (error: any) => {
      uiToast({
        title: t('common.error'),
        description: error.message || t('common.allNotificationsDeleteError'),
        variant: 'destructive',
      });
    },
  });

  const handleNotificationClick = (notification: ApiNotification) => {
    const target = resolveNotificationPath(notification);
    const unread = notification.is_read === 0;

    const markReadSoon = () => {
      if (!unread) return;
      setTimeout(() => markAsReadMutation.mutate(notification.id), 0);
    };

    if (!target) {
      if (unread) markAsReadMutation.mutate(notification.id);
      return;
    }

    if (target.external) {
      void (async () => {
        if (unread) {
          try {
            await markAsReadMutation.mutateAsync(notification.id);
          } catch {
            /* vẫn mở link */
          }
        }
        window.location.assign(target.href);
      })();
      return;
    }

    navigate(target.href);
    markReadSoon();
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const handleDeleteNotification = (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // Prevent triggering the notification click
    deleteNotificationMutation.mutate(id);
  };

  const handleDeleteAll = () => {
    deleteAllNotificationsMutation.mutate();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  const formatHeaderDate = () => {
    return new Date().toLocaleDateString(language === 'vi' ? 'vi-VN' : 'ko-KR', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' (GMT+7)';
  };

  const openDashboardFunction = (dept: string, id: string) => {
    setActiveDeptTab(dept);
    setSelectedFunction(id);
    if (!isDashboard) navigate('/');
  };

  return (
    <header className="sticky top-0 z-30 bg-topbar-bg border-b border-border shadow-topbar backdrop-blur-sm bg-opacity-95 transition-all duration-300">
      <div className="flex items-center px-4 gap-4 h-14 min-h-[3.5rem]">
      {/* Menu Toggle (Mobile) */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden shrink-0"
        onClick={onMenuClick}
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Left - Local, Date (YS-Smart style) */}
      <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Local</span>
        <span className="text-xs">{formatHeaderDate()}</span>
      </div>

      {/* Department tabs - popup chọn chức năng, luôn giữ cố định trên mọi trang */}
      <div className="flex items-center gap-1 border-l border-border pl-4 ml-2 overflow-x-auto min-w-0 shrink">
        <DeptDropdown
          value="accounting"
          label={t('deptMenu.accounting')}
          icon={Calculator}
          items={accountingMenu}
          activeDeptTab={activeDeptTab}
          onSelect={(id) => openDashboardFunction('accounting', id)}
        />
        <DeptDropdown
          value="administration"
          label={t('deptMenu.administration')}
          icon={FileText}
          items={administrationMenu}
          activeDeptTab={activeDeptTab}
          onSelect={(id) => {
            setActiveDeptTab('administration');
            if (administrationMenuRoute[id]) navigate(administrationMenuRoute[id]);
            else openDashboardFunction('administration', id);
          }}
        />
        <DeptDropdown
          value="hr"
          label={t('deptMenu.hr')}
          icon={Users}
          items={hrMenu}
          activeDeptTab={activeDeptTab}
          onSelect={(id) => {
            setActiveDeptTab('hr');
            if (id === 'all') {
              openDashboardFunction('hr', 'all');
              return;
            }
            if (HR_REPORT_INLINE_IDS.has(id) && isDashboard) {
              setSelectedFunction(id);
              return;
            }
            if (hrMenuRoute[id]) {
              navigate(hrMenuRoute[id]);
              return;
            }
            openDashboardFunction('hr', id);
          }}
        />
        <DeptDropdown
          value="congvu"
          label={t('deptMenu.congvu')}
          icon={Briefcase}
          items={congvuMenu}
          activeDeptTab={activeDeptTab}
          onSelect={() => {
            setActiveDeptTab('congvu');
            sonnerToast(t('deptMenu.comingSoon'));
          }}
        />
        <DeptDropdown
          value="muahang"
          label={t('deptMenu.muahang')}
          icon={ShoppingCart}
          items={muahangMenu}
          activeDeptTab={activeDeptTab}
          onSelect={() => {
            setActiveDeptTab('muahang');
            sonnerToast(t('deptMenu.comingSoon'));
          }}
        />
        <DeptDropdown
          value="ehs"
          label={t('deptMenu.ehs')}
          icon={ShieldCheck}
          items={ehsMenu}
          activeDeptTab={activeDeptTab}
          onSelect={() => {
            setActiveDeptTab('ehs');
            sonnerToast(t('deptMenu.comingSoonEhs'));
          }}
        />
      </div>

      {/* Icon toolbar - Home, Help, Settings (MES 2.0 style) */}
      <div className="hidden md:flex items-center gap-1 border-l border-border pl-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => navigate('/')}
          title={t('common.home')}
        >
          <Home className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => navigate('/introduction')}
          title={t('common.help')}
        >
          <HelpCircle className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          title="Config"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      {/* Center - Tìm nhanh chức năng (gợi ý + icon) */}
      <div className="flex-1 max-w-md mx-4 min-w-0">
        <QuickFunctionSearch />
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs bg-destructive">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="font-semibold">{t('common.notifications')}</p>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1 text-xs text-primary"
                  onClick={handleMarkAllAsRead}
                >
                  {t('common.markAllAsRead')}
                </Button>
              )}
            </div>
            <div className="py-2 max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {t('common.noNotifications')}
                </div>
              ) : (
                notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className={`flex items-start justify-between gap-2 py-3 cursor-pointer group ${
                      notification.is_read === 0 ? 'bg-muted/50' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex-1 flex flex-col items-start gap-1">
                      <p className="font-medium">{notification.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTimeAgo(notification.created_at, t, language)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleDeleteNotification(e, notification.id)}
                      title="Xóa thông báo"
                    >
                      <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </DropdownMenuItem>
                ))
              )}
            </div>
            {notifications.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <div className="p-2 flex gap-2">
                  <Button variant="ghost" className="flex-1 text-primary">
                    {t('common.viewAll')}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        title={t('common.deleteAllNotifications')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-destructive" />
                          {t('common.confirm')} {t('common.deleteAll')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('common.confirm')} {notifications.length} {t('common.notifications')}? 
                          {t('common.deleteAllConfirmDesc')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAll}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {t('common.deleteAll')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <User className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="hidden md:block text-sm font-medium">{user?.username || 'User'}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-4 py-3 border-b border-border">
              <p className="font-medium">{user?.username || 'User'}</p>
              <p className="text-sm text-muted-foreground">{t('common.role')}: {user?.role || 'user'}</p>
            </div>
            <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              {t('common.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      </div>
    </header>
  );
};

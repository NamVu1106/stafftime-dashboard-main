import { Bell, Menu, User, LogOut, X, Trash2, AlertTriangle, Search, Settings, Calculator, FileText, Users, Briefcase, ShoppingCart, Home, HelpCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsAPI } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { useDashboardTab } from '@/contexts/DashboardTabContext';

interface TopBarProps {
  onMenuClick: () => void;
}

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: number;
  metadata: any;
  created_at: string;
}

// Helper function to format time ago
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Vừa xong';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} phút trước`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} giờ trước`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} ngày trước`;
  }
  
  // Format as date if older than a week
  return date.toLocaleDateString('vi-VN', {
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
  const { toast } = useToast();
  const { t, language } = useI18n();
  const { activeDeptTab, setActiveDeptTab, setSelectedFunction } = useDashboardTab();
  const isDashboard = location.pathname === '/';

  // Fetch notifications
  const { data: notifications = [], refetch: refetchNotifications } = useQuery<Notification[]>({
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
      toast({
        title: t('common.success'),
        description: language === 'vi' ? 'Đã xóa thông báo' : '알림이 삭제되었습니다',
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || (language === 'vi' ? 'Có lỗi xảy ra khi xóa thông báo' : '알림 삭제 중 오류가 발생했습니다'),
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
      toast({
        title: t('common.success'),
        description: language === 'vi' ? 'Đã xóa tất cả thông báo' : '모든 알림이 삭제되었습니다',
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || (language === 'vi' ? 'Có lỗi xảy ra khi xóa thông báo' : '알림 삭제 중 오류가 발생했습니다'),
        variant: 'destructive',
      });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (notification.is_read === 0) {
      markAsReadMutation.mutate(notification.id);
    }
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

      {/* Left - Local, Config, Date (YS-Smart style) */}
      <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Local</span>
        <button type="button" className="flex items-center gap-1 hover:text-foreground transition-colors" title="Config">
          <Settings className="w-4 h-4" />
          <span>Config</span>
        </button>
        <span className="text-xs">{formatHeaderDate()}</span>
      </div>

      {/* Department tabs - cùng hàng với Local, Config, Search (chỉ khi ở Trang chủ) */}
      {isDashboard && (
        <div className="flex items-center gap-1 border-l border-border pl-4 ml-2 overflow-x-auto min-w-0 shrink">
          {[
            { value: 'accounting', label: 'Kế toán', icon: Calculator },
            { value: 'administration', label: 'Hành chính', icon: FileText },
            { value: 'hr', label: 'Nhân sự', icon: Users },
            { value: 'congvu', label: 'Công vụ', icon: Briefcase },
            { value: 'muahang', label: 'Mua hàng', icon: ShoppingCart },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setActiveDeptTab(tab.value);
                setSelectedFunction(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors shrink-0 ${
                activeDeptTab === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Icon toolbar - Home, Help, Settings (MES 2.0 style) */}
      <div className="hidden md:flex items-center gap-1 border-l border-border pl-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => navigate('/')}
          title={language === 'vi' ? 'Trang chủ' : '홈'}
        >
          <Home className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => toast({ title: 'Help', description: language === 'vi' ? 'Trợ giúp - YS Smart' : '도움말' })}
          title={language === 'vi' ? 'Trợ giúp' : '도움말'}
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

      {/* Center - Search (YS-Smart Quick Search) */}
      <div className="flex-1 max-w-md mx-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={language === 'vi' ? 'Tìm kiếm nhanh...' : '빠른 검색...'}
            className="pl-9 h-9 bg-muted/50 border-0 focus-visible:ring-2"
          />
        </div>
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
                        {formatTimeAgo(notification.created_at)}
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
                        title="Xóa tất cả thông báo"
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
                          {language === 'vi' ? ' Hành động này không thể hoàn tác.' : ' 이 작업은 되돌릴 수 없습니다.'}
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

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Lock, User, KeyRound, Copy, Check, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { authAPI } from '@/services/api';
import { cn } from '@/lib/utils';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [localMode, setLocalMode] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotPasswordUsername, setForgotPasswordUsername] = useState('');
  const [isForgotPasswordLoading, setIsForgotPasswordLoading] = useState(false);
  const [resetResult, setResetResult] = useState<{ username?: string; newPassword: string; warning?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [cardShake, setCardShake] = useState(false);
  const [activeDot, setActiveDot] = useState(0);
  const { login, isAuthenticated } = useAuth();
  const { language, setLanguage } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    const savedUsername = localStorage.getItem('remembered_username');
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  // Carousel: chuyển ảnh mỗi 2s, transition 1s mượt mà
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveDot((prev) => (prev + 1) % 3);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Redirect khi đã đăng nhập - phải dùng useEffect, không gọi navigate() trong render
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setCardShake(false);

    try {
      await login(username, password);

      if (rememberMe) {
        localStorage.setItem('remembered_username', username);
      } else {
        localStorage.removeItem('remembered_username');
      }

      setIsSuccess(true);
      toast.success(language === 'vi' ? 'Đăng nhập thành công!' : '로그인 성공!');

      setTimeout(() => {
        navigate('/');
      }, 400);
    } catch (err: any) {
      setError(err.message || (language === 'vi' ? 'Đăng nhập thất bại.' : '로그인 실패'));
      setCardShake(true);
      toast.error(err.message || 'Login failed');
      setTimeout(() => setCardShake(false), 500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setIsForgotPasswordOpen(true);
    setForgotPasswordUsername('');
    setResetResult(null);
    setCopied(false);
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordUsername.trim()) {
      toast.error(language === 'vi' ? 'Vui lòng nhập tên đăng nhập' : '사용자 이름을 입력하세요');
      return;
    }

    setIsForgotPasswordLoading(true);
    setResetResult(null);
    setCopied(false);

    try {
      const result = await authAPI.forgotPassword(forgotPasswordUsername.trim());
      setResetResult({
        username: result.username,
        newPassword: result.newPassword,
        warning: result.warning,
      });
      toast.success(result.message);
    } catch (err: any) {
      toast.error(err.message || (language === 'vi' ? 'Có lỗi xảy ra' : '오류가 발생했습니다'));
    } finally {
      setIsForgotPasswordLoading(false);
    }
  };

  const handleCopyPassword = () => {
    if (resetResult?.newPassword) {
      navigator.clipboard.writeText(resetResult.newPassword);
      setCopied(true);
      toast.success(language === 'vi' ? 'Đã sao chép!' : '복사되었습니다');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCloseForgotPassword = () => {
    setIsForgotPasswordOpen(false);
    setForgotPasswordUsername('');
    setResetResult(null);
    setCopied(false);
  };

  const handleCreateAccount = () => {
    toast.info(language === 'vi' ? 'Liên hệ quản trị viên để tạo tài khoản.' : '관리자에게 문의하여 계정을 생성하세요.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 login-page-bg">
      {/* Centered card - Upteamist style + hiệu ứng */}
      <div
        className={cn(
          'w-full max-w-5xl overflow-hidden rounded-2xl flex flex-col lg:flex-row bg-white transition-all duration-300',
          'login-card-enter login-card-shadow',
          cardShake && 'animate-shake'
        )}
      >
        {/* Left panel - Blue with decorative shapes + shimmer */}
        <div className="lg:w-[58%] relative bg-[hsl(215,65%,35%)] p-8 lg:p-12 flex flex-col justify-between min-h-[320px] lg:min-h-[560px] login-panel-shimmer">
          {/* Decorative organic shapes */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/8 blur-3xl animate-pulse" />
            <div className="absolute top-1/3 -left-16 w-48 h-48 rounded-full bg-white/6 blur-2xl" />
            <div className="absolute bottom-20 right-1/4 w-40 h-40 rounded-full bg-white/5 blur-2xl" />
            <div className="absolute top-1/4 right-1/3 w-24 h-24 rounded-full bg-white/10 blur-xl" />
            <svg className="absolute bottom-0 right-0 w-full h-1/2 opacity-20" viewBox="0 0 400 200" preserveAspectRatio="none">
              <path d="M0,120 Q100,80 200,100 T400,80 L400,200 L0,200 Z" fill="white" />
              <path d="M0,150 Q150,100 300,130 T400,100 L400,200 L0,200 Z" fill="white" opacity="0.7" />
            </svg>
          </div>

          <div className="relative z-10 flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-white/20 flex items-center justify-center font-bold text-white text-lg login-logo-glow cursor-default">
              YS
            </div>
            <span className="text-xl font-bold text-white drop-shadow-sm">YS-Smart</span>
          </div>

          <div className="relative z-10 flex flex-col items-center text-center flex-1 justify-center py-8">
            <div className="w-44 h-44 lg:w-52 lg:h-52 flex items-center justify-center mb-6 relative">
              {['/login-slide-1.png', '/login-slide-2.png', '/login-slide-3.png'].map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className={cn(
                    'absolute inset-0 w-full h-full object-contain drop-shadow-2xl',
                    'transition-all duration-700 ease-in-out',
                    i === activeDot ? 'opacity-100 z-10 login-carousel-img scale-100' : 'opacity-0 z-0 pointer-events-none scale-95'
                  )}
                />
              ))}
            </div>
            <h2 className="text-3xl font-bold text-white mb-3 drop-shadow-md animate-fade-in">
              {language === 'vi' ? 'Chào mừng!' : 'Welcome!'}
            </h2>
            <p className="text-white/90 text-sm max-w-xs leading-relaxed">
              {language === 'vi'
                ? 'Hệ thống quản lý chấm công nhân sự với đầy đủ tính năng dashboard, báo cáo và quản lý nhân viên.'
                : '글로벌 제조 실행 시스템. YS-Smart와 함께 효율적인 인사 관리를 경험하세요.'}
            </p>
          </div>

          <div className="relative z-10 flex justify-center gap-2.5">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveDot(i)}
                className={cn(
                  'w-2.5 h-2.5 rounded-full cursor-pointer hover:bg-white/90',
                  'transition-all duration-500 ease-out',
                  i === activeDot ? 'bg-white scale-125 login-dot-active' : 'bg-white/40 scale-100 hover:scale-110 hover:bg-white/60'
                )}
                aria-label={language === 'vi' ? `Ảnh ${i + 1}` : `Slide ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Right panel - Login form (~40%) */}
        <main className="lg:w-[42%] flex flex-col p-8 lg:p-12 bg-white relative border-l border-gray-100/50">
          {/* Language selector - top right */}
          <div className="absolute top-6 right-6">
            <Select value={language} onValueChange={(v) => setLanguage(v as 'vi' | 'ko')}>
              <SelectTrigger className="w-[120px] h-9 border border-gray-200 rounded-lg transition-all duration-300 hover:border-[hsl(215,75%,38%)]/50 hover:shadow-md hover:shadow-primary/5">
                <Globe className="w-4 h-4 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vi">Viet Nam</SelectItem>
                <SelectItem value="ko">Korea</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              {language === 'vi' ? 'Đăng nhập' : 'Log In'}
            </h2>
            <p className="text-sm text-gray-600 mb-1">
              {language === 'vi' ? 'Chưa có tài khoản?' : 'Don\'t have an account?'}{' '}
              <button
                type="button"
                onClick={handleCreateAccount}
                className="text-[hsl(215,75%,38%)] hover:underline font-medium"
              >
                {language === 'vi' ? 'Liên hệ quản trị' : 'Create an account'}
              </button>
            </p>
            <p className="text-xs text-gray-500 mb-6">
              {language === 'vi' ? 'Chỉ mất chưa đầy một phút.' : 'It will take less than a minute.'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="py-2.5 text-sm">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-sm font-medium text-gray-700">
                  {language === 'vi' ? 'Tên đăng nhập' : 'Username'}
                </Label>
                <div className="relative">
                  <Input
                    id="username"
                    type="text"
                    placeholder={language === 'vi' ? 'Nhập tên đăng nhập' : 'Username'}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pr-10 h-11 border border-gray-300 rounded-xl focus:border-[hsl(215,75%,38%)] focus:ring-2 focus:ring-[hsl(215,75%,38%)]/20 login-input-field"
                    required
                    disabled={isLoading}
                  />
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 transition-colors" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  {language === 'vi' ? 'Mật khẩu' : 'Password'}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    placeholder={language === 'vi' ? 'Nhập mật khẩu' : 'Password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 h-11 border border-gray-300 rounded-xl focus:border-[hsl(215,75%,38%)] focus:ring-2 focus:ring-[hsl(215,75%,38%)]/20 login-input-field"
                    required
                    disabled={isLoading}
                  />
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 transition-colors" />
                </div>
              </div>

              <Button
                type="submit"
                className={cn(
                  'w-full h-12 text-base font-semibold bg-[hsl(215,75%,38%)] hover:bg-[hsl(215,75%,32%)] rounded-xl login-btn-primary',
                  isSuccess && 'opacity-0 scale-95'
                )}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    {language === 'vi' ? 'Đang đăng nhập...' : '로그인 중...'}
                  </>
                ) : (
                  language === 'vi' ? 'Đăng nhập' : 'Sign in'
                )}
              </Button>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={rememberMe}
                    onCheckedChange={(c) => setRememberMe(!!c)}
                    disabled={isLoading}
                  />
                  <span className="text-sm text-gray-600">
                    {language === 'vi' ? 'Ghi nhớ mật khẩu' : 'Remember password'}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm text-[hsl(215,75%,38%)] hover:underline font-medium"
                >
                  {language === 'vi' ? 'Quên mật khẩu?' : 'Forget your password?'}
                </button>
              </div>

              {/* Local mode - subtle */}
              <label className="flex items-center gap-2 cursor-pointer pt-2">
                <Checkbox
                  checked={localMode}
                  onCheckedChange={(c) => setLocalMode(!!c)}
                  disabled={isLoading}
                />
                <span className="text-sm text-gray-500">Local</span>
              </label>
            </form>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            New Idea, NO.1 Production
          </p>
        </main>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              {language === 'vi' ? 'Quên mật khẩu' : '비밀번호 찾기'}
            </DialogTitle>
            <DialogDescription>
              {language === 'vi' ? 'Nhập tên đăng nhập để reset mật khẩu về mặc định' : '사용자 이름을 입력하여 비밀번호 초기화'}
            </DialogDescription>
          </DialogHeader>

          {!resetResult ? (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-username">
                  {language === 'vi' ? 'Tên đăng nhập' : '사용자 이름'}
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="forgot-username"
                    type="text"
                    placeholder={language === 'vi' ? 'Nhập tên đăng nhập' : '사용자 이름 입력'}
                    value={forgotPasswordUsername}
                    onChange={(e) => setForgotPasswordUsername(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isForgotPasswordLoading}
                    autoFocus
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseForgotPassword}
                  disabled={isForgotPasswordLoading}
                >
                  {language === 'vi' ? 'Hủy' : '취소'}
                </Button>
                <Button
                  type="submit"
                  disabled={isForgotPasswordLoading || !forgotPasswordUsername.trim()}
                >
                  {isForgotPasswordLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {language === 'vi' ? 'Đang xử lý...' : '처리 중...'}
                    </>
                  ) : (
                    language === 'vi' ? 'Reset mật khẩu' : '비밀번호 초기화'
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  {language === 'vi' ? 'Mật khẩu đã được reset thành công!' : '비밀번호가 성공적으로 초기화되었습니다!'}
                </AlertDescription>
              </Alert>

              <div className="space-y-2 p-4 bg-muted rounded-lg border">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    {language === 'vi' ? 'Tên đăng nhập' : '사용자 이름'}
                  </Label>
                  <span className="font-mono text-sm">{resetResult.username || forgotPasswordUsername}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    {language === 'vi' ? 'Mật khẩu mới' : '새 비밀번호'}
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-primary">{resetResult.newPassword}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleCopyPassword}
                      title={language === 'vi' ? 'Sao chép' : '복사'}
                    >
                      {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {resetResult.warning && (
                <Alert variant="destructive">
                  <AlertDescription>{resetResult.warning}</AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button type="button" onClick={handleCloseForgotPassword} className="w-full">
                  {language === 'vi' ? 'Đóng' : '닫기'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginPage;

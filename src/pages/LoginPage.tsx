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

  if (isAuthenticated) {
    navigate('/', { replace: true });
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

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[hsl(215,75%,25%)] via-[hsl(215,70%,35%)] to-[hsl(200,60%,25%)]">
      {/* Header banner - YS-Smart style */}
      <header className="h-20 px-6 flex items-center justify-between border-b border-white/20 bg-[hsl(215,60%,22%)]/95">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center font-bold text-white text-lg">
            YS
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            YS-Smart Guide
          </h1>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className={cn(
          'w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden transition-all duration-300',
          cardShake && 'animate-shake'
        )}>
          {/* Card header */}
          <div className="bg-[hsl(215,75%,32%)] px-8 py-6 text-white">
            <h2 className="text-2xl font-bold">YS-Smart</h2>
            <p className="text-sm text-white/80 mt-1">
              {language === 'vi' ? 'Hệ thống quản lý chấm công' : '글로벌 제조 실행 시스템'}
            </p>
          </div>

          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="py-3">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium">
                  {language === 'vi' ? 'ID' : '아이디'}
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder={language === 'vi' ? 'Nhập ID' : 'ID 입력'}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 h-11 border-2"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  {language === 'vi' ? 'Mật khẩu' : '비밀번호'}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder={language === 'vi' ? 'Nhập mật khẩu' : '비밀번호 입력'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 border-2"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Language selector - YS-Smart: Korea, Viet Nam */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  {language === 'vi' ? 'Ngôn ngữ' : '언어'}
                </Label>
                <Select value={language} onValueChange={(v) => setLanguage(v as 'vi' | 'ko')}>
                  <SelectTrigger className="h-11 border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vi">Viet Nam</SelectItem>
                    <SelectItem value="ko">Korea</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Local & Save ID - YS-Smart style */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={localMode}
                    onCheckedChange={(c) => setLocalMode(!!c)}
                    disabled={isLoading}
                  />
                  <span className="text-sm">Local</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={rememberMe}
                    onCheckedChange={(c) => setRememberMe(!!c)}
                    disabled={isLoading}
                  />
                  <span className="text-sm">{language === 'vi' ? 'Save ID' : 'ID 저장'}</span>
                </label>
              </div>

              {/* Login button - circular style as in YS-Smart */}
              <Button
                type="submit"
                className={cn(
                  'w-full h-12 text-base font-semibold bg-[hsl(215,75%,38%)] hover:bg-[hsl(215,75%,32%)]',
                  'rounded-lg transition-all duration-300',
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
                  'LOGIN'
                )}
              </Button>

              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-primary hover:underline mx-auto block"
              >
                {language === 'vi' ? 'Quên mật khẩu?' : '비밀번호 찾기'}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer - New Idea, NO.1 Production */}
      <footer className="py-4 text-center text-white/70 text-sm border-t border-white/10">
        New Idea, NO.1 Production
      </footer>

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

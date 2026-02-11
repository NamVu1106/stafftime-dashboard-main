import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Lock, User, KeyRound, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { authAPI } from '@/services/api';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotPasswordUsername, setForgotPasswordUsername] = useState('');
  const [isForgotPasswordLoading, setIsForgotPasswordLoading] = useState(false);
  const [resetResult, setResetResult] = useState<{ username?: string; newPassword: string; warning?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [cardShake, setCardShake] = useState(false);
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Load saved username from localStorage on mount
  useEffect(() => {
    const savedUsername = localStorage.getItem('remembered_username');
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  // Redirect to home if already authenticated
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
      
      // Save username to localStorage if remember me is checked
      if (rememberMe) {
        localStorage.setItem('remembered_username', username);
      } else {
        localStorage.removeItem('remembered_username');
      }
      
      // Success animation
      setIsSuccess(true);
      toast.success('Đăng nhập thành công!');
      
      // Fade out and navigate
      setTimeout(() => {
      navigate('/');
      }, 400);
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
      setCardShake(true);
      toast.error(err.message || 'Đăng nhập thất bại');
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
      toast.error('Vui lòng nhập tên đăng nhập');
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
      toast.error(err.message || 'Có lỗi xảy ra khi reset mật khẩu');
    } finally {
      setIsForgotPasswordLoading(false);
    }
  };

  const handleCopyPassword = () => {
    if (resetResult?.newPassword) {
      navigator.clipboard.writeText(resetResult.newPassword);
      setCopied(true);
      toast.success('Đã sao chép mật khẩu!');
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
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Main Layout - Desktop 2 Columns */}
      <div className="relative z-10 w-full flex min-h-screen">
        {/* Left Side - Branding & Illustration */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center px-12 xl:px-16 py-12 relative bg-gradient-to-br from-blue-600 via-blue-700 via-indigo-700 to-purple-800 dark:from-blue-800 dark:via-indigo-900 dark:to-slate-900 overflow-hidden">
          {/* Animated gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 animate-gradient-shift bg-[length:400%_400%]"></div>
          
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:40px_40px]"></div>
          
          {/* Decorative floating shapes */}
          <div className="absolute top-20 right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-20 left-10 w-80 h-80 bg-purple-300/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-1/4 w-48 h-48 bg-blue-300/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }}></div>
          
          <div className="w-full max-w-lg space-y-10 animate-fade-in-right relative z-10">
            {/* Logo/Brand */}
            <div className="space-y-6">
              <div className="mb-8 animate-fade-in-down">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/20 transition-all duration-300 hover:scale-110 hover:bg-white/30">
                    <Lock className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-3xl font-bold text-white bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                    StaffTime
                  </h1>
                </div>
              </div>
              
              <div className="space-y-4 animate-fade-in-down animate-delay-100">
                <h2 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight">
                  Quản lý chấm công
                  <br />
                  <span className="bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200 bg-clip-text text-transparent">
                    chuyên nghiệp
                  </span>
                </h2>
                <p className="text-lg text-blue-100 leading-relaxed">
                  Hệ thống quản lý chấm công nhân sự hiện đại, giúp bạn theo dõi và quản lý thời gian làm việc một cách hiệu quả và chính xác.
                </p>
              </div>
            </div>

            {/* Feature List - Enhanced with animations */}
            <div className="grid grid-cols-1 gap-4 pt-4">
              <div className="group flex items-start gap-3 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/15 hover:border-white/30 transition-all duration-300 hover:translate-x-2 animate-fade-in-up animate-delay-200">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400/30 to-blue-500/30 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">Dashboard trực quan</h3>
                  <p className="text-sm text-blue-100">Theo dõi thống kê và báo cáo theo thời gian thực</p>
                </div>
              </div>
              
              <div className="group flex items-start gap-3 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/15 hover:border-white/30 transition-all duration-300 hover:translate-x-2 animate-fade-in-up animate-delay-300">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400/30 to-purple-500/30 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">Quản lý nhân viên</h3>
                  <p className="text-sm text-blue-100">Quản lý thông tin và chấm công cho từng nhân viên</p>
                </div>
              </div>
              
              <div className="group flex items-start gap-3 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/15 hover:border-white/30 transition-all duration-300 hover:translate-x-2 animate-fade-in-up animate-delay-400">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-400/30 to-pink-500/30 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">Báo cáo đa dạng</h3>
                  <p className="text-sm text-blue-100">Xuất báo cáo theo ngày, tháng, năm và so sánh</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-12 xl:p-16 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:bg-slate-50 relative overflow-hidden">
          {/* Subtle decorative elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-100/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
          
          <div className="w-full max-w-lg relative z-10 animate-fade-in-left">
            <Card className={`bg-white/80 dark:bg-white backdrop-blur-sm border border-slate-200/50 shadow-xl shadow-slate-200/50 rounded-2xl ${cardShake ? 'animate-shake' : ''} ${isSuccess ? 'animate-fade-out' : ''} transition-all duration-300 hover:shadow-2xl hover:shadow-blue-200/30`}>
              <CardHeader className="space-y-1 pb-6 px-6 pt-6">
                <div className="mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg mb-4 transition-all duration-300 hover:scale-110 hover:rotate-3">
                    <Lock className="w-8 h-8 text-white" />
                  </div>
                </div>
                <CardTitle className="text-3xl font-bold text-slate-900 mb-2">
                  Đăng nhập
                </CardTitle>
                <CardDescription className="text-base text-slate-600">
            Nhập thông tin đăng nhập để truy cập hệ thống
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="animate-fade-in-down border-2 border-destructive/50 shadow-lg py-4">
                <AlertDescription className="font-semibold text-base">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2 animate-fade-in-up animate-delay-200">
              <Label htmlFor="username" className="text-sm font-semibold text-slate-700">Tên đăng nhập</Label>
              <div className="relative group">
                <div className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 transition-all duration-300 z-10 ${
                  focusedField === 'username' ? 'text-blue-600 scale-110' : 'text-slate-400 group-hover:text-blue-500'
                }`}>
                  <User className="w-full h-full" />
                </div>
                <Input
                  id="username"
                  type="text"
                  placeholder="Nhập tên đăng nhập"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  className={`pl-12 h-12 bg-slate-50 border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 hover:border-slate-300 ${
                    focusedField === 'username' ? 'border-blue-500 shadow-lg shadow-blue-500/10' : ''
                  }`}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2 animate-fade-in-up animate-delay-300">
              <Label htmlFor="password" className="text-sm font-semibold text-slate-700">Mật khẩu</Label>
              <div className="relative group">
                <div className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 transition-all duration-300 z-10 ${
                  focusedField === 'password' ? 'text-blue-600 scale-110' : 'text-slate-400 group-hover:text-blue-500'
                }`}>
                  <Lock className="w-full h-full" />
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  className={`pl-12 h-12 bg-slate-50 border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 hover:border-slate-300 ${
                    focusedField === 'password' ? 'border-blue-500 shadow-lg shadow-blue-500/10' : ''
                  }`}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 animate-fade-in-up animate-delay-350">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  disabled={isLoading}
                  className="transition-all duration-300 data-[state=checked]:scale-110"
                />
                <Label
                  htmlFor="remember"
                  className="text-sm font-medium cursor-pointer select-none text-slate-700 hover:text-slate-900 transition-colors"
                >
                  Nhớ mật khẩu
                </Label>
              </div>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-all duration-300 hover:underline relative group"
              >
                Quên mật khẩu?
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
              </button>
            </div>

            <Button
              type="submit"
              className="w-full mt-6 h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 hover:scale-[1.02] animate-fade-in-up animate-delay-400 relative overflow-hidden group"
              disabled={isLoading}
            >
              <span className="relative z-10 flex items-center justify-center">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang đăng nhập...
                </>
              ) : (
                  <>
                    Đăng nhập
                    <svg className="ml-2 w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center text-xs text-muted-foreground">
            <p>© 2025 StaffTime Dashboard. All rights reserved.</p>
          </div>
        </CardContent>
      </Card>

      {/* Forgot Password Dialog */}
      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Quên mật khẩu
            </DialogTitle>
            <DialogDescription>
              Nhập tên đăng nhập để reset mật khẩu về mặc định
            </DialogDescription>
          </DialogHeader>

          {!resetResult ? (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-username">Tên đăng nhập</Label>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 transition-colors duration-200 group-focus-within:text-primary" />
                  <Input
                    id="forgot-username"
                    type="text"
                    placeholder="Nhập tên đăng nhập"
                    value={forgotPasswordUsername}
                    onChange={(e) => setForgotPasswordUsername(e.target.value)}
                    className="pl-10 transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={isForgotPasswordLoading || !forgotPasswordUsername.trim()}
                >
                  {isForgotPasswordLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    'Reset mật khẩu'
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Mật khẩu đã được reset thành công!
                </AlertDescription>
              </Alert>

              <div className="space-y-2 p-4 bg-muted rounded-lg border-2 border-border">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Tên đăng nhập:</Label>
                  <span className="font-mono text-sm">{resetResult.username || forgotPasswordUsername}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Mật khẩu mới:</Label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-primary">{resetResult.newPassword}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleCopyPassword}
                      title="Sao chép mật khẩu"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-success" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
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
                <Button
                  type="button"
                  onClick={handleCloseForgotPassword}
                  className="w-full"
                >
                  Đóng
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;


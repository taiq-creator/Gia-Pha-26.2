import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Mail, Lock, Eye, EyeOff, LogIn, UserPlus, KeyRound, ArrowLeft, CheckCircle, ShieldCheck, Users } from 'lucide-react';

type AuthMode = 'login' | 'register' | 'forgot';

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccessMsg('');
    setShowPassword(false);
  };

  const switchMode = (newMode: AuthMode) => {
    resetForm();
    setMode(newMode);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('Email hoặc mật khẩu không đúng.');
      } else if (error.message.includes('Email not confirmed')) {
        setError('Vui lòng xác nhận email trước khi đăng nhập. Kiểm tra hộp thư của bạn.');
      } else {
        setError('Đăng nhập thất bại. Vui lòng thử lại.');
      }
    }
    setIsLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      if (error.message.includes('already registered')) {
        setError('Email này đã được đăng ký. Vui lòng đăng nhập.');
      } else {
        setError('Đăng ký thất bại. Vui lòng thử lại.');
      }
    } else {
      setSuccessMsg('Đăng ký thành công! Kiểm tra email để xác nhận tài khoản, sau đó đăng nhập.');
    }
    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) {
      setError('Gửi email thất bại. Vui lòng kiểm tra địa chỉ email.');
    } else {
      setSuccessMsg('Đã gửi link đặt lại mật khẩu! Kiểm tra hộp thư (kể cả thư mục spam).');
    }
    setIsLoading(false);
  };

  return (
    <div className="bg-[#0a192f] flex items-center justify-center p-4" style={{ minHeight: '100dvh' }}>
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `repeating-linear-gradient(45deg, #b48a28 0, #b48a28 1px, transparent 0, transparent 50%)`,
        backgroundSize: '20px 20px'
      }}></div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white tracking-[0.3em] uppercase drop-shadow-2xl">
            GIA PHẢ HỌ CAO
          </h1>
          <p className="text-[#b48a28] text-sm mt-2 tracking-widest uppercase font-medium">
            Lưu giữ ký ức dòng họ
          </p>
        </div>

        {/* Phân quyền info — chỉ hiện ở trang login */}
        {mode === 'login' && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-400 text-[10px] font-bold uppercase tracking-wide">Admin</p>
                <p className="text-white/60 text-[10px] mt-0.5">Toàn quyền thêm, sửa, xóa thành viên</p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-start gap-2">
              <Users className="h-4 w-4 text-white/50 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-wide">Thành viên</p>
                <p className="text-white/40 text-[10px] mt-0.5">Xem, thêm và sửa thành viên</p>
              </div>
            </div>
          </div>
        )}

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Card Header */}
          <div className="bg-[#b48a28] px-6 py-4 flex items-center gap-3">
            {mode !== 'login' && (
              <button
                onClick={() => switchMode('login')}
                className="text-white/80 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <h2 className="text-white font-bold text-base">
                {mode === 'login' && 'Đăng nhập'}
                {mode === 'register' && 'Tạo tài khoản mới'}
                {mode === 'forgot' && 'Quên mật khẩu'}
              </h2>
              <p className="text-white/70 text-[11px] mt-0.5">
                {mode === 'login' && 'Nhập thông tin để truy cập gia phả'}
                {mode === 'register' && 'Điền thông tin để đăng ký'}
                {mode === 'forgot' && 'Nhập email để nhận link đặt lại mật khẩu'}
              </p>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6">
            {/* Success */}
            {successMsg && (
              <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4 mb-5">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-700 font-medium">{successMsg}</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
                <p className="text-sm text-red-600 font-medium">{error}</p>
              </div>
            )}

            {/* LOGIN */}
            {mode === 'login' && !successMsg && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="example@email.com"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#b48a28] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">Mật khẩu</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Nhập mật khẩu"
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#b48a28] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-[11px] text-[#b48a28] hover:underline font-medium"
                  >
                    Quên mật khẩu?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#b48a28] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#9a7522] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-md"
                >
                  {isLoading
                    ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    : <><LogIn className="h-4 w-4" /> Đăng nhập</>
                  }
                </button>

                <div className="text-center pt-1">
                  <span className="text-[12px] text-gray-500">Chưa có tài khoản? </span>
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className="text-[12px] text-[#b48a28] font-bold hover:underline"
                  >
                    Đăng ký ngay
                  </button>
                </div>
              </form>
            )}

            {/* REGISTER */}
            {mode === 'register' && !successMsg && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-700 font-medium">
                  💡 Tài khoản mới sẽ có quyền <strong>xem, thêm và sửa</strong> thành viên gia phả.
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="example@email.com"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#b48a28] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">Mật khẩu</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Ít nhất 6 ký tự"
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#b48a28] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">Xác nhận mật khẩu</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#b48a28] transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#b48a28] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#9a7522] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-md"
                >
                  {isLoading
                    ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    : <><UserPlus className="h-4 w-4" /> Tạo tài khoản</>
                  }
                </button>

                <div className="text-center pt-1">
                  <span className="text-[12px] text-gray-500">Đã có tài khoản? </span>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="text-[12px] text-[#b48a28] font-bold hover:underline"
                  >
                    Đăng nhập
                  </button>
                </div>
              </form>
            )}

            {/* FORGOT PASSWORD */}
            {mode === 'forgot' && !successMsg && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">Email đăng ký</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="example@email.com"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#b48a28] transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#b48a28] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#9a7522] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-md"
                >
                  {isLoading
                    ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    : <><KeyRound className="h-4 w-4" /> Gửi link đặt lại mật khẩu</>
                  }
                </button>
              </form>
            )}

            {/* Back to login after success */}
            {successMsg && (
              <button
                onClick={() => switchMode('login')}
                className="w-full border border-[#b48a28] text-[#b48a28] py-3 rounded-xl font-bold text-sm hover:bg-[#b48a28] hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Quay lại đăng nhập
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-white/30 text-[11px] mt-6">
          © {new Date().getFullYear()} Gia Phả Họ Cao
        </p>
      </div>
    </div>
  );
}

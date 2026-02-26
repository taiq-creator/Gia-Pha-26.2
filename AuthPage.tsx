import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Mail, Lock, Eye, EyeOff, LogIn, UserPlus, KeyRound, ArrowLeft, CheckCircle } from 'lucide-react';

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
      setSuccessMsg('Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản, sau đó đăng nhập.');
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
      setSuccessMsg('Đã gửi link đặt lại mật khẩu! Kiểm tra hộp thư của bạn (kể cả thư mục spam).');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a192f] flex items-center justify-center p-4">
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
            {/* Success Message */}
            {successMsg && (
              <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4 mb-5">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-700 font-medium">{successMsg}</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
                <p className="text-sm text-red-600 font-medium">{error}</p>
              </div>
            )}

            {/* LOGIN FORM */}
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
                  className="w-full bg-[#b48a28] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#9a7522] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" />
                      Đăng nhập
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
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

            {/* REGISTER FORM */}
            {mode === 'register' && !successMsg && (
              <form onSubmit={handleRegister} className="space-y-4">
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
                  className="w-full bg-[#b48a28] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#9a7522] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Tạo tài khoản
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
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

            {/* FORGOT PASSWORD FORM */}
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
                  className="w-full bg-[#b48a28] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#9a7522] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      Gửi link đặt lại mật khẩu
                    </>
                  )}
                </button>
              </form>
            )}

            {/* After success - back to login */}
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

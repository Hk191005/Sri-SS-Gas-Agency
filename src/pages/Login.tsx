import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AgencyLogo } from '../components/branding/AgencyLogo';
import { AGENCY_BRANDING } from '../lib/constants';
import { Lock, Mail, ShieldCheck, AlertCircle, Eye, EyeOff, CheckCircle2, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please provide both your Email Address and Password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await login(email.trim(), password);
      if (!res.error) {
        navigate('/');
      } else {
        setError(res.error || 'Invalid login credentials. Please check your email and password.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your administrator email address.');
      return;
    }

    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);

    try {
      const res = await resetPassword(forgotEmail.trim());
      if (res.error) {
        setForgotError(res.error);
      } else {
        setForgotSuccess(res.success || 'Password recovery instructions have been sent to your email.');
      }
    } catch (err: any) {
      setForgotError(err.message || 'Failed to trigger password recovery.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen app-ambient-bg flex items-center justify-center p-4 antialiased font-sans">
      <div className="w-full max-w-md space-y-6">
        {/* Floating Authentication Card */}
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-8 rounded-2xl shadow-xl space-y-6">
          {/* Header & Logo */}
          <div className="text-center space-y-3">
            <div className="flex justify-center mb-2">
              <AgencyLogo size="lg" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FFF1F2] dark:bg-red-950/30 border border-[#FECDD3] dark:border-red-900/40 rounded-full text-[11px] font-black text-[#C9151C] dark:text-red-400">
              <ShieldCheck className="w-3.5 h-3.5 text-[#E31B23]" />
              <span>AUTHORIZED ADMIN ACCESS ONLY</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#111111] dark:text-white tracking-tight">
              {AGENCY_BRANDING.NAME}
            </h1>
            <p className="text-xs font-bold text-[#525252] dark:text-[#A3A3A3]">
              Tiruppur District, Tamil Nadu
            </p>
          </div>

          {/* Error notification */}
          {error && (
            <div className="p-3.5 bg-[#FFF1F2] dark:bg-red-950/30 border border-[#FECDD3] dark:border-red-900/40 text-[#DC2626] dark:text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626]" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#737373] absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sshk5318@gmail.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4]">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotError(null);
                    setForgotSuccess(null);
                    setShowForgotModal(true);
                  }}
                  className="text-[11px] font-bold text-[#E31B23] hover:underline focus:outline-none"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#737373] absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 p-1 text-[#737373] hover:text-[#111111] dark:hover:text-white focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-[#525252] dark:text-[#A3A3A3]" />
                  ) : (
                    <Eye className="w-4 h-4 text-[#525252] dark:text-[#A3A3A3]" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#E31B23] hover:bg-[#C9151C] active:bg-[#A90F16] text-white text-xs font-black rounded-[12px] shadow-[0_6px_18px_rgba(227,27,35,0.14)] transition-all active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Management System</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Administrator Accounts Reference */}
          <div className="pt-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A] text-center space-y-1">
            <p className="text-[11px] font-bold text-[#737373]">
              Authorized Accounts:
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-[10px] font-mono text-[#525252] dark:text-[#A3A3A3]">
              <span className="bg-[#F8FAFC] dark:bg-[#1F1F1F] px-2 py-0.5 rounded border border-[#E5E7EB] dark:border-[#2A2A2A]">
                sshk5318@gmail.com (Harikanth)
              </span>
              <span className="bg-[#F8FAFC] dark:bg-[#1F1F1F] px-2 py-0.5 rounded border border-[#E5E7EB] dark:border-[#2A2A2A]">
                selvarajkm33@gmail.com (Selvaraj)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs backdrop-enter">
          <div className="bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 modal-enter">
            <div className="space-y-1">
              <h2 className="text-base font-black text-[#111111] dark:text-white">
                Reset Administrator Password
              </h2>
              <p className="text-xs text-[#525252] dark:text-[#A3A3A3]">
                Enter your registered admin email. A secure password recovery link will be sent to your inbox.
              </p>
            </div>

            {forgotError && (
              <div className="p-3 bg-[#FFF1F2] border border-[#FECDD3] text-[#DC2626] rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626]" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="p-3 bg-[#F0FDF4] border border-emerald-200 text-[#16A34A] rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16A34A]" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {!forgotSuccess ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#737373] absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="sshk5318@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 text-xs font-bold text-[#525252] dark:text-[#A3A3A3] hover:bg-slate-100 dark:hover:bg-[#262626] rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-2 bg-[#E31B23] hover:bg-[#C9151C] text-white text-xs font-black rounded-xl transition-all disabled:opacity-50"
                  >
                    {forgotLoading ? 'Sending link...' : 'Send Recovery Link'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="px-4 py-2 bg-[#111111] dark:bg-white text-white dark:text-[#111111] text-xs font-black rounded-xl transition-all"
                >
                  Back to Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

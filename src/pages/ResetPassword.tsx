import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AgencyLogo } from '../components/branding/AgencyLogo';
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export const ResetPassword: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await updatePassword(newPassword);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess('Password updated successfully! Redirecting to Sign In...');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen app-ambient-bg flex items-center justify-center p-4 antialiased font-sans">
      <div className="w-full max-w-md space-y-6">
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-8 rounded-2xl shadow-xl space-y-6">
          <div className="text-center space-y-3">
            <div className="flex justify-center mb-2">
              <AgencyLogo size="lg" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FFF1F2] dark:bg-red-950/30 border border-[#FECDD3] dark:border-red-900/40 rounded-full text-[11px] font-black text-[#C9151C] dark:text-red-400">
              <ShieldCheck className="w-3.5 h-3.5 text-[#E31B23]" />
              <span>SECURITY RECOVERY</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#111111] dark:text-white tracking-tight">
              Create New Password
            </h1>
            <p className="text-xs text-[#525252] dark:text-[#A3A3A3]">
              Enter a secure new password for your SRI SS GAS AGENCY administrator account.
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-[#FFF1F2] dark:bg-red-950/30 border border-[#FECDD3] dark:border-red-900/40 text-[#DC2626] dark:text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626]" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 bg-[#F0FDF4] border border-emerald-200 text-[#16A34A] rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16A34A]" />
              <span>{success}</span>
            </div>
          )}

          {!success && (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#737373] absolute left-3.5 top-3" />
                  <input
                    type={showNew ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-10 pr-11 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
                  />
                  <button
                    type="button"
                    aria-label={showNew ? 'Hide password' : 'Show password'}
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-2.5 p-1 text-[#737373] hover:text-[#111111] dark:hover:text-white focus:outline-none"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#737373] absolute left-3.5 top-3" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full pl-10 pr-11 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
                  />
                  <button
                    type="button"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-2.5 p-1 text-[#737373] hover:text-[#111111] dark:hover:text-white focus:outline-none"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#E31B23] hover:bg-[#C9151C] active:bg-[#A90F16] text-white text-xs font-black rounded-[12px] shadow-[0_6px_18px_rgba(227,27,35,0.14)] transition-all active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? 'Updating Password...' : 'Save New Password & Sign In'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="text-center pt-2">
            <Link
              to="/login"
              className="text-xs font-bold text-[#525252] dark:text-[#A3A3A3] hover:text-[#E31B23]"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

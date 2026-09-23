import React from 'react';
import { Clock, ShieldAlert, LogOut, RefreshCw } from 'lucide-react';

interface SessionTimeoutWarningProps {
  isOpen: boolean;
  remainingSeconds: number;
  onContinue: () => void;
  onLogout: () => void;
}

export const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({
  isOpen,
  remainingSeconds,
  onContinue,
  onLogout,
}) => {
  if (!isOpen) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-warning-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs backdrop-enter"
    >
      <div className="bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 text-center modal-enter">
        {/* Warning Icon Badge */}
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
          <Clock className="w-7 h-7 stroke-[2.2] animate-pulse" />
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h3
            id="session-warning-title"
            className="text-lg font-black text-[#171717] dark:text-white tracking-tight"
          >
            Your session is about to expire due to inactivity.
          </h3>
          <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4] leading-relaxed">
            For security, your active administrative session will automatically sign out to protect customer & business data.
          </p>
        </div>

        {/* Countdown Timer Display */}
        <div className="py-3 px-4 bg-[#FAFAFA] dark:bg-[#222222] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl flex items-center justify-center gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-500" />
          <div className="text-left">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#737373] block">
              Auto-Logout In
            </span>
            <span className="text-xl font-mono font-black text-[#E31B23]">
              {formattedTime}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            onClick={onContinue}
            className="w-full sm:flex-1 flex items-center justify-center gap-2 bg-[#E31B23] hover:bg-[#C9151C] text-white font-black text-xs py-3 px-4 rounded-xl shadow-[0_6px_18px_rgba(227,27,35,0.2)] transition-all active:scale-98"
          >
            <RefreshCw className="w-4 h-4" />
            Continue Session
          </button>
          <button
            onClick={onLogout}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-transparent hover:bg-[#F5F5F5] dark:hover:bg-[#262626] text-[#525252] dark:text-[#D4D4D4] font-bold text-xs py-3 px-4 rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            Log Out Now
          </button>
        </div>
      </div>
    </div>
  );
};

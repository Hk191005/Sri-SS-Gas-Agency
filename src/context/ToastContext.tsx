import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, title?: string) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const lastToastRef = useRef<{ message: string; timestamp: number }>({ message: '', timestamp: 0 });

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', title?: string) => {
      if (!message) return;

      // Duplicate submission / message throttling within 1.2s
      const now = Date.now();
      if (lastToastRef.current.message === message && now - lastToastRef.current.timestamp < 1200) {
        return;
      }
      lastToastRef.current = { message, timestamp: now };

      const id = `toast-${now}-${Math.random().toString(36).substring(2, 6)}`;
      const newToast: ToastItem = { id, type, title, message };

      setToasts((prev) => [...prev.slice(-4), newToast]); // Keep max 5 toasts

      const duration = type === 'success' ? 3500 : type === 'error' ? 5500 : 4000;
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    },
    [dismissToast]
  );

  const showSuccess = useCallback(
    (message: string, title?: string) => showToast(message, 'success', title || 'Success'),
    [showToast]
  );

  const showError = useCallback(
    (message: string, title?: string) => showToast(message, 'error', title || 'Error'),
    [showToast]
  );

  const showInfo = useCallback(
    (message: string, title?: string) => showToast(message, 'info', title || 'Notice'),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showInfo, dismissToast }}>
      {children}

      {/* Global Toast Viewport */}
      <div
        aria-live="polite"
        role="status"
        className="fixed bottom-4 right-4 left-4 sm:left-auto sm:right-6 sm:bottom-6 z-9999 flex flex-col gap-2.5 pointer-events-none max-w-sm w-full"
      >
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-xl backdrop-blur-md transition-all toast-enter ${
                isSuccess
                  ? 'bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                  : isError
                  ? 'bg-red-50/95 dark:bg-red-950/90 border-red-300 dark:border-red-800 text-red-900 dark:text-red-100'
                  : 'bg-white/95 dark:bg-[#1C1C1C]/90 border-[#E5E5E5] dark:border-[#333333] text-[#171717] dark:text-white'
              }`}
            >
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 animate-in zoom-in-75 duration-200" />}
              {isError && <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5 animate-in zoom-in-75 duration-200" />}
              {!isSuccess && !isError && <Info className="w-5 h-5 text-[#E31B23] shrink-0 mt-0.5 animate-in zoom-in-75 duration-200" />}

              <div className="flex-1 min-w-0 pr-1">
                {toast.title && <p className="text-xs font-black tracking-tight">{toast.title}</p>}
                <p className="text-xs font-semibold leading-relaxed break-words">{toast.message}</p>
              </div>

              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Close notification"
                className="min-w-[44px] min-h-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-xl text-current opacity-70 hover:opacity-100 transition-opacity active:scale-95 btn-press focus:outline-hidden"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

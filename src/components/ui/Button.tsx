import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none focus:ring-2 focus:ring-[#E31B23]/40 btn-press disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 cursor-pointer select-none';

  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5 min-h-[36px] gap-1.5',
    md: 'text-xs px-4 py-2.5 min-h-[40px] sm:min-h-[44px] gap-2',
    lg: 'text-sm px-5 py-3 min-h-[48px] gap-2.5',
  };

  const variantClasses = {
    primary: 'bg-[#E31B23] hover:bg-[#C9151C] active:bg-[#A90F16] text-white font-extrabold shadow-[0_4px_14px_rgba(227,27,35,0.18)]',
    secondary: 'bg-white dark:bg-[#1F1F1F] hover:bg-[#FAFAFA] dark:hover:bg-[#262626] text-[#171717] dark:text-white border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-2xs',
    outline: 'bg-transparent hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F] text-[#171717] dark:text-white border border-[#E5E5E5] dark:border-[#2A2A2A]',
    ghost: 'bg-transparent hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F] text-[#525252] dark:text-[#D4D4D4]',
    danger: 'bg-[#DC2626] hover:bg-red-700 active:bg-red-800 text-white shadow-2xs',
    success: 'bg-[#16A34A] hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-2xs',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : icon ? <span className="shrink-0">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
};

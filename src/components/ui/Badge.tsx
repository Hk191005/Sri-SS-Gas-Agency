import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'slate' | 'emerald' | 'amber' | 'red' | 'sky' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'brand',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
  };

  const variantClasses = {
    brand: 'bg-[#FFF1F2] dark:bg-red-950/40 text-[#C9151C] dark:text-red-400 border border-[#FECDD3] dark:border-red-900/50',
    success: 'bg-[#ECFDF5] dark:bg-emerald-950/40 text-[#059669] dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/50',
    warning: 'bg-[#FFFBEB] dark:bg-amber-950/40 text-[#D97706] dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/50',
    danger: 'bg-[#FFF1F2] dark:bg-red-950/40 text-[#DC2626] dark:text-red-400 border border-[#FECDD3] dark:border-red-900/50',
    info: 'bg-[#EEF2FF] dark:bg-indigo-950/40 text-[#4F46E5] dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-900/50',
    purple: 'bg-[#F5F3FF] dark:bg-purple-950/40 text-[#7C3AED] dark:text-purple-400 border border-purple-200/60 dark:border-purple-900/50',
    slate: 'bg-[#F8FAFC] dark:bg-[#1F1F1F] text-[#525252] dark:text-[#D4D4D4] border border-[#E5E7EB] dark:border-[#2A2A2A]',
    emerald: 'bg-[#ECFDF5] dark:bg-emerald-950/40 text-[#059669] dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/50',
    amber: 'bg-[#FFFBEB] dark:bg-amber-950/40 text-[#D97706] dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/50',
    red: 'bg-[#FFF1F2] dark:bg-red-950/40 text-[#DC2626] dark:text-red-400 border border-[#FECDD3] dark:border-red-900/50',
    sky: 'bg-[#ECFEFF] dark:bg-cyan-950/40 text-[#0891B2] dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-900/50',
  };

  return (
    <span className={`inline-flex items-center font-extrabold rounded-full ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  variant?: 'brand' | 'green' | 'orange' | 'danger' | 'info' | 'blue' | 'cyan' | 'purple' | 'red';
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = 'brand',
  className = '',
}) => {
  const iconBgClasses: Record<string, string> = {
    brand: 'bg-[#FFF1F2] dark:bg-red-950/40 text-[#E31B23] border border-[#FECDD3] dark:border-red-900/40',
    red: 'bg-[#FFF1F2] dark:bg-red-950/40 text-[#E31B23] border border-[#FECDD3] dark:border-red-900/40',
    green: 'bg-[#ECFDF5] dark:bg-emerald-950/40 text-[#059669] border border-emerald-200/60 dark:border-emerald-900/40',
    orange: 'bg-[#FFFBEB] dark:bg-amber-950/40 text-[#D97706] border border-amber-200/60 dark:border-amber-900/40',
    danger: 'bg-[#FFF1F2] dark:bg-red-950/40 text-[#DC2626] border border-[#FECDD3] dark:border-red-900/40',
    info: 'bg-[#EEF2FF] dark:bg-indigo-950/40 text-[#4F46E5] border border-indigo-200/60 dark:border-indigo-900/40',
    blue: 'bg-[#EEF2FF] dark:bg-indigo-950/40 text-[#4F46E5] border border-indigo-200/60 dark:border-indigo-900/40',
    cyan: 'bg-[#ECFEFF] dark:bg-cyan-950/40 text-[#0891B2] border border-cyan-200/60 dark:border-cyan-900/40',
    purple: 'bg-[#F5F3FF] dark:bg-purple-950/40 text-[#7C3AED] border border-purple-200/60 dark:border-purple-900/40',
  };

  return (
    <div className={`saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl p-5 relative flex flex-col justify-between ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-[#525252] dark:text-[#A3A3A3]">{title}</p>
          <div className="text-2xl sm:text-3xl font-black text-[#111111] dark:text-white mt-1 tracking-tight">{value}</div>
        </div>

        {icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${iconBgClasses[variant] || iconBgClasses.brand}`}>
            {icon}
          </div>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="flex items-center justify-between text-xs pt-2.5 border-t border-[#F1F5F9] dark:border-[#262626]">
          {subtitle && <span className="font-semibold text-[#737373] dark:text-[#737373]">{subtitle}</span>}

          {trend && (
            <span
              className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[11px] ${
                trend.isPositive
                  ? 'bg-[#ECFDF5] text-[#059669] border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900'
                  : 'bg-[#FFF1F2] text-[#DC2626] border border-[#FECDD3] dark:bg-red-950/40 dark:text-red-400 dark:border-red-900'
              }`}
            >
              {trend.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{trend.value}% {trend.label}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

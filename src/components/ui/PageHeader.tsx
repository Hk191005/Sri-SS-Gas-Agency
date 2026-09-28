import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  icon,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-black text-[#111111] dark:text-white tracking-tight flex items-center gap-2.5">
          {icon && (
            <span className="w-9 h-9 rounded-xl bg-[#FFF1F2] dark:bg-red-950/40 text-[#E31B23] border border-[#FECDD3]/60 dark:border-red-900/40 flex items-center justify-center shrink-0 shadow-2xs">
              {icon}
            </span>
          )}
          <span>{title}</span>
        </h1>
        {subtitle && (
          <p className="text-xs font-semibold text-[#525252] dark:text-[#A3A3A3] mt-1 tracking-normal">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  );
};


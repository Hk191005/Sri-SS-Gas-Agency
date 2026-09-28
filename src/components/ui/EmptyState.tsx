import React from 'react';
import { PackageOpen } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
}) => {
  return (
    <div className="py-12 px-4 text-center space-y-3 animate-card-enter">
      <div className="w-12 h-12 rounded-2xl bg-[#FFF1F2] dark:bg-red-950/40 text-[#E31B23] flex items-center justify-center mx-auto border border-[#FECDD3]/60 dark:border-red-900/40 shadow-2xs">
        {icon || <PackageOpen className="w-6 h-6" />}
      </div>
      <h3 className="text-sm font-black text-[#111111] dark:text-white tracking-tight">{title}</h3>
      {description && <p className="text-xs font-semibold text-[#525252] dark:text-[#A3A3A3] max-w-sm mx-auto leading-relaxed">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};


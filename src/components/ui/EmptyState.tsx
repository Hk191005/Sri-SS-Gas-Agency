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
    <div className="py-12 px-4 text-center space-y-3">
      <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] dark:bg-indigo-950/40 text-[#4F46E5] flex items-center justify-center mx-auto border border-indigo-200/60 dark:border-indigo-900/40">
        {icon || <PackageOpen className="w-6 h-6" />}
      </div>
      <h3 className="text-sm font-black text-[#172033] dark:text-white">{title}</h3>
      {description && <p className="text-xs font-semibold text-[#64748B] dark:text-slate-400 max-w-sm mx-auto">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};

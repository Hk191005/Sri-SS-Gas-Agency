import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, Laptop } from 'lucide-react';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, setTheme } = useTheme();

  return (
    <div className={`inline-flex items-center bg-[#F8FAFC] dark:bg-[#1F1F1F] border border-[#E5E7EB] dark:border-[#2A2A2A] p-1 rounded-xl shadow-xs ${className}`}>
      <button
        onClick={() => setTheme('light')}
        title="Light Mode"
        className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
          theme === 'light'
            ? 'bg-[#FFF1F2] dark:bg-[#262626] text-[#E31B23] shadow-xs border border-[#FECDD3] dark:border-[#3A3A3A]'
            : 'text-[#737373] dark:text-[#A3A3A3] hover:text-[#111111] dark:hover:text-white'
        }`}
      >
        <Sun className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        title="Dark Mode"
        className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
          theme === 'dark'
            ? 'bg-[#FFF1F2] dark:bg-[#262626] text-[#E31B23] shadow-xs border border-[#FECDD3] dark:border-[#3A3A3A]'
            : 'text-[#737373] dark:text-[#A3A3A3] hover:text-[#111111] dark:hover:text-white'
        }`}
      >
        <Moon className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => setTheme('system')}
        title="System Preference"
        className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
          theme === 'system'
            ? 'bg-[#FFF1F2] dark:bg-[#262626] text-[#E31B23] shadow-xs border border-[#FECDD3] dark:border-[#3A3A3A]'
            : 'text-[#737373] dark:text-[#A3A3A3] hover:text-[#111111] dark:hover:text-white'
        }`}
      >
        <Laptop className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, Laptop } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  variant?: 'segmented' | 'compact';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', variant = 'segmented' }) => {
  const { theme, setTheme } = useTheme();

  if (variant === 'compact') {
    const handleToggle = () => {
      if (theme === 'light') {
        setTheme('dark');
      } else {
        setTheme('light');
      }
    };

    return (
      <button
        onClick={handleToggle}
        className={`w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-xl text-[#525252] dark:text-[#D4D4D4] hover:bg-[#F8FAFC] dark:hover:bg-[#1F1F1F] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E31B23] ${className}`}
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {theme === 'dark' ? (
          <Sun className="w-5 h-5 text-[#E31B23]" />
        ) : (
          <Moon className="w-5 h-5 text-[#525252] dark:text-[#D4D4D4]" />
        )}
      </button>
    );
  }

  return (
    <div className={`inline-flex items-center bg-[#F8FAFC] dark:bg-[#1F1F1F] border border-[#E5E7EB] dark:border-[#2A2A2A] p-1 rounded-xl shadow-xs ${className}`}>
      <button
        onClick={() => setTheme('light')}
        title="Light Mode"
        aria-label="Switch to Light Mode"
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
        aria-label="Switch to Dark Mode"
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
        aria-label="Switch to System Theme"
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

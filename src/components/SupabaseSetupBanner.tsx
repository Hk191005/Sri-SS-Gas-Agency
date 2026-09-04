import React from 'react';
import { Database, AlertTriangle, Key, Terminal, ExternalLink } from 'lucide-react';
import { isSupabaseConfigured, isMockModeAllowed } from '../lib/supabase';

export const SupabaseSetupBanner: React.FC = () => {
  const isConfigured = isSupabaseConfigured();
  const isMock = isMockModeAllowed();

  if (isConfigured) return null;

  if (isMock) {
    return (
      <div className="bg-[#FFFBEB] dark:bg-amber-950/40 text-[#D97706] dark:text-amber-300 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs border-b border-[#FDE68A] dark:border-amber-900/40">
        <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
          <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0" />
          <span>
            DEVELOPMENT MOCK MODE ENABLED (<code className="bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded font-mono">VITE_ENABLE_MOCK_DATA=true</code>). Data is stored locally in browser sandbox memory.
          </span>
        </div>
      </div>
    );
  }

  // Supabase Configuration Required Screen
  return (
    <div className="min-h-screen bg-white dark:bg-[#111111] text-[#171717] dark:text-white flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[#F1F1F1] dark:border-[#262626] pb-4">
          <div className="w-12 h-12 rounded-xl bg-[#FFF1F2] dark:bg-red-950/30 text-[#E31B23] border border-[#FFD6D8] dark:border-red-900/40 flex items-center justify-center shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#171717] dark:text-white">SRI SS GAS AGENCY</h1>
            <p className="text-xs text-[#E31B23] font-bold">Supabase Production Database Setup Required</p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-[#525252] dark:text-[#D4D4D4]">
          <div className="p-3.5 bg-[#FFF1F2] dark:bg-red-950/30 border border-[#FFD6D8] dark:border-red-900/40 rounded-xl text-[#DC2626] dark:text-red-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
            <p>
              <strong>Production Guard:</strong> Supabase environment variables (<code className="font-mono text-[#DC2626]">VITE_SUPABASE_URL</code> & <code className="font-mono text-[#DC2626]">VITE_SUPABASE_ANON_KEY</code>) are missing. Silent fallback to local storage has been strictly disabled for data safety.
            </p>
          </div>

          <h3 className="font-black text-[#171717] dark:text-white uppercase tracking-wider text-[11px] pt-2">Quick Configuration Steps:</h3>

          <ol className="space-y-2.5 list-decimal pl-4">
            <li>
              Create or open your project at{' '}
              <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-[#E31B23] underline font-bold inline-flex items-center gap-1">
                supabase.com <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>
              Copy your Project URL and anon public API key into your project root <code className="bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#171717] dark:text-white px-1.5 py-0.5 rounded font-mono border border-[#E5E5E5] dark:border-[#2A2A2A]">.env</code> file:
              <div className="mt-1.5 p-3 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] font-mono text-[11px] text-[#16A34A] space-y-1 overflow-x-auto">
                <p>VITE_SUPABASE_URL=https://your-project.supabase.co</p>
                <p>VITE_SUPABASE_ANON_KEY=your-anon-key</p>
              </div>
            </li>
            <li>
              Run the SQL migration script in your Supabase SQL Editor:
              <div className="mt-1.5 p-2.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#171717] dark:text-white font-mono text-[11px] flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#E31B23] shrink-0" />
                <span className="truncate">supabase/migrations/20260828000000_initial_schema.sql</span>
              </div>
            </li>
          </ol>

          <div className="pt-4 border-t border-[#F1F1F1] dark:border-[#262626] text-[11px] text-[#737373] flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-[#D97706]" /> Need local sandbox mode for testing?
            </span>
            <span className="font-mono text-[#171717] dark:text-white font-bold">VITE_ENABLE_MOCK_DATA=true</span>
          </div>
        </div>
      </div>
    </div>
  );
};

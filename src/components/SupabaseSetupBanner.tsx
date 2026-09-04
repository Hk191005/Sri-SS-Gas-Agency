import React from 'react';
import { Database, AlertTriangle, Terminal, ExternalLink } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

export const SupabaseSetupBanner: React.FC = () => {
  const isConfigured = isSupabaseConfigured();

  if (isConfigured) return null;

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
              <strong>Production Guard:</strong> Supabase environment variables (<code className="font-mono text-[#DC2626]">VITE_SUPABASE_URL</code> & <code className="font-mono text-[#DC2626]">VITE_SUPABASE_ANON_KEY</code>) are missing.
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
              Add your Project URL and anon public API key to your environment variables (<code className="bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#171717] dark:text-white px-1.5 py-0.5 rounded font-mono border border-[#E5E5E5] dark:border-[#2A2A2A]">.env</code> or Vercel Environment Variables):
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
        </div>
      </div>
    </div>
  );
};

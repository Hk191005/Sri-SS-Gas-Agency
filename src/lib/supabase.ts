import { createClient } from '@supabase/supabase-js';

// Read Vite client-side environment variables statically for guaranteed compile-time inlining on Vercel
const supabaseUrl: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.VITE_SUPABASE_URL) ||
  '';

const supabaseAnonKey: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.VITE_SUPABASE_ANON_KEY) ||
  '';

export class SupabaseNotConfiguredError extends Error {
  constructor(message?: string) {
    super(
      message ||
        'Supabase configuration missing. Production mode requires valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in environment variables. Set VITE_ENABLE_MOCK_DATA=true if explicitly testing in local dev sandbox.'
    );
    this.name = 'SupabaseNotConfiguredError';
  }
}

export const isSupabaseConfigured = (): boolean => {
  return (
    typeof supabaseUrl === 'string' &&
    supabaseUrl.trim().length > 0 &&
    !supabaseUrl.includes('your-supabase-project') &&
    !supabaseUrl.includes('your-project-id') &&
    typeof supabaseAnonKey === 'string' &&
    supabaseAnonKey.trim().length > 0 &&
    !supabaseAnonKey.includes('your-anon-key')
  );
};

export const isMockModeAllowed = (): boolean => {
  const mockVal =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ENABLE_MOCK_DATA) ||
    (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.VITE_ENABLE_MOCK_DATA) ||
    '';
  return String(mockVal) === 'true';
};

// Initialize Supabase Client
export const supabase = createClient(
  isSupabaseConfigured() ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured() ? supabaseAnonKey : 'placeholder-key'
);

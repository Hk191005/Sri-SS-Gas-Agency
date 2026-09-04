import { createClient } from '@supabase/supabase-js';

const getEnvVar = (key: string): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key] !== undefined) {
    return String((import.meta as any).env[key] || '');
  }
  const proc = typeof globalThis !== 'undefined' ? (globalThis as any).process : undefined;
  if (proc && proc.env && proc.env[key] !== undefined) {
    return String(proc.env[key] || '');
  }
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

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
    supabaseUrl.length > 0 &&
    !supabaseUrl.includes('your-supabase-project') &&
    typeof supabaseAnonKey === 'string' &&
    supabaseAnonKey.length > 0 &&
    !supabaseAnonKey.includes('your-anon-key')
  );
};

export const isMockModeAllowed = (): boolean => {
  return getEnvVar('VITE_ENABLE_MOCK_DATA') === 'true';
};

// Initialize Supabase Client
export const supabase = createClient(
  isSupabaseConfigured() ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured() ? supabaseAnonKey : 'placeholder-key'
);

import { createClient } from '@supabase/supabase-js';

// Direct static Vite environment variable access for client bundling
const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export class SupabaseNotConfiguredError extends Error {
  constructor(message?: string) {
    super(
      message ||
        'Supabase configuration missing. Production mode requires valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in environment variables.'
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

// Initialize Supabase Client
export const supabase = createClient(
  isSupabaseConfigured() ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured() ? supabaseAnonKey : 'placeholder-key'
);

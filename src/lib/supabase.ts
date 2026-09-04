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

/**
 * Resolves an environment-aware, production-safe redirect URL for Supabase Auth flows.
 * - Local development: Uses current localhost origin (e.g., http://localhost:5173 or http://localhost:3000)
 * - Production: Uses window.location.origin (e.g., https://sri-ss-gas-agency.vercel.app) or canonical production fallback
 */
export function getAuthRedirectUrl(path: string = '/reset-password'): string {
  const formattedPath = path.startsWith('/') ? path : `/${path}`;
  const canonicalProductionUrl = 'https://sri-ss-gas-agency.vercel.app';

  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    const hostname = window.location.hostname;

    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
      return `${origin}${formattedPath}`;
    }

    // Production or custom domain deployment
    return `${origin}${formattedPath}`;
  }

  // Fallback for non-browser execution
  return `${canonicalProductionUrl}${formattedPath}`;
}

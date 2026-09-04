import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured, isMockModeAllowed } from '../lib/supabase';
import { seedDemoDataIfEmpty } from '../lib/db';
import { AGENCY_BRANDING, formatUsernameToEmail } from '../lib/constants';

interface UserSession {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  isSupabaseActive: boolean;
  isMockActive: boolean;
  isPasswordRecovery: boolean;
  login: (emailInput: string, password?: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  resetPassword: (emailInput: string) => Promise<{ error?: string; success?: string }>;
  updatePassword: (newPassword: string) => Promise<{ error?: string; success?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  const isSupabaseActive = isSupabaseConfigured();
  const isMockActive = isMockModeAllowed();

  const resolveAdminProfile = (email: string) => {
    const lower = (email || '').toLowerCase();
    const profile = AGENCY_BRANDING.ADMIN_PROFILES[lower];
    if (profile) {
      return { fullName: profile.name, role: profile.role };
    }
    if (lower.includes('selvaraj')) {
      return { fullName: 'Selvaraj', role: 'Executive Administrator' };
    }
    if (lower.includes('harikanth') || lower.includes('sshk5318')) {
      return { fullName: 'Harikanth', role: 'Agency Owner / Admin' };
    }
    return { fullName: 'SRI SS GAS Admin', role: 'Administrator' };
  };

  useEffect(() => {
    if (isMockActive) {
      seedDemoDataIfEmpty();
    }

    const checkSession = async () => {
      if (isSupabaseActive) {
        // Check if current URL contains recovery hash or query
        if (
          window.location.hash.includes('type=recovery') ||
          window.location.search.includes('type=recovery') ||
          window.location.pathname === '/reset-password'
        ) {
          setIsPasswordRecovery(true);
        }

        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          const email = data.session.user.email || AGENCY_BRANDING.ADMIN_EMAIL;
          const { fullName, role } = resolveAdminProfile(email);
          setUser({
            id: data.session.user.id,
            username: email.split('@')[0],
            email,
            fullName,
            role,
          });
        } else {
          setUser(null);
        }
      } else if (isMockActive) {
        const stored = localStorage.getItem('srissgas_admin_session');
        if (stored) {
          try {
            setUser(JSON.parse(stored));
          } catch (e) {
            setUser(null);
          }
        } else {
          const defaultAdmin = {
            id: 'admin-owner-1',
            username: 'harikanth',
            email: 'sshk5318@gmail.com',
            fullName: 'Harikanth',
            role: 'Agency Owner / Admin',
          };
          localStorage.setItem('srissgas_admin_session', JSON.stringify(defaultAdmin));
          setUser(defaultAdmin);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    checkSession();

    if (isSupabaseActive) {
      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        }

        if (session?.user) {
          const email = session.user.email || AGENCY_BRANDING.ADMIN_EMAIL;
          const { fullName, role } = resolveAdminProfile(email);
          setUser({
            id: session.user.id,
            username: email.split('@')[0],
            email,
            fullName,
            role,
          });
        } else {
          setUser(null);
        }
      });
      return () => listener.subscription.unsubscribe();
    }
  }, [isSupabaseActive, isMockActive]);

  const login = async (emailInput: string, password?: string): Promise<{ error?: string }> => {
    setLoading(true);
    try {
      const mappedEmail = formatUsernameToEmail(emailInput);

      if (isSupabaseActive) {
        const { error } = await supabase.auth.signInWithPassword({
          email: mappedEmail,
          password: password || '',
        });
        if (error) {
          return { error: error.message };
        }
      } else if (isMockActive) {
        const { fullName, role } = resolveAdminProfile(mappedEmail);
        const adminSession = {
          id: 'admin-owner-1',
          username: mappedEmail.split('@')[0],
          email: mappedEmail,
          fullName,
          role,
        };
        localStorage.setItem('srissgas_admin_session', JSON.stringify(adminSession));
        setUser(adminSession);
      } else {
        return { error: 'Supabase is not configured. Please complete environment setup.' };
      }
      return {};
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (isSupabaseActive) {
      await supabase.auth.signOut();
    } else if (isMockActive) {
      localStorage.removeItem('srissgas_admin_session');
    }
    setUser(null);
    setIsPasswordRecovery(false);
  };

  const resetPassword = async (emailInput: string): Promise<{ error?: string; success?: string }> => {
    const mappedEmail = formatUsernameToEmail(emailInput);

    if (isSupabaseActive) {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(mappedEmail, {
        redirectTo: redirectUrl,
      });
      if (error) return { error: error.message };
      return { success: `Password recovery link sent to ${mappedEmail}. Check your inbox.` };
    }
    if (isMockActive) {
      return { success: `Mock recovery triggered for ${mappedEmail}.` };
    }
    return { error: 'Supabase database setup required.' };
  };

  const updatePassword = async (newPassword: string): Promise<{ error?: string; success?: string }> => {
    if (!newPassword || newPassword.length < 6) {
      return { error: 'Password must be at least 6 characters long.' };
    }

    if (isSupabaseActive) {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) return { error: error.message };
      setIsPasswordRecovery(false);
      return { success: 'Password updated successfully. You can now login with your new credentials.' };
    }

    if (isMockActive) {
      return { success: 'Password updated successfully (local sandbox).' };
    }

    return { error: 'Supabase database setup required.' };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isSupabaseActive,
        isMockActive,
        isPasswordRecovery,
        login,
        logout,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

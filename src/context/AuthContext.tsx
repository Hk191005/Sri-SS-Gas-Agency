import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured, getAuthRedirectUrl } from '../lib/supabase';
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
  }, [isSupabaseActive]);

  const login = async (emailInput: string, password?: string): Promise<{ error?: string }> => {
    setLoading(true);
    try {
      const mappedEmail = formatUsernameToEmail(emailInput);

      if (!isSupabaseActive) {
        return { error: 'Supabase is not configured. Please complete environment setup.' };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: mappedEmail,
        password: password || '',
      });
      if (error) {
        return { error: error.message };
      }
      return {};
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (isSupabaseActive) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setIsPasswordRecovery(false);
  };

  const resetPassword = async (emailInput: string): Promise<{ error?: string; success?: string }> => {
    const mappedEmail = formatUsernameToEmail(emailInput);

    if (!isSupabaseActive) {
      return { error: 'Supabase is not configured. Please complete environment setup.' };
    }

    const redirectUrl = getAuthRedirectUrl('/reset-password');
    const { error } = await supabase.auth.resetPasswordForEmail(mappedEmail, {
      redirectTo: redirectUrl,
    });
    if (error) return { error: error.message };
    return { success: `Password recovery link sent to ${mappedEmail}. Check your inbox.` };
  };

  const updatePassword = async (newPassword: string): Promise<{ error?: string; success?: string }> => {
    if (!newPassword || newPassword.length < 6) {
      return { error: 'Password must be at least 6 characters long.' };
    }

    if (!isSupabaseActive) {
      return { error: 'Supabase is not configured. Please complete environment setup.' };
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) return { error: error.message };
    setIsPasswordRecovery(false);
    await supabase.auth.signOut();
    setUser(null);
    return { success: 'Password updated successfully. You can now login with your new credentials.' };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isSupabaseActive,
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

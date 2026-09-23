import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured, getAuthRedirectUrl } from '../lib/supabase';
import { AGENCY_BRANDING, formatUsernameToEmail } from '../lib/constants';
import { SessionTimeoutWarning } from '../components/auth/SessionTimeoutWarning';

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
  resetInactivityTimer: () => void;
}

// 30 Minutes Default Inactivity Timeout (1800000 ms)
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
// Warning shows 2 minutes before logout (120000 ms)
const WARNING_LEAD_MS = 2 * 60 * 1000;
const STORAGE_ACTIVITY_KEY = 'srissgas_last_activity';
const STORAGE_LOGOUT_KEY = 'srissgas_session_logout';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  // Inactivity State
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(120);

  const lastActivityRef = useRef<number>(Date.now());
  const throttleRef = useRef<number>(0);

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

  const clearLocalAuth = () => {
    setUser(null);
    setIsPasswordRecovery(false);
    setShowWarningModal(false);
    try {
      localStorage.removeItem(STORAGE_ACTIVITY_KEY);
      localStorage.setItem(STORAGE_LOGOUT_KEY, Date.now().toString());
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      // Non-blocking
    }
  };

  const logout = useCallback(async () => {
    clearLocalAuth();
    try {
      if (isSupabaseActive) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {
          return supabase.auth.signOut();
        });
      }
    } catch (e) {
      console.warn('Supabase signOut warning:', e);
    }
  }, [isSupabaseActive]);

  const resetInactivityTimer = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    setShowWarningModal(false);
    try {
      localStorage.setItem(STORAGE_ACTIVITY_KEY, now.toString());
    } catch (e) {
      // Non-blocking
    }
  }, []);

  // Initial session check & auth listener
  useEffect(() => {
    const checkSession = async () => {
      // 1. Inactivity check before restoring session
      const storedActivity = localStorage.getItem(STORAGE_ACTIVITY_KEY);
      if (storedActivity) {
        const lastActive = parseInt(storedActivity, 10);
        if (!isNaN(lastActive) && Date.now() - lastActive >= DEFAULT_TIMEOUT_MS) {
          console.warn('Inactivity timeout elapsed while away. Signing out session...');
          clearLocalAuth();
          if (isSupabaseActive) {
            supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          }
          setLoading(false);
          return;
        }
      }

      if (isSupabaseActive) {
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
          resetInactivityTimer();
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

        if (event === 'SIGNED_OUT') {
          setUser(null);
          localStorage.removeItem(STORAGE_ACTIVITY_KEY);
          return;
        }

        if (session?.user) {
          if (event !== 'SIGNED_IN') {
            const currentActivity = localStorage.getItem(STORAGE_ACTIVITY_KEY);
            if (!currentActivity) {
              setUser(null);
              return;
            }
            const lastActive = parseInt(currentActivity, 10);
            if (!isNaN(lastActive) && Date.now() - lastActive >= DEFAULT_TIMEOUT_MS) {
              console.warn('Inactivity timeout elapsed during auth state event. Clearing session...');
              setUser(null);
              localStorage.removeItem(STORAGE_ACTIVITY_KEY);
              return;
            }
          }

          const email = session.user.email || AGENCY_BRANDING.ADMIN_EMAIL;
          const { fullName, role } = resolveAdminProfile(email);
          setUser({
            id: session.user.id,
            username: email.split('@')[0],
            email,
            fullName,
            role,
          });
          resetInactivityTimer();
        } else {
          setUser(null);
        }
      });
      return () => listener.subscription.unsubscribe();
    }
  }, [isSupabaseActive, resetInactivityTimer]);

  // Inactivity tracking & multi-tab synchronization
  useEffect(() => {
    if (!user) {
      setShowWarningModal(false);
      return;
    }

    // Record initial activity timestamp
    const initialActivity = Date.now();
    lastActivityRef.current = initialActivity;
    try {
      localStorage.setItem(STORAGE_ACTIVITY_KEY, initialActivity.toString());
    } catch (e) {}

    // Throttled activity handler for meaningful user interactions
    const handleUserActivity = () => {
      const now = Date.now();
      // Throttle activity updates to once every 3 seconds to avoid performance overhead
      if (now - throttleRef.current > 3000) {
        throttleRef.current = now;
        lastActivityRef.current = now;
        try {
          localStorage.setItem(STORAGE_ACTIVITY_KEY, now.toString());
        } catch (e) {}
        if (showWarningModal) {
          setShowWarningModal(false);
        }
      }
    };

    // Cross-tab synchronization via storage event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_ACTIVITY_KEY && e.newValue) {
        const remoteTime = parseInt(e.newValue, 10);
        if (!isNaN(remoteTime) && remoteTime > lastActivityRef.current) {
          lastActivityRef.current = remoteTime;
          setShowWarningModal(false);
        }
      } else if (e.key === STORAGE_LOGOUT_KEY) {
        // Another tab initiated logout
        setUser(null);
        setShowWarningModal(false);
      }
    };

    // Attach interaction listeners across desktop, tablet, and mobile
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }));
    window.addEventListener('storage', handleStorageChange);

    // Inactivity ticker checking every 1 second
    const interval = setInterval(() => {
      const now = Date.now();
      // Check if another tab recorded more recent activity
      try {
        const storedStr = localStorage.getItem(STORAGE_ACTIVITY_KEY);
        if (storedStr) {
          const storedTime = parseInt(storedStr, 10);
          if (!isNaN(storedTime) && storedTime > lastActivityRef.current) {
            lastActivityRef.current = storedTime;
          }
        }
      } catch (e) {}

      const elapsed = now - lastActivityRef.current;
      const timeoutThreshold = DEFAULT_TIMEOUT_MS;
      const warningThreshold = DEFAULT_TIMEOUT_MS - WARNING_LEAD_MS;

      if (elapsed >= timeoutThreshold) {
        // Timeout reached -> Auto logout
        console.warn('Inactivity timeout reached (30 mins). Signing out user...');
        clearInterval(interval);
        logout();
      } else if (elapsed >= warningThreshold) {
        // Warning threshold reached -> Show warning countdown modal
        const remaining = Math.max(0, Math.ceil((timeoutThreshold - elapsed) / 1000));
        setRemainingSeconds(remaining);
        setShowWarningModal(true);
      } else {
        setShowWarningModal(false);
      }
    }, 1000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleUserActivity));
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [user, logout, showWarningModal]);

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
      resetInactivityTimer();
      return {};
    } finally {
      setLoading(false);
    }
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
    await logout();
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
        resetInactivityTimer,
      }}
    >
      {children}

      {/* Global Inactivity Warning Modal */}
      <SessionTimeoutWarning
        isOpen={showWarningModal && !!user}
        remainingSeconds={remainingSeconds}
        onContinue={resetInactivityTimer}
        onLogout={logout}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

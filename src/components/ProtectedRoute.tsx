import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#111111] flex flex-col items-center justify-center text-[#171717] dark:text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#E5E5E5] dark:border-[#2A2A2A] border-b-[#E31B23] mb-4"></div>
        <p className="text-xs font-black tracking-wide text-[#525252] dark:text-[#D4D4D4]">Loading SRI SS GAS AGENCY...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

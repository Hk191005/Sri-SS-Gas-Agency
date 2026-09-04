import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { MobileNav } from './components/layout/MobileNav';
import { Loader2 } from 'lucide-react';

// Lazy Loaded Pages for Optimized Bundle Splitting
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Customers = lazy(() => import('./pages/Customers').then(m => ({ default: m.Customers })));
const CustomerProfile = lazy(() => import('./pages/CustomerProfile').then(m => ({ default: m.CustomerProfile })));
const Purchases = lazy(() => import('./pages/Purchases').then(m => ({ default: m.Purchases })));
const SupplierPurchases = lazy(() => import('./pages/SupplierPurchases').then(m => ({ default: m.SupplierPurchases })));
const Deliveries = lazy(() => import('./pages/Deliveries').then(m => ({ default: m.Deliveries })));
const Cylinders = lazy(() => import('./pages/Cylinders').then(m => ({ default: m.Cylinders })));
const Payments = lazy(() => import('./pages/Payments').then(m => ({ default: m.Payments })));
const Messages = lazy(() => import('./pages/Messages').then(m => ({ default: m.Messages })));
const Reports = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));

// Global Quick Action Modals
import { CustomerFormModal } from './components/customers/CustomerFormModal';
import { AddPurchaseModal } from './components/purchases/AddPurchaseModal';
import { AddPaymentModal } from './components/payments/AddPaymentModal';

const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[60vh] w-full text-slate-400">
    <div className="flex flex-col items-center gap-2">
      <Loader2 className="w-8 h-8 animate-spin text-[#E31B23]" />
      <span className="text-xs font-extrabold text-slate-500 tracking-wider uppercase">Loading Page...</span>
    </div>
  </div>
);

export const App: React.FC = () => {
  const [quickActionType, setQuickActionType] = useState<'customer' | 'purchase' | 'delivery' | 'payment' | null>(null);

  const handleOpenQuickAction = (type: 'customer' | 'purchase' | 'delivery' | 'payment') => {
    setQuickActionType(type);
  };

  const handleCloseQuickAction = () => {
    setQuickActionType(null);
  };

  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                <Route
                  element={
                  <ProtectedRoute>
                    <AppLayout onOpenQuickAction={handleOpenQuickAction} />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Dashboard onOpenQuickAction={handleOpenQuickAction} />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/:id" element={<CustomerProfile />} />
                <Route path="/purchases" element={<Purchases />} />
                <Route path="/supplier-purchases" element={<SupplierPurchases />} />
                <Route path="/deliveries" element={<Deliveries />} />
                <Route path="/cylinders" element={<Cylinders />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>

          {/* Mobile Compact Navigation Bar */}
          <MobileNav onOpenQuickAction={handleOpenQuickAction} />

          {/* Global Quick Action Modals */}
          <CustomerFormModal
            isOpen={quickActionType === 'customer'}
            onClose={handleCloseQuickAction}
            onSuccess={() => {
              handleCloseQuickAction();
              window.location.reload();
            }}
          />

          <AddPurchaseModal
            isOpen={quickActionType === 'purchase'}
            onClose={handleCloseQuickAction}
            onSuccess={() => {
              handleCloseQuickAction();
              window.location.reload();
            }}
          />

          <AddPaymentModal
            isOpen={quickActionType === 'payment'}
            onClose={handleCloseQuickAction}
            onSuccess={() => {
              handleCloseQuickAction();
              window.location.reload();
            }}
          />
        </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;

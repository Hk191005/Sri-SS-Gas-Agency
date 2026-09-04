import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { SupabaseSetupBanner } from '../SupabaseSetupBanner';
import { isSupabaseConfigured } from '../../lib/supabase';
import { AGENCY_BRANDING } from '../../lib/constants';
import { AgencyLogo } from '../branding/AgencyLogo';
import { ThemeToggle } from '../ThemeToggle';
import { GlobalSearchModal } from '../crm/GlobalSearchModal';
import { MobileNav } from './MobileNav';
import { CustomerFormModal } from '../customers/CustomerFormModal';
import { AddPurchaseModal } from '../purchases/AddPurchaseModal';
import { AddPaymentModal } from '../payments/AddPaymentModal';
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  Building2,
  Truck,
  Database,
  CreditCard,
  BarChart3,
  MessageSquare,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface AppLayoutProps {
  onOpenQuickAction?: (type: 'customer' | 'purchase' | 'delivery' | 'payment') => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ onOpenQuickAction }) => {
  const { user, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'customer' | 'purchase' | 'delivery' | 'payment' | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();

  const isConfigured = isSupabaseConfigured();

  // Handle escape key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  if (!isConfigured) {
    return <SupabaseSetupBanner />;
  }

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Purchases / Sales', path: '/purchases', icon: ShoppingBag },
    { name: 'Supplier Purchases', path: '/supplier-purchases', icon: Building2 },
    { name: 'Payments / Finance', path: '/payments', icon: CreditCard },
    { name: 'Deliveries', path: '/deliveries', icon: Truck },
    { name: 'Cylinder Inventory', path: '/cylinders', icon: Database },
    { name: 'Messages', path: '/messages', icon: MessageSquare },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const isPathActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const handleQuickAction = (type: 'customer' | 'purchase' | 'delivery' | 'payment') => {
    if (onOpenQuickAction) {
      onOpenQuickAction(type);
    } else {
      setActiveModal(type);
    }
  };

  return (
    <div className="min-h-screen app-ambient-bg text-[#111111] dark:text-[#F5F5F5] flex flex-col font-sans antialiased transition-colors duration-200">
      {/* Setup banner if active */}
      <div className="w-full">
        <SupabaseSetupBanner />
      </div>

      {/* DESKTOP FLOATING LEFT SIDEBAR */}
      <aside
        className={`hidden lg:flex fixed top-[20px] bottom-[20px] left-[20px] z-40 floating-sidebar-surface rounded-[24px] flex-col justify-between p-3.5 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          sidebarCollapsed ? 'w-[76px]' : 'w-[260px]'
        }`}
      >
        {/* Sidebar Header & Brand */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between gap-2 px-1 py-1">
            <div className="flex items-center gap-3 overflow-hidden">
              <AgencyLogo size="md" />
              {!sidebarCollapsed && (
                <div className="min-w-0 transition-opacity duration-200">
                  <span className="text-xs font-black text-[#111111] dark:text-white leading-tight tracking-tight whitespace-nowrap block">
                    {AGENCY_BRANDING.NAME}
                  </span>
                  <p className="text-[10px] text-[#E31B23] font-black tracking-wide uppercase whitespace-nowrap">
                    MANAGEMENT SYSTEM
                  </p>
                </div>
              )}
            </div>

            {/* Sidebar Collapse Toggle Button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F1F1F] text-[#525252] hover:text-[#111111] dark:hover:text-white border border-[#E5E7EB] dark:border-[#2A2A2A] transition-all hover:scale-105 shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center cursor-pointer"
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              aria-label={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4 text-[#E31B23]" /> : <ChevronLeft className="w-4 h-4 text-[#E31B23]" />}
            </button>
          </div>

          {/* Sidebar Search + Add Customer CTA */}
          <div className="space-y-2 pt-1 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
            <button
              onClick={() => setIsSearchOpen(true)}
              className={`w-full flex items-center ${
                sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'
              } py-2 bg-[#F8FAFC] dark:bg-[#1F1F1F] hover:bg-white dark:hover:bg-[#262626] text-[#525252] dark:text-[#D4D4D4] rounded-xl text-xs border border-[#E5E7EB] dark:border-[#2A2A2A] transition-all group focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/12 cursor-pointer min-h-[38px]`}
              title="Global Search (Ctrl+K)"
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-[#E31B23] group-hover:scale-110 transition-transform shrink-0" />
                {!sidebarCollapsed && <span className="font-semibold text-xs text-[#111111] dark:text-white">Search</span>}
              </div>
              {!sidebarCollapsed && (
                <kbd className="text-[9px] font-mono font-bold bg-white dark:bg-[#171717] text-[#737373] px-1.5 py-0.5 rounded border border-[#E5E7EB] dark:border-[#2A2A2A]">
                  Ctrl+K
                </kbd>
              )}
            </button>

            {!sidebarCollapsed && (
              <button
                onClick={() => handleQuickAction('customer')}
                className="w-full flex items-center justify-center gap-2 bg-white dark:bg-[#1F1F1F] hover:bg-[#FFF1F2] dark:hover:bg-rose-950/30 text-[#E31B23] dark:text-red-400 border border-[#FECDD3] dark:border-red-900/40 hover:border-[#E31B23] text-xs font-bold py-2 px-3 rounded-xl transition-all active:scale-98 shadow-2xs cursor-pointer min-h-[38px]"
                title="Add New Customer"
              >
                <Plus className="w-4 h-4 text-[#E31B23] dark:text-red-400 shrink-0" />
                <span>+ Customer</span>
              </button>
            )}
          </div>

          {/* Navigation Links List */}
          <nav className="space-y-1 pt-1 max-h-[calc(100vh-290px)] overflow-y-auto pr-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isPathActive(item.path);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`relative flex items-center ${
                    sidebarCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2.5'
                  } transition-all ${
                    active
                      ? 'nav-item-active font-bold shadow-xs'
                      : 'text-[#525252] dark:text-[#A3A3A3] hover:bg-[#F8FAFC] dark:hover:bg-[#1F1F1F] hover:text-[#111111] dark:hover:text-white font-medium rounded-xl'
                  }`}
                  title={sidebarCollapsed ? item.name : undefined}
                >
                  {/* Left vibrant red active bar */}
                  {active && !sidebarCollapsed && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3.5px] bg-[#E31B23] rounded-r-full" />
                  )}

                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#E31B23] dark:text-[#E31B23]' : 'text-[#525252] dark:text-[#A3A3A3]'}`} />
                  {!sidebarCollapsed && <span className="text-xs truncate">{item.name}</span>}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="pt-3 border-t border-[#E5E7EB] dark:border-[#2A2A2A] space-y-2">
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between px-1'}`}>
            <ThemeToggle />
          </div>

          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center p-2' : 'justify-between px-3 py-2.5'} bg-white dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A]`}>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#E31B23] shrink-0"></span>
                  <p className="text-xs font-black text-[#111111] dark:text-white truncate">SRI SS GAS Admin</p>
                </div>
                <p className="text-[10px] text-[#737373] font-mono truncate">@{user?.username || 'srissgas.agency'}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1.5 text-[#737373] hover:text-[#DC2626] hover:bg-[#FFF1F2] dark:hover:bg-[#262626] rounded-lg transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE TOP HEADER */}
      <header className="lg:hidden bg-white/95 dark:bg-[#171717]/95 backdrop-blur-md text-[#111111] dark:text-white border-b border-[#E5E7EB] dark:border-[#2A2A2A] sticky top-0 z-30 shadow-xs">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <AgencyLogo size="sm" />
            <div>
              <span className="text-xs font-black text-[#111111] dark:text-white leading-none tracking-tight block">{AGENCY_BRANDING.NAME}</span>
              <span className="text-[10px] text-[#E31B23] font-black uppercase">Management System</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-[#525252] dark:text-[#D4D4D4] hover:bg-[#F8FAFC] dark:hover:bg-[#1F1F1F] rounded-xl transition-colors cursor-pointer"
              title="Search (Ctrl+K)"
              aria-label="Search"
            >
              <Search className="w-5 h-5 text-[#E31B23]" />
            </button>
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-[#525252] dark:text-[#D4D4D4] hover:bg-[#F8FAFC] dark:hover:bg-[#1F1F1F] rounded-xl transition-colors cursor-pointer"
              aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6 text-[#E31B23]" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE FULL NAVIGATION DRAWER / SHEET */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Menu"
          className="fixed inset-0 z-50 lg:hidden flex"
        >
          {/* Backdrop overlay */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
          />

          {/* Slide-over Drawer Panel */}
          <div className="relative w-[85vw] max-w-[340px] h-full bg-white dark:bg-[#171717] border-r border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl flex flex-col justify-between p-4 z-10 overflow-y-auto animate-in slide-in-from-left duration-300">
            {/* Drawer Header */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
                <div className="flex items-center gap-2.5">
                  <AgencyLogo size="md" />
                  <div>
                    <span className="text-xs font-black text-[#111111] dark:text-white leading-tight block">
                      {AGENCY_BRANDING.NAME}
                    </span>
                    <span className="text-[10px] text-[#E31B23] font-black uppercase">
                      MANAGEMENT SYSTEM
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-xl bg-[#F8FAFC] dark:bg-[#1F1F1F] text-[#525252] dark:text-[#A3A3A3] hover:text-[#E31B23] dark:hover:text-red-400 border border-[#E5E7EB] dark:border-[#2A2A2A] transition-colors cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Actions in Drawer */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setIsSearchOpen(true);
                  }}
                  className="w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#1F1F1F] text-[#525252] dark:text-[#D4D4D4] rounded-xl text-xs font-bold border border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#E31B23] transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Search className="w-4 h-4 text-[#E31B23]" />
                    <span>Search System</span>
                  </div>
                  <span className="text-[10px] text-[#737373] font-mono">Ctrl+K</span>
                </button>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleQuickAction('customer');
                  }}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-[#FFF1F2] dark:bg-rose-950/30 text-[#E31B23] dark:text-red-400 border border-[#FECDD3] dark:border-red-900/40 text-xs font-black py-2.5 px-3.5 rounded-xl transition-all active:scale-98 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Register New Customer</span>
                </button>
              </div>

              {/* Full Navigation Items (>=44x44px touch targets) */}
              <nav className="space-y-1 pt-2" aria-label="Main Navigation">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isPathActive(item.path);
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`min-h-[48px] w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all text-xs ${
                        active
                          ? 'bg-[#FFF1F2] dark:bg-rose-950/40 text-[#E31B23] dark:text-red-400 font-black border border-[#FECDD3] dark:border-red-900/40 shadow-xs'
                          : 'text-[#525252] dark:text-[#A3A3A3] hover:bg-[#F8FAFC] dark:hover:bg-[#1F1F1F] hover:text-[#111111] dark:hover:text-white font-bold'
                      }`}
                    >
                      <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-[#E31B23] dark:text-red-400' : 'text-[#737373] dark:text-[#A3A3A3]'}`} />
                      <span className="truncate">{item.name}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            {/* Drawer Footer */}
            <div className="pt-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A] space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-[#737373]">Appearance</span>
                <ThemeToggle />
              </div>

              <div className="flex items-center justify-between p-3 bg-[#F8FAFC] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A]">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#E31B23] shrink-0"></span>
                    <p className="text-xs font-black text-[#111111] dark:text-white truncate">SRI SS GAS Admin</p>
                  </div>
                  <p className="text-[10px] text-[#737373] font-mono truncate">@{user?.username || 'srissgas.agency'}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-[#737373] hover:text-[#DC2626] hover:bg-[#FFF1F2] dark:hover:bg-[#262626] rounded-xl transition-colors shrink-0 cursor-pointer"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA WITH DYNAMIC LEFT MARGIN */}
      <div
        className={`flex-1 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          sidebarCollapsed ? 'lg:pl-[108px]' : 'lg:pl-[300px]'
        }`}
      >
        <main className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-12">
          <Outlet context={{ onOpenQuickAction: handleQuickAction }} />
        </main>
      </div>

      {/* MOBILE FLOATING BOTTOM NAVIGATION BAR (AUTHENTICATED ONLY) */}
      <MobileNav onOpenQuickAction={handleQuickAction} />

      {/* Global Search Modal */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Global Quick Action Modals */}
      <CustomerFormModal
        isOpen={activeModal === 'customer'}
        onClose={() => setActiveModal(null)}
        onSuccess={() => {
          setActiveModal(null);
          window.location.reload();
        }}
      />

      <AddPurchaseModal
        isOpen={activeModal === 'purchase'}
        onClose={() => setActiveModal(null)}
        onSuccess={() => {
          setActiveModal(null);
          window.location.reload();
        }}
      />

      <AddPaymentModal
        isOpen={activeModal === 'payment'}
        onClose={() => setActiveModal(null)}
        onSuccess={() => {
          setActiveModal(null);
          window.location.reload();
        }}
      />
    </div>
  );
};

export default AppLayout;

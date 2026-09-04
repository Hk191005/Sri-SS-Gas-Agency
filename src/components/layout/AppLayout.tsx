import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { SupabaseSetupBanner } from '../SupabaseSetupBanner';
import { isSupabaseConfigured } from '../../lib/supabase';
import { AGENCY_BRANDING } from '../../lib/constants';
import { AgencyLogo } from '../branding/AgencyLogo';
import { ThemeToggle } from '../ThemeToggle';
import { GlobalSearchModal } from '../crm/GlobalSearchModal';
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
  ChevronDown,
} from 'lucide-react';

interface AppLayoutProps {
  onOpenQuickAction?: (type: 'customer' | 'purchase' | 'delivery' | 'payment') => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ onOpenQuickAction }) => {
  const { user, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isConfigured = isSupabaseConfigured();

  if (!isConfigured) {
    return <SupabaseSetupBanner />;
  }

  const navItems = [
    { name: 'Overview', path: '/', icon: LayoutDashboard },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Sales', path: '/purchases', icon: ShoppingBag },
    { name: 'Deliveries', path: '/deliveries', icon: Truck },
    { name: 'Inventory', path: '/cylinders', icon: Database },
    { name: 'Supplier Purchases', path: '/supplier-purchases', icon: Building2 },
    { name: 'Finance', path: '/payments', icon: CreditCard },
    { name: 'Messages', path: '/messages', icon: MessageSquare },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isPathActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
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
              className="p-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F1F1F] text-[#525252] hover:text-[#111111] dark:hover:text-white border border-[#E5E7EB] dark:border-[#2A2A2A] transition-all hover:scale-105 shrink-0"
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
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
              } py-2 bg-[#F8FAFC] dark:bg-[#1F1F1F] hover:bg-white dark:hover:bg-[#262626] text-[#525252] dark:text-[#D4D4D4] rounded-xl text-xs border border-[#E5E7EB] dark:border-[#2A2A2A] transition-all group focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/12`}
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

            {onOpenQuickAction && !sidebarCollapsed && (
              <button
                onClick={() => onOpenQuickAction('customer')}
                className="w-full flex items-center justify-center gap-2 bg-white dark:bg-[#1F1F1F] hover:bg-[#FFF1F2] dark:hover:bg-rose-950/30 text-[#E31B23] dark:text-red-400 border border-[#FECDD3] dark:border-red-900/40 hover:border-[#E31B23] text-xs font-bold py-2 px-3 rounded-xl transition-all active:scale-98 shadow-2xs"
                title="Add New Customer"
              >
                <Plus className="w-4 h-4 text-[#E31B23] dark:text-red-400 shrink-0" />
                <span>+ Customer</span>
              </button>
            )}
          </div>

          {/* Navigation Links List */}
          <nav className="space-y-1 pt-1">
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
              className="p-1.5 text-[#737373] hover:text-[#DC2626] hover:bg-[#FFF1F2] dark:hover:bg-[#262626] rounded-lg transition-colors shrink-0"
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 text-[#525252] dark:text-[#D4D4D4] hover:bg-[#F8FAFC] dark:hover:bg-[#1F1F1F] rounded-lg"
              title="Search"
            >
              <Search className="w-5 h-5 text-[#E31B23]" />
            </button>
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#525252] dark:text-[#D4D4D4] hover:bg-[#F8FAFC] dark:hover:bg-[#1F1F1F] rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA WITH DYNAMIC LEFT MARGIN */}
      <div
        className={`flex-1 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          sidebarCollapsed ? 'lg:pl-[108px]' : 'lg:pl-[300px]'
        }`}
      >
        <main className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-12">
          <Outlet />
        </main>
      </div>

      {/* MOBILE FLOATING BOTTOM NAVIGATION BAR */}
      <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-40 bg-white/95 dark:bg-[#171717]/95 backdrop-blur-md border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl shadow-xl px-2 py-1.5 flex items-center justify-around">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-extrabold transition-all ${
              isActive ? 'text-[#C9151C] dark:text-red-400 font-bold' : 'text-[#737373] dark:text-[#A3A3A3]'
            }`
          }
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5 text-[#E31B23]" />
          <span>Overview</span>
        </NavLink>

        <NavLink
          to="/customers"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-extrabold transition-all ${
              isActive ? 'text-[#C9151C] dark:text-red-400 font-bold' : 'text-[#737373] dark:text-[#A3A3A3]'
            }`
          }
        >
          <Users className="w-5 h-5 mb-0.5 text-[#E31B23]" />
          <span>Customers</span>
        </NavLink>

        <NavLink
          to="/purchases"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-extrabold transition-all ${
              isActive ? 'text-[#C9151C] dark:text-red-400 font-bold' : 'text-[#737373] dark:text-[#A3A3A3]'
            }`
          }
        >
          <ShoppingBag className="w-5 h-5 mb-0.5 text-[#E31B23]" />
          <span>Sales</span>
        </NavLink>

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-extrabold text-[#737373] dark:text-[#A3A3A3]"
        >
          <ChevronDown className="w-5 h-5 mb-0.5 text-[#E31B23]" />
          <span>More</span>
        </button>
      </nav>

      {/* Global Search Modal */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
};

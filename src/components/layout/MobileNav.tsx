import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Truck, CreditCard, Plus } from 'lucide-react';

interface MobileNavProps {
  onOpenQuickAction: (type: 'customer' | 'purchase' | 'delivery' | 'payment') => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ onOpenQuickAction }) => {
  const location = useLocation();
  const pathname = location.pathname;

  const isDashboard = pathname === '/';
  const isCustomers = pathname.startsWith('/customers');
  const isDeliveries = pathname.startsWith('/deliveries');
  const isPayments = pathname.startsWith('/payments');

  return (
    <nav
      aria-label="Mobile Bottom Quick Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 w-full z-40 bg-white/95 dark:bg-[#171717]/95 backdrop-blur-md border-t border-[#E5E7EB] dark:border-[#2A2A2A] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-1 sm:px-3 pt-1 pb-[env(safe-area-inset-bottom,6px)] flex items-center justify-around"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 6px)' }}
    >
      {/* Dashboard */}
      <NavLink
        to="/"
        end
        className={`flex flex-col items-center justify-center flex-1 min-w-[48px] min-h-[48px] py-1 px-1 rounded-xl text-[10px] font-extrabold transition-all duration-150 active:scale-95 btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E31B23] ${
          isDashboard
            ? 'text-[#E31B23] dark:text-red-400 font-black'
            : 'text-[#737373] dark:text-[#A3A3A3] hover:text-[#111111] dark:hover:text-white'
        }`}
        aria-current={isDashboard ? 'page' : undefined}
      >
        <LayoutDashboard className={`w-5 h-5 mb-0.5 transition-transform duration-150 ${isDashboard ? 'scale-105' : ''}`} />
        <span className="truncate">Dashboard</span>
      </NavLink>

      {/* Customers */}
      <NavLink
        to="/customers"
        className={`flex flex-col items-center justify-center flex-1 min-w-[48px] min-h-[48px] py-1 px-1 rounded-xl text-[10px] font-extrabold transition-all duration-150 active:scale-95 btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E31B23] ${
          isCustomers
            ? 'text-[#E31B23] dark:text-red-400 font-black'
            : 'text-[#737373] dark:text-[#A3A3A3] hover:text-[#111111] dark:hover:text-white'
        }`}
        aria-current={isCustomers ? 'page' : undefined}
      >
        <Users className={`w-5 h-5 mb-0.5 transition-transform duration-150 ${isCustomers ? 'scale-105' : ''}`} />
        <span className="truncate">Customers</span>
      </NavLink>

      {/* Quick Action Center Plus Button */}
      <div className="flex items-center justify-center px-1">
        <button
          onClick={() => onOpenQuickAction('customer')}
          className="-mt-5 w-12 h-12 min-w-[48px] min-h-[48px] bg-[#E31B23] hover:bg-[#C9151C] text-white rounded-full shadow-[0_6px_18px_rgba(227,27,35,0.35)] border-4 border-white dark:border-[#171717] flex items-center justify-center active:scale-90 transition-transform duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E31B23]"
          title="Add New Customer"
          aria-label="Add New Customer"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

      {/* Deliveries */}
      <NavLink
        to="/deliveries"
        className={`flex flex-col items-center justify-center flex-1 min-w-[48px] min-h-[48px] py-1 px-1 rounded-xl text-[10px] font-extrabold transition-all duration-150 active:scale-95 btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E31B23] ${
          isDeliveries
            ? 'text-[#E31B23] dark:text-red-400 font-black'
            : 'text-[#737373] dark:text-[#A3A3A3] hover:text-[#111111] dark:hover:text-white'
        }`}
        aria-current={isDeliveries ? 'page' : undefined}
      >
        <Truck className={`w-5 h-5 mb-0.5 transition-transform duration-150 ${isDeliveries ? 'scale-105' : ''}`} />
        <span className="truncate">Deliveries</span>
      </NavLink>

      {/* Payments */}
      <NavLink
        to="/payments"
        className={`flex flex-col items-center justify-center flex-1 min-w-[48px] min-h-[48px] py-1 px-1 rounded-xl text-[10px] font-extrabold transition-all duration-150 active:scale-95 btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E31B23] ${
          isPayments
            ? 'text-[#E31B23] dark:text-red-400 font-black'
            : 'text-[#737373] dark:text-[#A3A3A3] hover:text-[#111111] dark:hover:text-white'
        }`}
        aria-current={isPayments ? 'page' : undefined}
      >
        <CreditCard className={`w-5 h-5 mb-0.5 transition-transform duration-150 ${isPayments ? 'scale-105' : ''}`} />
        <span className="truncate">Payments</span>
      </NavLink>
    </nav>
  );
};

export default MobileNav;

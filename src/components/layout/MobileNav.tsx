import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Truck, CreditCard, Plus } from 'lucide-react';

interface MobileNavProps {
  onOpenQuickAction: (type: 'customer' | 'purchase' | 'delivery' | 'payment') => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ onOpenQuickAction }) => {
  return (
    <nav
      aria-label="Mobile Bottom Quick Navigation"
      className="lg:hidden fixed bottom-3 left-3 right-3 z-40 bg-white/95 dark:bg-[#171717]/95 backdrop-blur-md border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl shadow-xl px-2 py-1.5 flex items-center justify-around"
    >
      {/* Dashboard */}
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `flex flex-col items-center justify-center min-w-[48px] min-h-[44px] py-1 px-2 rounded-xl text-[10px] font-extrabold transition-all active:scale-95 ${
            isActive
              ? 'text-[#E31B23] dark:text-red-400 font-black'
              : 'text-[#737373] dark:text-[#A3A3A3] hover:text-[#111111] dark:hover:text-white'
          }`
        }
      >
        <LayoutDashboard className="w-5 h-5 mb-0.5" />
        <span>Dashboard</span>
      </NavLink>

      {/* Customers */}
      <NavLink
        to="/customers"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center min-w-[48px] min-h-[44px] py-1 px-2 rounded-xl text-[10px] font-extrabold transition-all active:scale-95 ${
            isActive
              ? 'text-[#E31B23] dark:text-red-400 font-black'
              : 'text-[#737373] dark:text-[#A3A3A3] hover:text-[#111111] dark:hover:text-white'
          }`
        }
      >
        <Users className="w-5 h-5 mb-0.5" />
        <span>Customers</span>
      </NavLink>

      {/* Quick Action Center Plus Button */}
      <button
        onClick={() => onOpenQuickAction('purchase')}
        className="-mt-5 w-12 h-12 min-w-[48px] min-h-[48px] bg-[#E31B23] hover:bg-[#C9151C] text-white rounded-full shadow-[0_6px_18px_rgba(227,27,35,0.3)] border-4 border-white dark:border-[#171717] flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
        title="Quick Add Gas Sale"
        aria-label="Add Gas Sale"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      {/* Deliveries */}
      <NavLink
        to="/deliveries"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center min-w-[48px] min-h-[44px] py-1 px-2 rounded-xl text-[10px] font-extrabold transition-all active:scale-95 ${
            isActive
              ? 'text-[#E31B23] dark:text-red-400 font-black'
              : 'text-[#737373] dark:text-[#A3A3A3] hover:text-[#111111] dark:hover:text-white'
          }`
        }
      >
        <Truck className="w-5 h-5 mb-0.5" />
        <span>Deliveries</span>
      </NavLink>

      {/* Payments */}
      <NavLink
        to="/payments"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center min-w-[48px] min-h-[44px] py-1 px-2 rounded-xl text-[10px] font-extrabold transition-all active:scale-95 ${
            isActive
              ? 'text-[#E31B23] dark:text-red-400 font-black'
              : 'text-[#737373] dark:text-[#A3A3A3] hover:text-[#111111] dark:hover:text-white'
          }`
        }
      >
        <CreditCard className="w-5 h-5 mb-0.5" />
        <span>Payments</span>
      </NavLink>
    </nav>
  );
};

export default MobileNav;

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Truck,
  Database,
  CreditCard,
  Building2,
  TrendingUp,
  Plus,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  MessageSquare,
  Clock,
} from 'lucide-react';
import { MetricCard } from '../components/ui/MetricCard';
import { CustomerFollowUpSystem } from '../components/crm/CustomerFollowUpSystem';
import { CustomerFormModal } from '../components/customers/CustomerFormModal';
import { AddPurchaseModal } from '../components/purchases/AddPurchaseModal';
import { AddPaymentModal } from '../components/payments/AddPaymentModal';
import { getDashboardStats, getPurchases, getCylinderStockSummary } from '../lib/db';
import { getCustomerReminderCycles } from '../lib/messaging';
import { getTimeBasedGreeting } from '../lib/greeting';
import type { DashboardStats, CustomerReminderCycle, Purchase, CylinderStockSummary } from '../types/database.types';

interface DashboardProps {
  onOpenQuickAction?: (type: 'customer' | 'purchase' | 'delivery' | 'payment') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenQuickAction }) => {
  const [greeting, setGreeting] = useState<string>(() => getTimeBasedGreeting());

  useEffect(() => {
    // Dynamic time-aware greeting updates across time boundaries
    setGreeting(getTimeBasedGreeting());
    const interval = setInterval(() => {
      setGreeting((prev) => {
        const next = getTimeBasedGreeting();
        return prev === next ? prev : next;
      });
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    activeCustomers: 0,
    individualCustomers: 0,
    companyCustomers: 0,
    todaysDeliveries: 0,
    pendingDeliveries: 0,
    thisMonthSales: 0,
    outstandingPayments: 0,
    totalDepositsHeld: 0,
    availableCylinders: 0,
    supplierPurchasesMonth: 0,
    supplierOutstanding: 0,
  });

  const [reminderCycles, setReminderCycles] = useState<CustomerReminderCycle[]>([]);
  const [stockSummaries, setStockSummaries] = useState<CylinderStockSummary[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [activeModal, setActiveModal] = useState<'customer' | 'sale' | 'payment' | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week');

  const loadData = async () => {
    try {
      const [dashStats, cycles, stockSummary, purchasesList] = await Promise.all([
        getDashboardStats(),
        getCustomerReminderCycles().catch(() => []),
        getCylinderStockSummary().catch(() => []),
        getPurchases().catch(() => []),
      ]);
      setStats(dashStats);
      setReminderCycles(cycles);
      setStockSummaries(stockSummary);
      setPurchases(purchasesList);
    } catch (e) {
      console.error('Dashboard live data load error:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAction = (type: 'customer' | 'purchase' | 'delivery' | 'payment') => {
    if (onOpenQuickAction) {
      onOpenQuickAction(type);
    } else {
      if (type === 'customer') setActiveModal('customer');
      if (type === 'purchase') setActiveModal('sale');
      if (type === 'payment') setActiveModal('payment');
    }
  };

  // Dynamically compute live weekly sales chart from Supabase purchases
  const computeWeeklyChartData = () => {
    const now = new Date();
    const currentDay = now.getDay();
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const daysData = dayLabels.map((dayLabel, index) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + index);
      const dateStr = d.toISOString().split('T')[0];

      const matching = purchases.filter((p) => p.purchase_date && p.purchase_date.startsWith(dateStr));
      let cylCount = 0;
      matching.forEach((p) => {
        if (p.items && p.items.length > 0) {
          cylCount += p.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
        } else {
          cylCount += 1;
        }
      });

      return {
        day: dayLabel,
        date: dateStr,
        value: cylCount,
      };
    });

    const maxVal = Math.max(...daysData.map((d) => d.value), 0);
    return daysData.map((d) => ({
      ...d,
      height: maxVal > 0 && d.value > 0 ? `${Math.max(8, Math.round((d.value / maxVal) * 95))}%` : '4%',
    }));
  };

  // Dynamically compute live monthly sales chart from Supabase purchases
  const computeMonthlyChartData = () => {
    const now = new Date();
    const currentMonthPrefix = now.toISOString().substring(0, 7);
    const monthPurchases = purchases.filter((p) => p.purchase_date && p.purchase_date.startsWith(currentMonthPrefix));

    const weeks = [
      { day: 'Week 1', start: 1, end: 7, value: 0 },
      { day: 'Week 2', start: 8, end: 14, value: 0 },
      { day: 'Week 3', start: 15, end: 21, value: 0 },
      { day: 'Week 4', start: 22, end: 31, value: 0 },
    ];

    monthPurchases.forEach((p) => {
      const parts = p.purchase_date.split('-');
      const dayOfMonth = parseInt(parts[2] || '1', 10);
      let count = 0;
      if (p.items && p.items.length > 0) {
        count = p.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      } else {
        count = 1;
      }

      for (const w of weeks) {
        if (dayOfMonth >= w.start && dayOfMonth <= w.end) {
          w.value += count;
          break;
        }
      }
    });

    const maxVal = Math.max(...weeks.map((w) => w.value), 0);
    return weeks.map((w) => ({
      day: w.day,
      value: w.value,
      height: maxVal > 0 && w.value > 0 ? `${Math.max(8, Math.round((w.value / maxVal) * 95))}%` : '4%',
    }));
  };

  const weeklyBars = computeWeeklyChartData();
  const monthlyBars = computeMonthlyChartData();
  const chartBars = timeRange === 'week' ? weeklyBars : monthlyBars;

  // Chart summary metrics computed from live database records
  const totalPeriodCyls = chartBars.reduce((sum, b) => sum + b.value, 0);
  const avgPeriodCyls = timeRange === 'week' ? Math.round(totalPeriodCyls / 7) : Math.round(totalPeriodCyls / 4);
  const bestPeriodObj = [...chartBars].sort((a, b) => b.value - a.value)[0];
  const bestPeriodText = bestPeriodObj && bestPeriodObj.value > 0 ? `${bestPeriodObj.day} (${bestPeriodObj.value} Cyls)` : 'None';

  return (
    <div className="space-y-6">
      {/* Hero Executive Welcome Section */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FFF1F2] dark:bg-red-950/30 border border-[#FECDD3] dark:border-red-900/40 rounded-full text-[11px] font-black text-[#C9151C] dark:text-red-400">
          <ShieldCheck className="w-3.5 h-3.5 text-[#E31B23]" />
          <span>SRI SS GAS AGENCY · TIRUPPUR DISTRICT</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#111111] dark:text-white tracking-tight">
              {greeting}, Harikanth & Selvaraj
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-[#525252] dark:text-[#A3A3A3] mt-1">
              Here's what's happening with SRI SS GAS AGENCY today in Tiruppur District, Tamil Nadu.
            </p>
          </div>

          {/* Quick Actions Hierarchy */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => handleOpenAction('customer')}
              className="flex items-center gap-2 bg-[#E31B23] hover:bg-[#C9151C] active:bg-[#A90F16] text-white text-xs font-black py-2.5 px-4 rounded-[12px] shadow-[0_6px_18px_rgba(227,27,35,0.16)] transition-all active:scale-98 cursor-pointer min-h-[44px]"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Customer</span>
            </button>
            <button
              onClick={() => handleOpenAction('purchase')}
              className="flex items-center gap-2 bg-white dark:bg-[#1F1F1F] hover:bg-[#F8FAFC] dark:hover:bg-[#262626] text-[#111111] dark:text-white border border-[#E5E7EB] dark:border-[#2A2A2A] text-xs font-black py-2.5 px-4 rounded-[12px] shadow-2xs transition-all active:scale-98 cursor-pointer min-h-[44px]"
            >
              <Plus className="w-4 h-4 text-[#E31B23]" />
              <span>Sale</span>
            </button>
            <button
              onClick={() => handleOpenAction('payment')}
              className="flex items-center gap-2 bg-white dark:bg-[#1F1F1F] hover:bg-[#F8FAFC] dark:hover:bg-[#262626] text-[#111111] dark:text-white border border-[#E5E7EB] dark:border-[#2A2A2A] text-xs font-black py-2.5 px-4 rounded-[12px] shadow-2xs transition-all active:scale-98 cursor-pointer min-h-[44px]"
            >
              <Plus className="w-4 h-4 text-[#E31B23]" />
              <span>Payment</span>
            </button>
            <Link
              to="/supplier-purchases"
              className="flex items-center gap-2 bg-white dark:bg-[#1F1F1F] hover:bg-[#F8FAFC] dark:hover:bg-[#262626] text-[#111111] dark:text-[#D4D4D4] border border-[#E5E7EB] dark:border-[#2A2A2A] text-xs font-bold py-2.5 px-4 rounded-[12px] shadow-2xs transition-all min-h-[44px]"
            >
              <Building2 className="w-3.5 h-3.5 text-[#E31B23]" />
              <span>Supplier Bill</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 6 Clean KPI Metric Cards (100% Supabase-Authoritative) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          title="Total Customers"
          value={stats.totalCustomers}
          subtitle="Registered gas accounts"
          icon={<Users className="w-5 h-5" />}
          variant="brand"
        />
        <MetricCard
          title="Active Customers"
          value={stats.activeCustomers}
          subtitle="Active refill accounts"
          icon={<CheckCircle2 className="w-5 h-5" />}
          variant="green"
        />
        <MetricCard
          title="Today's Deliveries"
          value={stats.todaysDeliveries}
          subtitle="Field dispatches today"
          icon={<Truck className="w-5 h-5" />}
          variant="cyan"
        />
        <MetricCard
          title="Available Stock"
          value={`${stats.availableCylinders} Cyls`}
          subtitle="Filled ready stock"
          icon={<Database className="w-5 h-5" />}
          variant="green"
        />
        <MetricCard
          title="Customer Balance"
          value={`₹${stats.outstandingPayments.toLocaleString('en-IN')}`}
          subtitle="Customer receivables"
          icon={<CreditCard className="w-5 h-5" />}
          variant="red"
        />
        <MetricCard
          title="Supplier Balance"
          value={`₹${stats.supplierOutstanding.toLocaleString('en-IN')}`}
          subtitle="SUPERGAS payables"
          icon={<Building2 className="w-5 h-5" />}
          variant="orange"
        />
      </div>

      {/* Sales Overview Chart + Real Cylinder Stock Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Velocity Chart (100% Dynamic from Supabase Purchases) */}
        <div className="lg:col-span-2 saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-6 rounded-2xl space-y-6 flex flex-col justify-between shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-[#111111] dark:text-white tracking-tight flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#E31B23]" /> Sales Overview & Velocity
              </h2>
              <p className="text-xs font-semibold text-[#737373] mt-0.5">
                Refill cylinder distribution trend across Tiruppur District
              </p>
            </div>

            {/* Time Selector */}
            <div className="flex items-center gap-1 bg-[#F8FAFC] dark:bg-[#1F1F1F] p-1 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] text-xs font-bold self-start sm:self-auto">
              <button
                onClick={() => setTimeRange('week')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  timeRange === 'week'
                    ? 'bg-[#E31B23] text-white font-black shadow-xs'
                    : 'text-[#737373] hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setTimeRange('month')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  timeRange === 'month'
                    ? 'bg-[#E31B23] text-white font-black shadow-xs'
                    : 'text-[#737373] hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                This Month
              </button>
            </div>
          </div>

          {/* Plot Area with Y-axis & SUPERGAS Red bars */}
          <div className="relative w-full h-52 flex items-end gap-3 pt-4 pb-2">
            {/* Y-axis Labels & Grid Lines */}
            <div className="flex flex-col justify-between h-full text-[10px] font-bold text-[#737373] pr-2 select-none">
              <span>Max</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0</span>
            </div>

            {/* Bars Area with Horizontal Grid Lines */}
            <div className="relative flex-1 h-full flex items-end justify-between gap-3 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
              {/* Background Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none -z-0">
                <div className="border-b border-[#F1F5F9] dark:border-[#262626] w-full h-0"></div>
                <div className="border-b border-[#F1F5F9] dark:border-[#262626] w-full h-0"></div>
                <div className="border-b border-[#F1F5F9] dark:border-[#262626] w-full h-0"></div>
                <div className="border-b border-[#F1F5F9] dark:border-[#262626] w-full h-0"></div>
                <div className="w-full h-0"></div>
              </div>

              {/* Red Bars */}
              {chartBars.map((item) => (
                <div key={item.day} className="relative z-10 flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <div
                    className={`w-full max-w-[48px] ${
                      item.value > 0 ? 'bg-[#E31B23] hover:bg-[#C9151C]' : 'bg-[#E5E7EB] dark:bg-[#2A2A2A]'
                    } rounded-t-md transition-all duration-300 relative group-hover:scale-y-[1.02] origin-bottom shadow-2xs`}
                    style={{ height: item.height }}
                  >
                    {/* Hover tooltip */}
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#111111] text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow whitespace-nowrap pointer-events-none z-20">
                      {item.value} Cyls
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-[#737373] dark:text-[#A3A3A3] mt-1">{item.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart Summary Sub-Bar with Live Aggregates */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[#F1F5F9] dark:border-[#262626]">
            <div>
              <p className="text-[11px] font-bold text-[#737373]">
                {timeRange === 'week' ? 'Total This Week' : 'Total This Month'}
              </p>
              <p className="text-sm sm:text-base font-black text-[#E31B23] mt-0.5">{totalPeriodCyls} Cyls</p>
              <p className="text-[10px] font-semibold text-[#737373]">Realized cylinder sales</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#737373]">
                {timeRange === 'week' ? 'Daily Average' : 'Weekly Average'}
              </p>
              <p className="text-sm sm:text-base font-black text-[#E31B23] mt-0.5">{avgPeriodCyls} Cyls</p>
              <p className="text-[10px] font-semibold text-[#737373]">Velocity per active period</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#737373]">
                {timeRange === 'week' ? 'Best Day' : 'Best Week'}
              </p>
              <p className="text-sm sm:text-base font-black text-[#E31B23] mt-0.5 truncate">{bestPeriodText}</p>
              <p className="text-[10px] font-semibold text-[#737373]">Highest cylinder volume</p>
            </div>
          </div>
        </div>

        {/* Real Inventory Stock Snapshot Panel (100% Dynamic from Supabase Stock) */}
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-6 rounded-2xl space-y-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-[#111111] dark:text-white tracking-tight flex items-center gap-2">
              <Database className="w-5 h-5 text-[#E31B23]" /> Inventory Stock
            </h2>
            <Link to="/cylinders" className="text-xs font-black text-[#E31B23] hover:underline flex items-center gap-1">
              View All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-4">
            {stockSummaries.length === 0 ? (
              <div className="py-8 text-center text-xs font-semibold text-[#737373]">
                Loading inventory stock...
              </div>
            ) : (
              stockSummaries.map((stock) => {
                const percentVal = stock.total > 0 ? Math.min(100, Math.round((stock.available / stock.total) * 100)) : 0;
                return (
                  <div key={stock.size} className="space-y-1.5 pb-3 border-b border-[#F1F5F9] dark:border-[#262626] last:border-none last:pb-0">
                    <div className="flex items-center justify-between text-xs font-black text-[#111111] dark:text-white">
                      <span>{stock.size}</span>
                      <span className="text-[#059669] font-black">{stock.available} Available</span>
                    </div>
                    {/* Thin progress track */}
                    <div className="w-full bg-[#F1F5F9] dark:bg-[#262626] h-2 rounded-full overflow-hidden">
                      <div className="bg-[#E31B23] h-full rounded-full transition-all duration-500" style={{ width: `${percentVal}%` }}></div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#737373] pt-0.5">
                      <span className="text-[#D97706]">{stock.empty} Empty</span>
                      <span>{stock.withCustomer} With Customers</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Customer Refill Reminders & Messaging Hub */}
      <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-6 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F1F5F9] dark:border-[#262626] pb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFF1F2] dark:bg-red-950/40 text-[#E31B23] flex items-center justify-center shrink-0 border border-[#FECDD3]">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#111111] dark:text-white tracking-tight flex items-center gap-2">
                Customer Refill Reminders & Messaging Hub
              </h2>
              <p className="text-[11px] font-semibold text-[#737373]">
                Automated cylinder replenishment tracker (4kg 14d, 12kg 30d, 17kg 60d, 21kg 60d)
              </p>
            </div>
          </div>

          <Link
            to="/messages"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#E31B23] hover:bg-[#C9151C] text-white text-xs font-black rounded-xl transition-all shadow-xs shrink-0"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Open Messaging Center</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-[#F8FAFC] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A]">
            <span className="text-[10px] font-bold text-[#737373] uppercase block">Due Today / Soon</span>
            <span className="text-xl font-black text-[#DC2626]">
              {reminderCycles.filter((c) => c.reminder_status === 'due').length}
            </span>
            <span className="text-[10px] text-[#737373] block mt-0.5">Ready for refill</span>
          </div>

          <div className="p-3 bg-[#F8FAFC] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A]">
            <span className="text-[10px] font-bold text-[#737373] uppercase block">Overdue</span>
            <span className="text-xl font-black text-amber-600">
              {reminderCycles.filter((c) => c.reminder_status === 'overdue').length}
            </span>
            <span className="text-[10px] text-[#737373] block mt-0.5">Past expected cycle</span>
          </div>

          <div className="p-3 bg-[#F8FAFC] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A]">
            <span className="text-[10px] font-bold text-[#737373] uppercase block">Upcoming</span>
            <span className="text-xl font-black text-[#16A34A]">
              {reminderCycles.filter((c) => c.reminder_status === 'upcoming').length}
            </span>
            <span className="text-[10px] text-[#737373] block mt-0.5">Within lead window</span>
          </div>

          <div className="p-3 bg-[#F8FAFC] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A]">
            <span className="text-[10px] font-bold text-[#737373] uppercase block">Monitored Cycles</span>
            <span className="text-xl font-black text-[#111111] dark:text-white">
              {reminderCycles.length}
            </span>
            <span className="text-[10px] text-[#737373] block mt-0.5">Active customer accounts</span>
          </div>
        </div>
      </div>

      {/* Customer Follow-ups Section */}
      <div>
        <CustomerFollowUpSystem />
      </div>

      {/* Quick Action Modals */}
      <CustomerFormModal
        isOpen={activeModal === 'customer'}
        onClose={() => setActiveModal(null)}
        onSuccess={() => {
          setActiveModal(null);
          loadData();
        }}
      />

      <AddPurchaseModal
        isOpen={activeModal === 'sale'}
        onClose={() => setActiveModal(null)}
        onSuccess={() => {
          setActiveModal(null);
          loadData();
        }}
      />

      <AddPaymentModal
        isOpen={activeModal === 'payment'}
        onClose={() => setActiveModal(null)}
        onSuccess={() => {
          setActiveModal(null);
          loadData();
        }}
      />
    </div>
  );
};

export default Dashboard;

import React, { useState, useEffect, useMemo } from 'react';
import {
  getPurchases,
  getPayments,
  getDeposits,
  getCustomers,
  getDeliveries,
} from '../lib/db';
import { getSupplierPurchases } from '../lib/supplierDb';
import { exportPurchaseReportPdf } from '../lib/purchaseReportPdf';
import { AgencyLogo } from '../components/branding/AgencyLogo';
import { BarChart3, Download, FileText, Calendar, ShoppingBag, Users, CreditCard, Building2, Truck, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Purchase, Customer } from '../types/database.types';

export const Reports: React.FC = () => {
  const [reportType, setReportType] = useState<'sales' | 'customers' | 'payments' | 'deposits' | 'supplier' | 'deliveries'>('sales');
  const [dateRange, setDateRange] = useState<'this_month' | 'this_week' | 'last_month' | 'all' | 'custom'>('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [allPurchases, setAllPurchases] = useState<Purchase[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [allDeposits, setAllDeposits] = useState<any[]>([]);
  const [allSupplierPurchases, setAllSupplierPurchases] = useState<any[]>([]);
  const [allDeliveries, setAllDeliveries] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  // Load all underlying data once
  const loadAllData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [purchases, customersRes, payments, deposits, supplierP, deliveries] = await Promise.all([
        getPurchases(),
        getCustomers({ limit: 1000 }),
        getPayments(),
        getDeposits(),
        getSupplierPurchases(),
        getDeliveries(),
      ]);

      setAllPurchases(purchases);
      setAllCustomers(customersRes.customers);
      setAllPayments(payments);
      setAllDeposits(deposits);
      setAllSupplierPurchases(supplierP);
      setAllDeliveries(deliveries);
    } catch (e: any) {
      console.error('Reports load error:', e);
      setLoadError(e.message || 'Failed to load report datasets from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Customer ID to Customer Map for fast, authoritative Name resolution
  const customerMap = useMemo(() => {
    const map: Record<string, Customer> = {};
    allCustomers.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [allCustomers]);

  // Helper: check if a record date matches the selected date filter
  const isDateInSelectedRange = (dateStr?: string | null): boolean => {
    if (!dateStr) return false;
    const recDate = new Date(dateStr);
    if (isNaN(recDate.getTime())) return false;

    const now = new Date();

    if (dateRange === 'all') return true;

    if (dateRange === 'this_month') {
      const monthPrefix = now.toISOString().substring(0, 7);
      return dateStr.startsWith(monthPrefix);
    }

    if (dateRange === 'this_week') {
      const currentDay = now.getDay();
      const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      return recDate >= monday && recDate <= sunday;
    }

    if (dateRange === 'last_month') {
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthPrefix = prevMonthDate.toISOString().substring(0, 7);
      return dateStr.startsWith(prevMonthPrefix);
    }

    if (dateRange === 'custom') {
      if (customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        return recDate >= start && recDate <= end;
      }
      if (customStartDate) {
        const start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        return recDate >= start;
      }
      if (customEndDate) {
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        return recDate <= end;
      }
      return true;
    }

    return true;
  };

  // Human-readable Period Label
  const periodLabel = useMemo(() => {
    switch (dateRange) {
      case 'this_month':
        return new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      case 'this_week':
        return 'This Current Week';
      case 'last_month': {
        const prev = new Date();
        prev.setMonth(prev.getMonth() - 1);
        return prev.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      }
      case 'custom':
        return customStartDate && customEndDate ? `${customStartDate} to ${customEndDate}` : 'Custom Date Range';
      case 'all':
      default:
        return 'All Historical Records';
    }
  }, [dateRange, customStartDate, customEndDate]);

  // Filtered Datasets based on selected Date Range
  const filteredPurchases = useMemo(() => {
    return allPurchases.filter((p) => isDateInSelectedRange(p.purchase_date || p.created_at));
  }, [allPurchases, dateRange, customStartDate, customEndDate]);

  const filteredPayments = useMemo(() => {
    return allPayments.filter((py) => isDateInSelectedRange(py.payment_date || py.created_at));
  }, [allPayments, dateRange, customStartDate, customEndDate]);

  const filteredDeposits = useMemo(() => {
    return allDeposits.filter((d) => isDateInSelectedRange(d.transaction_date || d.created_at));
  }, [allDeposits, dateRange, customStartDate, customEndDate]);

  const filteredSupplierPurchases = useMemo(() => {
    return allSupplierPurchases.filter((sp) => isDateInSelectedRange(sp.invoice_date || sp.created_at));
  }, [allSupplierPurchases, dateRange, customStartDate, customEndDate]);

  const filteredDeliveries = useMemo(() => {
    return allDeliveries.filter((del) => isDateInSelectedRange(del.delivery_date || del.created_at));
  }, [allDeliveries, dateRange, customStartDate, customEndDate]);

  // Active dataset for current report type
  const currentDataList = useMemo(() => {
    switch (reportType) {
      case 'sales':
        return filteredPurchases;
      case 'customers':
        return allCustomers; // Customer registry is full catalog
      case 'payments':
        return filteredPayments;
      case 'deposits':
        return filteredDeposits;
      case 'supplier':
        return filteredSupplierPurchases;
      case 'deliveries':
        return filteredDeliveries;
      default:
        return [];
    }
  }, [reportType, filteredPurchases, allCustomers, filteredPayments, filteredDeposits, filteredSupplierPurchases, filteredDeliveries]);

  // Dynamic KPI Totals for Active Period
  const activePeriodMetrics = useMemo(() => {
    const gasRevenue = filteredPurchases.reduce((sum, p) => sum + (Number(p.total_gas_amount) || 0), 0);
    const collections = filteredPayments.reduce((sum, py) => sum + (Number(py.amount) || 0), 0);
    const depositsHeld = filteredDeposits
      .filter((d) => d.status === 'given' || d.status === 'held')
      .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const supplierCosts = filteredSupplierPurchases.reduce((sum, sp) => sum + (Number(sp.total_amount) || 0), 0);

    const uniquePurchasingCustomers = new Set(filteredPurchases.map((p) => p.customer_id)).size;
    const avgPurchase = filteredPurchases.length > 0 ? Math.round(gasRevenue / filteredPurchases.length) : 0;

    return {
      gasRevenue,
      collections,
      depositsHeld,
      supplierCosts,
      totalPurchases: filteredPurchases.length,
      uniquePurchasingCustomers,
      avgPurchase,
    };
  }, [filteredPurchases, filteredPayments, filteredDeposits, filteredSupplierPurchases]);

  // Export Purchase Report PDF
  const handleExportPurchasePDF = async () => {
    if (filteredPurchases.length === 0) return;
    setExportingPdf(true);
    try {
      await exportPurchaseReportPdf(filteredPurchases, {
        periodLabel,
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
        generatedBy: 'SRI SS Admin',
        customerMap,
      });
    } catch (err) {
      console.error('Failed to export Purchase Report PDF:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (currentDataList.length === 0) return;

    let headers: string[] = [];
    let rows: string[][] = [];

    if (reportType === 'sales') {
      headers = ['#', 'Purchase Code', 'Purchase Date', 'Customer Name', 'Customer Code', 'Items Summary', 'Total Amount', 'Notes'];
      rows = filteredPurchases.map((p, idx) => {
        const cust = p.customer || customerMap[p.customer_id];
        const custName = cust ? cust.name : 'Unknown Customer';
        const custCode = cust ? cust.customer_code : '';
        const items = p.items?.map((it) => `${typeof it.cylinder_type === 'object' ? (it.cylinder_type as any)?.name : 'Cylinder'} x ${it.quantity}`).join('; ') || 'Refill';
        return [
          String(idx + 1),
          p.purchase_code,
          p.purchase_date,
          custName,
          custCode,
          items,
          p.total_gas_amount.toString(),
          p.notes || '',
        ];
      });
    } else if (reportType === 'customers') {
      headers = ['#', 'Customer Code', 'Customer Type', 'Customer Name', 'Company', 'Phone', 'Area', 'City', 'District', 'Pincode', 'Status'];
      rows = allCustomers.map((c, idx) => [
        String(idx + 1),
        c.customer_code,
        c.customer_type,
        c.name,
        c.company_name || '',
        c.phone,
        c.area1 || '',
        c.city || 'Tiruppur',
        c.district || 'Tiruppur',
        c.pincode || '',
        c.is_active ? 'Active' : 'Deactivated',
      ]);
    } else if (reportType === 'payments') {
      headers = ['#', 'Receipt ID', 'Date', 'Customer Name', 'Payment Method', 'Amount', 'Status'];
      rows = filteredPayments.map((p, idx) => {
        const cust = p.customer || customerMap[p.customer_id];
        return [
          String(idx + 1),
          `RCP-${(p.id || '').slice(0, 8).toUpperCase()}`,
          p.payment_date,
          cust ? cust.name : p.customer_id,
          p.payment_method?.toUpperCase() || 'CASH',
          p.amount.toString(),
          p.status || 'paid',
        ];
      });
    } else if (reportType === 'deposits') {
      headers = ['#', 'Deposit ID', 'Date', 'Customer Name', 'Amount', 'Status', 'Notes'];
      rows = filteredDeposits.map((d, idx) => {
        const cust = d.customer || customerMap[d.customer_id];
        return [
          String(idx + 1),
          `DEP-${(d.id || '').slice(0, 8).toUpperCase()}`,
          d.transaction_date,
          cust ? cust.name : d.customer_id,
          d.amount.toString(),
          d.status,
          d.notes || '',
        ];
      });
    } else if (reportType === 'supplier') {
      headers = ['#', 'Purchase Code', 'Supplier Name', 'Invoice #', 'Invoice Date', 'Total Amount', 'Paid', 'Outstanding'];
      rows = filteredSupplierPurchases.map((sp, idx) => [
        String(idx + 1),
        sp.purchase_code,
        sp.supplier_name,
        sp.invoice_number,
        sp.invoice_date,
        sp.total_amount.toString(),
        sp.amount_paid.toString(),
        sp.outstanding_amount.toString(),
      ]);
    } else if (reportType === 'deliveries') {
      headers = ['#', 'Delivery Code', 'Date', 'Customer Name', 'Address', 'Status'];
      rows = filteredDeliveries.map((d, idx) => {
        const cust = d.customer || customerMap[d.customer_id];
        return [
          String(idx + 1),
          d.delivery_code,
          d.delivery_date || d.created_at,
          cust ? cust.name : d.customer_id,
          d.delivery_address || '',
          d.status,
        ];
      });
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SRI_SS_GAS_${reportType.toUpperCase()}_${dateRange.toUpperCase()}_REPORT.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#171717] dark:text-white tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-[#E31B23]" /> Business Reports & Accounting Statements
          </h1>
          <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4] mt-1">
            Generate official financial statements, live purchase registers, cylinder stock analysis & export professional A4 PDFs
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {reportType === 'sales' && (
            <button
              onClick={handleExportPurchasePDF}
              disabled={filteredPurchases.length === 0 || exportingPdf}
              className="flex items-center justify-center gap-2 bg-[#E31B23] hover:bg-[#C9151C] text-white font-black text-xs px-4 py-2.5 rounded-[12px] shadow-[0_6px_18px_rgba(227,27,35,0.2)] transition-all disabled:opacity-50 active:scale-98 shrink-0"
              title="Generate Professional A4 Purchase Report PDF"
            >
              <FileText className="w-4 h-4" />
              {exportingPdf ? 'Generating PDF...' : 'Export Purchase PDF Report'}
            </button>
          )}

          <button
            onClick={handleExportCSV}
            disabled={currentDataList.length === 0}
            className="flex items-center justify-center gap-2 bg-white dark:bg-[#1F1F1F] hover:bg-[#F5F5F5] dark:hover:bg-[#262626] text-[#171717] dark:text-white border border-[#E5E5E5] dark:border-[#2A2A2A] font-black text-xs px-4 py-2.5 rounded-[12px] shadow-xs transition-all disabled:opacity-50 active:scale-98 shrink-0"
          >
            <Download className="w-4 h-4 text-[#737373]" /> Export CSV
          </button>
        </div>
      </div>

      {/* Segregated Financial & Period Overview KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="saas-card p-4 rounded-2xl bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs">
          <span className="text-[10px] font-bold text-[#737373] uppercase tracking-wider block">
            Period Gas Sales
          </span>
          <span className="text-xl font-black text-[#111111] dark:text-white mt-1 block">
            ₹{activePeriodMetrics.gasRevenue.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] font-semibold text-[#16A34A] block mt-0.5">
            {activePeriodMetrics.totalPurchases} refill orders logged
          </span>
        </div>

        <div className="saas-card p-4 rounded-2xl bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs">
          <span className="text-[10px] font-bold text-[#737373] uppercase tracking-wider block">
            Active Buyers
          </span>
          <span className="text-xl font-black text-[#4F46E5] mt-1 block">
            {activePeriodMetrics.uniquePurchasingCustomers} Customers
          </span>
          <span className="text-[10px] font-semibold text-[#737373] block mt-0.5">
            Avg: ₹{activePeriodMetrics.avgPurchase.toLocaleString('en-IN')} / purchase
          </span>
        </div>

        <div className="saas-card p-4 rounded-2xl bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs">
          <span className="text-[10px] font-bold text-[#737373] uppercase tracking-wider block">
            Cash & UPI Collected
          </span>
          <span className="text-xl font-black text-[#16A34A] mt-1 block">
            ₹{activePeriodMetrics.collections.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] font-semibold text-[#737373] block mt-0.5">
            Receipts in {periodLabel}
          </span>
        </div>

        <div className="saas-card p-4 rounded-2xl bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs">
          <span className="text-[10px] font-bold text-[#737373] uppercase tracking-wider block">
            Supplier Stock Cost
          </span>
          <span className="text-xl font-black text-[#DC2626] mt-1 block">
            ₹{activePeriodMetrics.supplierCosts.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] font-semibold text-[#737373] block mt-0.5">
            Plant inventory purchases
          </span>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="saas-card bg-white dark:bg-[#171717] p-4 rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Report Category Switcher */}
          <div className="flex items-center gap-1.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] p-1 rounded-xl overflow-x-auto border border-[#E5E5E5] dark:border-[#2A2A2A]">
            {[
              { id: 'sales', label: 'Gas Sales & Purchases', icon: ShoppingBag },
              { id: 'customers', label: 'Customer Registry', icon: Users },
              { id: 'payments', label: 'Payment Receipts', icon: CreditCard },
              { id: 'deposits', label: 'Held Deposits', icon: CreditCard },
              { id: 'supplier', label: 'Supplier Purchases', icon: Building2 },
              { id: 'deliveries', label: 'Deliveries Log', icon: Truck },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setReportType(t.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap transition-all border ${
                    reportType === t.id
                      ? 'bg-[#FFF1F2] text-[#C9151C] border-[#FFD6D8] shadow-2xs'
                      : 'text-[#404040] dark:text-[#D4D4D4] border-transparent hover:text-[#171717] dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Date Filter Dropdown */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#737373] shrink-0" />
            <select
              value={dateRange}
              onChange={(e: any) => setDateRange(e.target.value)}
              className="px-3.5 py-2 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#171717] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E31B23]/20"
            >
              <option value="this_month">This Month ({new Date().toLocaleDateString('en-IN', { month: 'short' })})</option>
              <option value="this_week">This Week</option>
              <option value="last_month">Last Month</option>
              <option value="all">All Historical Records</option>
              <option value="custom">Custom Date Range...</option>
            </select>
          </div>
        </div>

        {/* Custom Date Inputs if Custom Selected */}
        {dateRange === 'custom' && (
          <div className="pt-2 border-t border-[#F1F1F1] dark:border-[#262626] flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-[#737373]">From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#171717] dark:text-white"
            />
            <span className="text-xs font-bold text-[#737373]">To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#171717] dark:text-white"
            />
          </div>
        )}
      </div>

      {/* Statement Preview Table */}
      <div className="saas-card bg-white dark:bg-[#171717] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs overflow-hidden">
        {/* Statement Subheader */}
        <div className="px-6 py-4 bg-[#FAFAFA] dark:bg-[#1F1F1F] border-b border-[#E5E5E5] dark:border-[#2A2A2A] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <AgencyLogo size="sm" />
            <div>
              <h3 className="text-xs font-black text-[#171717] dark:text-white uppercase tracking-wider">
                Official Business Statement — {reportType.toUpperCase()} ({currentDataList.length} Records)
              </h3>
              <p className="text-[10px] font-semibold text-[#737373]">
                SRI SS GAS AGENCY · TIRUPPUR DISTRICT · PERIOD: {periodLabel.toUpperCase()}
              </p>
            </div>
          </div>

          {reportType === 'sales' && (
            <div className="text-right">
              <span className="text-[11px] font-bold text-[#737373]">Period Total: </span>
              <span className="text-sm font-black text-[#E31B23]">₹{activePeriodMetrics.gasRevenue.toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>

        {/* Content State */}
        {loading ? (
          <div className="p-12 text-center text-xs font-semibold text-[#737373]">
            Loading real business records from Supabase...
          </div>
        ) : loadError ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p className="font-bold text-red-600 text-xs">{loadError}</p>
            <button
              onClick={loadAllData}
              className="px-4 py-1.5 bg-[#E31B23] text-white text-xs font-bold rounded-xl"
            >
              Retry
            </button>
          </div>
        ) : currentDataList.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <BarChart3 className="w-8 h-8 text-[#737373] mx-auto opacity-50" />
            <p className="font-bold text-[#171717] dark:text-white text-xs">No records found for the selected period.</p>
            <p className="text-[11px] text-[#737373]">Try selecting "All Historical Records" or adjusting the date range.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* 1. SALES REPORT TABLE */}
            {reportType === 'sales' && (
              <table className="w-full text-left text-xs min-w-[760px]">
                <thead className="bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#525252] dark:text-[#D4D4D4] uppercase text-[10px] font-extrabold tracking-wider border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
                  <tr>
                    <th className="py-3.5 px-4 w-12">#</th>
                    <th className="py-3.5 px-4">Purchase Code</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Customer Name</th>
                    <th className="py-3.5 px-4">Items / Details</th>
                    <th className="py-3.5 px-4">Notes</th>
                    <th className="py-3.5 px-4 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F1F1] dark:divide-[#262626] text-[#171717] dark:text-[#F5F5F5] font-semibold">
                  {filteredPurchases.map((p, idx) => {
                    const cust = p.customer || customerMap[p.customer_id];
                    const custName = cust ? cust.name : 'Customer';
                    return (
                      <tr key={p.id} className="hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F] transition-colors">
                        <td className="py-3 px-4 font-mono text-[#737373]">{idx + 1}</td>
                        <td className="py-3 px-4 font-mono font-black text-[#E31B23]">{p.purchase_code}</td>
                        <td className="py-3 px-4 font-bold">
                          {new Date(p.purchase_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3 px-4 font-bold">
                          {cust ? (
                            <Link to={`/customers/${p.customer_id}`} className="hover:text-[#E31B23] transition-colors">
                              {custName}
                              {cust.company_name && <span className="text-[10px] text-[#737373] block font-normal">{cust.company_name}</span>}
                            </Link>
                          ) : (
                            <span>{custName}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {p.items && p.items.length > 0 ? (
                            <div className="space-y-0.5">
                              {p.items.map((it, iIdx) => (
                                <span key={iIdx} className="block text-[11px] text-[#525252] dark:text-[#D4D4D4]">
                                  {typeof it.cylinder_type === 'object' ? (it.cylinder_type as any)?.name : 'Cylinder'} × {it.quantity}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[#737373] text-[11px]">Gas Refill</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#737373] text-[11px]">{p.notes || '-'}</td>
                        <td className="py-3 px-4 text-right font-black text-[#171717] dark:text-white text-sm">
                          ₹{p.total_gas_amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* 2. CUSTOMER REGISTRY TABLE */}
            {reportType === 'customers' && (
              <table className="w-full text-left text-xs min-w-[760px]">
                <thead className="bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#525252] dark:text-[#D4D4D4] uppercase text-[10px] font-extrabold tracking-wider border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
                  <tr>
                    <th className="py-3.5 px-4 w-12">#</th>
                    <th className="py-3.5 px-4">Code</th>
                    <th className="py-3.5 px-4">Name & Company</th>
                    <th className="py-3.5 px-4">Phone</th>
                    <th className="py-3.5 px-4">Location</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F1F1] dark:divide-[#262626] text-[#171717] dark:text-[#F5F5F5] font-semibold">
                  {allCustomers.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F] transition-colors">
                      <td className="py-3 px-4 font-mono text-[#737373]">{idx + 1}</td>
                      <td className="py-3 px-4 font-mono font-black text-[#E31B23]">{c.customer_code}</td>
                      <td className="py-3 px-4 font-bold">
                        <Link to={`/customers/${c.id}`} className="hover:text-[#E31B23] transition-colors">
                          {c.name}
                        </Link>
                        {c.company_name && <span className="text-[10px] text-[#737373] block font-normal">{c.company_name}</span>}
                      </td>
                      <td className="py-3 px-4">{c.phone}</td>
                      <td className="py-3 px-4 text-[#737373]">{[c.area1, c.city || 'Tiruppur'].filter(Boolean).join(', ')}</td>
                      <td className="py-3 px-4">
                        <span className="uppercase text-[10px] font-black px-2 py-0.5 rounded-md bg-[#F1F1F1] dark:bg-[#262626] text-[#525252] dark:text-[#D4D4D4]">
                          {c.customer_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${c.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-red-50 text-red-700'}`}>
                          {c.is_active ? 'ACTIVE' : 'ARCHIVED'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 3. PAYMENTS TABLE */}
            {reportType === 'payments' && (
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#525252] dark:text-[#D4D4D4] uppercase text-[10px] font-extrabold tracking-wider border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
                  <tr>
                    <th className="py-3.5 px-4 w-12">#</th>
                    <th className="py-3.5 px-4">Receipt ID</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Method</th>
                    <th className="py-3.5 px-4 text-right">Amount Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F1F1] dark:divide-[#262626] text-[#171717] dark:text-[#F5F5F5] font-semibold">
                  {filteredPayments.map((py, idx) => {
                    const cust = py.customer || customerMap[py.customer_id];
                    return (
                      <tr key={py.id} className="hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F]">
                        <td className="py-3 px-4 font-mono text-[#737373]">{idx + 1}</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-600">RCP-{(py.id || '').slice(0, 8).toUpperCase()}</td>
                        <td className="py-3 px-4">{new Date(py.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="py-3 px-4 font-bold">{cust ? cust.name : 'Customer'}</td>
                        <td className="py-3 px-4 uppercase font-bold text-[11px] text-[#737373]">{py.payment_method}</td>
                        <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          ₹{py.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* 4. DEPOSITS TABLE */}
            {reportType === 'deposits' && (
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#525252] dark:text-[#D4D4D4] uppercase text-[10px] font-extrabold tracking-wider border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
                  <tr>
                    <th className="py-3.5 px-4 w-12">#</th>
                    <th className="py-3.5 px-4">Deposit ID</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Deposit Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F1F1] dark:divide-[#262626] text-[#171717] dark:text-[#F5F5F5] font-semibold">
                  {filteredDeposits.map((d, idx) => {
                    const cust = d.customer || customerMap[d.customer_id];
                    return (
                      <tr key={d.id} className="hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F]">
                        <td className="py-3 px-4 font-mono text-[#737373]">{idx + 1}</td>
                        <td className="py-3 px-4 font-mono font-bold text-[#4F46E5]">DEP-{(d.id || '').slice(0, 8).toUpperCase()}</td>
                        <td className="py-3 px-4">{new Date(d.transaction_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="py-3 px-4 font-bold">{cust ? cust.name : 'Customer'}</td>
                        <td className="py-3 px-4 uppercase font-bold text-[10px] text-[#4F46E5]">{d.status}</td>
                        <td className="py-3 px-4 text-right font-black text-[#4F46E5] text-sm">
                          ₹{d.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* 5. SUPPLIER PURCHASES TABLE */}
            {reportType === 'supplier' && (
              <table className="w-full text-left text-xs min-w-[760px]">
                <thead className="bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#525252] dark:text-[#D4D4D4] uppercase text-[10px] font-extrabold tracking-wider border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
                  <tr>
                    <th className="py-3.5 px-4 w-12">#</th>
                    <th className="py-3.5 px-4">Purchase Code</th>
                    <th className="py-3.5 px-4">Supplier</th>
                    <th className="py-3.5 px-4">Invoice #</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4 text-right">Paid</th>
                    <th className="py-3.5 px-4 text-right">Outstanding</th>
                    <th className="py-3.5 px-4 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F1F1] dark:divide-[#262626] text-[#171717] dark:text-[#F5F5F5] font-semibold">
                  {filteredSupplierPurchases.map((sp, idx) => (
                    <tr key={sp.id} className="hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F]">
                      <td className="py-3 px-4 font-mono text-[#737373]">{idx + 1}</td>
                      <td className="py-3 px-4 font-mono font-black text-[#E31B23]">{sp.purchase_code}</td>
                      <td className="py-3 px-4 font-bold">{sp.supplier_name}</td>
                      <td className="py-3 px-4 font-mono text-[11px]">{sp.invoice_number}</td>
                      <td className="py-3 px-4">{new Date(sp.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">₹{(sp.amount_paid || 0).toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 text-right font-bold text-red-600">₹{(sp.outstanding_amount || 0).toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 text-right font-black text-[#171717] dark:text-white text-sm">
                        ₹{sp.total_amount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 6. DELIVERIES TABLE */}
            {reportType === 'deliveries' && (
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#525252] dark:text-[#D4D4D4] uppercase text-[10px] font-extrabold tracking-wider border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
                  <tr>
                    <th className="py-3.5 px-4 w-12">#</th>
                    <th className="py-3.5 px-4">Delivery Code</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Destination</th>
                    <th className="py-3.5 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F1F1] dark:divide-[#262626] text-[#171717] dark:text-[#F5F5F5] font-semibold">
                  {filteredDeliveries.map((del, idx) => {
                    const cust = del.customer || customerMap[del.customer_id];
                    return (
                      <tr key={del.id} className="hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F]">
                        <td className="py-3 px-4 font-mono text-[#737373]">{idx + 1}</td>
                        <td className="py-3 px-4 font-mono font-bold text-[#E31B23]">{del.delivery_code}</td>
                        <td className="py-3 px-4">{new Date(del.delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="py-3 px-4 font-bold">{cust ? cust.name : 'Customer'}</td>
                        <td className="py-3 px-4 text-[#737373] truncate max-w-xs">{del.delivery_address}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${del.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-amber-50 text-amber-700'}`}>
                            {del.status?.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

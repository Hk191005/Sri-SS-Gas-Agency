import React, { useState, useEffect } from 'react';
import {
  getPurchases,
  getPayments,
  getDeposits,
  getCustomers,
  getDeliveries,
} from '../lib/db';
import { getSupplierPurchases } from '../lib/supplierDb';
import { AgencyLogo } from '../components/branding/AgencyLogo';
import { BarChart3, Download } from 'lucide-react';

export const Reports: React.FC = () => {
  const [reportType, setReportType] = useState<'sales' | 'customers' | 'payments' | 'deposits' | 'supplier' | 'deliveries'>('sales');
  const [dateRange, setDateRange] = useState<'this_month' | 'this_week' | 'last_month' | 'all'>('this_month');
  const [dataList, setDataList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Financial KPI totals
  const [totalGasRevenue, setTotalGasRevenue] = useState(0);
  const [totalDepositsHeld, setTotalDepositsHeld] = useState(0);
  const [totalCollections, setTotalCollections] = useState(0);
  const [totalSupplierCosts, setTotalSupplierCosts] = useState(0);

  const loadReport = async () => {
    setLoading(true);
    try {
      const [purchases, customersRes, payments, deposits, supplierP, deliveries] = await Promise.all([
        getPurchases(),
        getCustomers({ limit: 1000 }),
        getPayments(),
        getDeposits(),
        getSupplierPurchases(),
        getDeliveries(),
      ]);

      // Calculate global segregated totals
      const gasRev = purchases.reduce((sum, p) => sum + (p.total_gas_amount || 0), 0);
      const depHeld = deposits
        .filter((d) => d.status === 'given' || d.status === 'held')
        .reduce((sum, d) => sum + (d.amount || 0), 0);
      const paid = payments.reduce((sum, py) => sum + (py.amount || 0), 0);
      const supCost = supplierP.reduce((sum, sp) => sum + (sp.total_amount || 0), 0);

      setTotalGasRevenue(gasRev);
      setTotalDepositsHeld(depHeld);
      setTotalCollections(paid);
      setTotalSupplierCosts(supCost);

      if (reportType === 'sales') {
        setDataList(purchases);
      } else if (reportType === 'customers') {
        setDataList(customersRes.customers);
      } else if (reportType === 'payments') {
        setDataList(payments);
      } else if (reportType === 'deposits') {
        setDataList(deposits);
      } else if (reportType === 'supplier') {
        setDataList(supplierP);
      } else if (reportType === 'deliveries') {
        setDataList(deliveries);
      }
    } catch (e) {
      console.error('Reports load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportType, dateRange]);

  const handleExportCSV = () => {
    if (dataList.length === 0) return;

    let headers: string[] = [];
    let rows: string[][] = [];

    if (reportType === 'sales') {
      headers = ['Purchase Code', 'Date', 'Customer ID', 'Total Amount', 'Notes'];
      rows = dataList.map((p) => [
        p.purchase_code,
        p.purchase_date,
        p.customer_id,
        p.total_gas_amount.toString(),
        p.notes || '',
      ]);
    } else if (reportType === 'customers') {
      headers = ['Customer ID', 'Customer Type', 'Name', 'Company', 'Phone', 'Area', 'City', 'District', 'Pincode', 'Status'];
      rows = dataList.map((c) => [
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
      headers = ['Receipt ID', 'Date', 'Customer ID', 'Payment Method', 'Amount'];
      rows = dataList.map((p) => [
        `RCP-${(p.id || '').slice(0, 8).toUpperCase()}`,
        p.payment_date,
        p.customer_id,
        p.payment_method,
        p.amount.toString(),
      ]);
    } else if (reportType === 'deposits') {
      headers = ['Deposit ID', 'Customer ID', 'Amount', 'Status', 'Notes'];
      rows = dataList.map((d) => [
        `DEP-${(d.id || '').slice(0, 8).toUpperCase()}`,
        d.customer_id,
        d.amount.toString(),
        d.status,
        d.notes || '',
      ]);
    } else if (reportType === 'supplier') {
      headers = ['Purchase Code', 'Supplier Name', 'Invoice #', 'Invoice Date', 'Total Amount', 'Paid', 'Outstanding'];
      rows = dataList.map((sp) => [
        sp.purchase_code,
        sp.supplier_name,
        sp.invoice_number,
        sp.invoice_date,
        sp.total_amount.toString(),
        sp.amount_paid.toString(),
        sp.outstanding_amount.toString(),
      ]);
    } else if (reportType === 'deliveries') {
      headers = ['Delivery Code', 'Date', 'Customer ID', 'Address', 'Status'];
      rows = dataList.map((d) => [
        d.delivery_code,
        d.created_at,
        d.customer_id,
        d.delivery_address || '',
        d.status,
      ]);
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SRI_SS_GAS_${reportType.toUpperCase()}_REPORT.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#171717] dark:text-white tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-[#E31B23]" /> Business Reports & CSV Statements
          </h1>
          <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4] mt-1">
            Generate financial statements, sales reports, supplier stock purchases & delivery reports with safe CSV export
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={dataList.length === 0}
          className="flex items-center justify-center gap-2 bg-[#E31B23] hover:bg-[#C9151C] text-white font-black text-xs px-4 py-2.5 rounded-[12px] shadow-[0_6px_18px_rgba(227,27,35,0.16)] transition-all disabled:opacity-50 active:scale-98 shrink-0"
        >
          <Download className="w-4 h-4" /> Export CSV Statement
        </button>
      </div>

      {/* Segregated Financial Overview KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="saas-card p-4 rounded-2xl bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs">
          <span className="text-[10px] font-bold text-[#737373] uppercase tracking-wider block">
            Total Gas Revenue
          </span>
          <span className="text-xl font-black text-[#111111] dark:text-white mt-1 block">
            ₹{totalGasRevenue.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] font-semibold text-[#16A34A] block mt-0.5">
            Cylinder refill sales
          </span>
        </div>

        <div className="saas-card p-4 rounded-2xl bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs">
          <span className="text-[10px] font-bold text-[#737373] uppercase tracking-wider block">
            Security Deposits Held
          </span>
          <span className="text-xl font-black text-[#4F46E5] mt-1 block">
            ₹{totalDepositsHeld.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] font-semibold text-[#737373] block mt-0.5">
            Refundable held liability
          </span>
        </div>

        <div className="saas-card p-4 rounded-2xl bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs">
          <span className="text-[10px] font-bold text-[#737373] uppercase tracking-wider block">
            Customer Collections
          </span>
          <span className="text-xl font-black text-[#16A34A] mt-1 block">
            ₹{totalCollections.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] font-semibold text-[#737373] block mt-0.5">
            Realized cash & UPI
          </span>
        </div>

        <div className="saas-card p-4 rounded-2xl bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs">
          <span className="text-[10px] font-bold text-[#737373] uppercase tracking-wider block">
            Supplier Stock Costs
          </span>
          <span className="text-xl font-black text-[#DC2626] mt-1 block">
            ₹{totalSupplierCosts.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] font-semibold text-[#737373] block mt-0.5">
            Plant inventory purchases
          </span>
        </div>
      </div>

      {/* Report Category Select & Controls */}
      <div className="saas-card bg-white dark:bg-[#171717] p-4 rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] p-1 rounded-xl overflow-x-auto border border-[#E5E5E5] dark:border-[#2A2A2A]">
          {[
            { id: 'sales', label: 'Gas Sales' },
            { id: 'customers', label: 'Customers Registry' },
            { id: 'supplier', label: 'Stock Purchases' },
            { id: 'payments', label: 'Customer Payments' },
            { id: 'deposits', label: 'Deposits' },
            { id: 'deliveries', label: 'Deliveries' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setReportType(t.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap transition-all border ${
                reportType === t.id
                  ? 'bg-[#FFF1F2] text-[#C9151C] border-[#FFD6D8] shadow-2xs'
                  : 'text-[#404040] dark:text-[#D4D4D4] border-transparent hover:text-[#171717]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <select
          value={dateRange}
          onChange={(e: any) => setDateRange(e.target.value)}
          className="px-3.5 py-2 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#171717] dark:text-white focus:outline-none"
        >
          <option value="this_month">This Month</option>
          <option value="this_week">This Week</option>
          <option value="last_month">Last Month</option>
          <option value="all">All Historical Records</option>
        </select>
      </div>

      {/* Preview Table & Official Statement Header */}
      <div className="saas-card bg-white dark:bg-[#171717] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-[#FAFAFA] dark:bg-[#1F1F1F] border-b border-[#E5E5E5] dark:border-[#2A2A2A] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AgencyLogo size="sm" />
            <div>
              <h3 className="text-xs font-black text-[#171717] dark:text-white uppercase tracking-wider">
                Official Business Statement — {reportType.toUpperCase()} ({dataList.length} Records)
              </h3>
              <p className="text-[10px] font-semibold text-[#737373]">SRI SS GAS AGENCY · TIRUPPUR DISTRICT</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs font-semibold text-[#737373]">Generating statement preview...</div>
        ) : dataList.length === 0 ? (
          <div className="p-12 text-center text-xs font-semibold text-[#737373]">No data records found for selected statement parameters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-semibold">
              <thead className="bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#525252] uppercase text-[10px] font-extrabold tracking-wider border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Primary Identifier</th>
                  <th className="py-3 px-4">Record Details</th>
                  <th className="py-3 px-4 text-right">Amount / Metric</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F1F1] dark:divide-[#262626] text-[#171717] dark:text-[#F5F5F5]">
                {dataList.slice(0, 20).map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F]">
                    <td className="py-3 px-4 font-mono text-[#737373]">{idx + 1}</td>
                    <td className="py-3 px-4 font-mono font-black text-[#E31B23]">
                      {row.purchase_code || row.customer_code || row.payment_code || row.delivery_code || row.invoice_number || `REC-${idx + 1}`}
                    </td>
                    <td className="py-3 px-4 font-bold">
                      {row.name || row.supplier_name || row.delivery_address || row.notes || 'System Transaction Log'}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-[#171717] dark:text-white">
                      {row.total_gas_amount || row.total_amount || row.amount ? `₹${(row.total_gas_amount || row.total_amount || row.amount).toLocaleString('en-IN')}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

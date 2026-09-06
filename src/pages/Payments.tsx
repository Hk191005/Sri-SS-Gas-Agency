import React, { useState, useEffect } from 'react';
import type { Payment, Deposit, Customer } from '../types/database.types';
import { getCustomers, getPayments, getDeposits, getPurchases } from '../lib/db';
import { getSupplierPurchases } from '../lib/supplierDb';
import { AddPaymentModal } from '../components/payments/AddPaymentModal';
import { CreditCard, Plus, ArrowUpRight, Building2, Database, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Payments: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [supplierPayables, setSupplierPayables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [activeTab, setActiveTab] = useState<'receivables' | 'payments' | 'deposits' | 'supplier_payables'>('receivables');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [pmts, deps, custs, purList, supList] = await Promise.all([
        getPayments(),
        getDeposits(),
        getCustomers({ limit: 1000 }),
        getPurchases(),
        getSupplierPurchases(),
      ]);

      setPayments(pmts);
      setDeposits(deps);
      setCustomers(custs.customers || []);
      setPurchases(purList);
      setSupplierPayables(supList);
    } catch (e: any) {
      console.error(e);
      setLoadError(e.message || 'Failed to load financial registers from database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);
  const totalSupplierPayable = supplierPayables.reduce((sum, sp) => sum + (sp.outstanding_amount || 0), 0);

  const customerMap = customers.reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {} as Record<string, Customer>);

  // Derive Customer Receivables Map
  const customerPurchasesMap = purchases.reduce((acc, p) => {
    acc[p.customer_id] = (acc[p.customer_id] || 0) + (p.total_gas_amount || 0);
    return acc;
  }, {} as Record<string, number>);

  const customerPaymentsMap = payments.reduce((acc, p) => {
    acc[p.customer_id] = (acc[p.customer_id] || 0) + (p.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  const receivablesCustomers = customers
    .map((c) => {
      const totalPurchased = customerPurchasesMap[c.id] || 0;
      const totalPaid = customerPaymentsMap[c.id] || 0;
      const outstanding = Math.max(0, totalPurchased - totalPaid);
      return { customer: c, outstanding };
    })
    .filter((rc) => rc.outstanding > 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#171717] dark:text-white tracking-tight flex items-center gap-2.5">
            <CreditCard className="w-7 h-7 text-[#E31B23]" /> Finance & Collections Hub
          </h1>
          <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4] mt-1">
            Manage customer receivables, payment receipts, held cylinder deposits & supplier payables
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-[#E31B23] hover:bg-[#C9151C] text-white font-black text-xs px-4.5 py-2.5 rounded-[12px] shadow-[0_6px_18px_rgba(227,27,35,0.16)] transition-all active:scale-98 shrink-0"
        >
          <Plus className="w-4 h-4" /> Record Customer Payment
        </button>
      </div>

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] p-5 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#525252] dark:text-[#A3A3A3] block">Customer Collections Logged</span>
            <span className="text-2xl font-black text-[#16A34A] dark:text-emerald-400 mt-1 block">₹{totalCollected.toLocaleString('en-IN')}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/30 text-[#16A34A] flex items-center justify-center border border-emerald-200/60 dark:border-emerald-900/40">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] p-5 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#525252] dark:text-[#A3A3A3] block">Active Held Deposits</span>
            <span className="text-2xl font-black text-[#171717] dark:text-white mt-1 block">₹{totalDeposits.toLocaleString('en-IN')}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#FAFAFA] dark:bg-[#222] text-[#171717] dark:text-white flex items-center justify-center border border-[#E5E5E5] dark:border-[#333]">
            <Database className="w-5 h-5" />
          </div>
        </div>

        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] p-5 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#525252] dark:text-[#A3A3A3] block">Supplier Payables Balance</span>
            <span className="text-2xl font-black text-[#D97706] dark:text-amber-400 mt-1 block">₹{totalSupplierPayable.toLocaleString('en-IN')}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#FFFBEB] dark:bg-amber-950/30 text-[#D97706] flex items-center justify-center border border-amber-200/60 dark:border-amber-900/40">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#F1F1F1] dark:border-[#262626] pb-2 overflow-x-auto text-xs font-extrabold">
        {[
          { id: 'receivables', label: `Customer Receivables (${receivablesCustomers.length})` },
          { id: 'payments', label: `Payment History (${payments.length})` },
          { id: 'deposits', label: `Security Deposits (${deposits.length})` },
          { id: 'supplier_payables', label: `Supplier Payables (${supplierPayables.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all border ${
              activeTab === tab.id
                ? 'bg-[#FFF1F2] text-[#C9151C] border-[#FFD6D8] font-black shadow-2xs'
                : 'bg-white dark:bg-[#171717] text-[#525252] dark:text-[#D4D4D4] border-[#E5E5E5] dark:border-[#2A2A2A] hover:bg-[#FAFAFA]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Panels */}
      {loading ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-12 text-center rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] text-xs font-semibold text-[#737373]">
          Loading financial registers and outstanding balances...
        </div>
      ) : loadError ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-8 text-center rounded-2xl border border-red-200 dark:border-red-900/50 space-y-3">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="font-black text-red-600 dark:text-red-400 text-sm">Failed to load finance data</p>
          <p className="text-xs text-[#737373] max-w-md mx-auto">{loadError}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-[#E31B23] text-white text-xs font-bold rounded-xl hover:bg-[#C9151C] transition-colors"
          >
            Retry Loading
          </button>
        </div>
      ) : activeTab === 'receivables' ? (
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[650px] text-left text-xs font-semibold">
              <thead className="bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#525252] uppercase text-[10px] font-extrabold tracking-wider border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
                <tr>
                  <th className="py-3.5 px-4">Customer Code</th>
                  <th className="py-3.5 px-4">Customer Name</th>
                  <th className="py-3.5 px-4">Contact Phone</th>
                  <th className="py-3.5 px-4">Outstanding Balance</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F1F1] dark:divide-[#262626] text-[#171717] dark:text-[#F5F5F5]">
                {receivablesCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#737373]">No outstanding customer receivables. All accounts clear!</td>
                  </tr>
                ) : (
                  receivablesCustomers.map(({ customer, outstanding }) => (
                    <tr key={customer.id} className="hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-black text-[#C9151C]">{customer.customer_code}</td>
                      <td className="py-3.5 px-4 font-black">
                        <Link to={`/customers/${customer.id}`} className="hover:text-[#E31B23] transition-colors">
                          {customer.name}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-bold">{customer.phone}</td>
                      <td className="py-3.5 px-4 font-black text-[#DC2626]">₹{outstanding.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/customers/${customer.id}`}
                          className="inline-flex items-center gap-1 text-xs font-black text-[#E31B23] hover:underline"
                        >
                          View Account <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'payments' ? (
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[650px] text-left text-xs font-semibold">
              <thead className="bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#525252] uppercase text-[10px] font-extrabold tracking-wider border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
                <tr>
                  <th className="py-3.5 px-4">Receipt ID</th>
                  <th className="py-3.5 px-4">Payment Date</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Payment Method</th>
                  <th className="py-3.5 px-4">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F1F1] dark:divide-[#262626] text-[#171717] dark:text-[#F5F5F5]">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#737373]">No customer payments logged.</td>
                  </tr>
                ) : (
                  payments.map((p) => {
                    const cust = customerMap[p.customer_id];
                    return (
                      <tr key={p.id} className="hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F]">
                        <td className="py-3.5 px-4 font-mono font-black text-[#16A34A]">RCP-{(p.id || '').slice(0, 8).toUpperCase()}</td>
                        <td className="py-3.5 px-4 font-bold">{p.payment_date}</td>
                        <td className="py-3.5 px-4">
                          {cust ? (
                            <Link to={`/customers/${cust.id}`} className="font-black text-[#171717] dark:text-white hover:text-[#E31B23]">
                              {cust.name}
                            </Link>
                          ) : (
                            <span className="font-mono text-[#737373]">{p.customer_id.substring(0, 8)}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 capitalize font-bold text-[#525252] dark:text-[#D4D4D4]">{p.payment_method}</td>
                        <td className="py-3.5 px-4 font-black text-[#16A34A] text-sm">₹{p.amount.toLocaleString('en-IN')}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'deposits' ? (
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[650px] text-left text-xs font-semibold">
              <thead className="bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#525252] uppercase text-[10px] font-extrabold tracking-wider border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
                <tr>
                  <th className="py-3.5 px-4">Deposit ID</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Particulars</th>
                  <th className="py-3.5 px-4">Amount Held</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F1F1] dark:divide-[#262626] text-[#171717] dark:text-[#F5F5F5]">
                {deposits.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#737373]">No security deposits recorded.</td>
                  </tr>
                ) : (
                  deposits.map((d) => {
                    const cust = customerMap[d.customer_id];
                    return (
                      <tr key={d.id} className="hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F]">
                        <td className="py-3.5 px-4 font-mono font-black text-[#171717] dark:text-white">DEP-{(d.id || '').slice(0, 8).toUpperCase()}</td>
                        <td className="py-3.5 px-4">
                          {cust ? (
                            <Link to={`/customers/${cust.id}`} className="font-black text-[#171717] dark:text-white hover:text-[#E31B23]">
                              {cust.name}
                            </Link>
                          ) : (
                            <span className="font-mono text-[#737373]">{d.customer_id.substring(0, 8)}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-bold">{d.notes || 'Cylinder Security Deposit'}</td>
                        <td className="py-3.5 px-4 font-black text-[#171717] dark:text-white">₹{d.amount.toLocaleString('en-IN')}</td>
                        <td className="py-3.5 px-4">
                          <span className="inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A] border border-emerald-200/60">
                            {d.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[650px] text-left text-xs font-semibold">
              <thead className="bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#525252] uppercase text-[10px] font-extrabold tracking-wider border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
                <tr>
                  <th className="py-3.5 px-4">Purchase Code</th>
                  <th className="py-3.5 px-4">Supplier</th>
                  <th className="py-3.5 px-4">Invoice #</th>
                  <th className="py-3.5 px-4">Total Amount</th>
                  <th className="py-3.5 px-4">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F1F1] dark:divide-[#262626] text-[#171717] dark:text-[#F5F5F5]">
                {supplierPayables.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#737373]">No supplier payables recorded.</td>
                  </tr>
                ) : (
                  supplierPayables.map((sp) => (
                    <tr key={sp.id} className="hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F]">
                      <td className="py-3.5 px-4 font-mono font-black text-[#E31B23]">{sp.purchase_code}</td>
                      <td className="py-3.5 px-4 font-black">{sp.supplier_name}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#737373]">#{sp.invoice_number}</td>
                      <td className="py-3.5 px-4 font-black text-[#171717] dark:text-white">₹{(sp.total_amount || 0).toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 font-black text-[#D97706]">₹{(sp.outstanding_amount || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      <AddPaymentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
};

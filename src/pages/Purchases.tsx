import React, { useState, useEffect } from 'react';
import type { Purchase } from '../types/database.types';
import { getPurchases } from '../lib/db';
import { AddPurchaseModal } from '../components/purchases/AddPurchaseModal';
import { ShoppingBag, Search, Plus, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Purchases: React.FC = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const list = await getPurchases({ search });
      setPurchases(list);
    } catch (e: any) {
      console.error(e);
      setLoadError(e.message || 'Failed to load sales history from database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#171717] dark:text-white tracking-tight flex items-center gap-2.5">
            <ShoppingBag className="w-7 h-7 text-[#E31B23]" /> Sales History
          </h1>
          <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4] mt-1">Complete register of all customer gas cylinder sales & refill invoices</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-[#E31B23] hover:bg-[#C9151C] text-white font-black text-xs px-4.5 py-2.5 rounded-[12px] shadow-[0_6px_18px_rgba(227,27,35,0.16)] transition-all active:scale-98 shrink-0"
        >
          <Plus className="w-4 h-4" /> Add New Sale
        </button>
      </div>

      {/* Search Bar */}
      <div className="saas-card bg-white dark:bg-[#171717] p-4 rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-[#737373] absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Purchase Code (PUR-000001) or Customer Name..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-semibold text-[#171717] dark:text-white placeholder-[#737373] focus:outline-none focus:ring-2 focus:ring-[#E31B23]/20"
          />
        </div>
      </div>

      {/* Content Table / Cards */}
      {loading ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-12 text-center rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] text-xs font-semibold text-[#737373]">
          Loading sales records...
        </div>
      ) : loadError ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-8 text-center rounded-2xl border border-red-200 dark:border-red-900/50 space-y-3">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="font-black text-red-600 dark:text-red-400 text-sm">Failed to load sales history</p>
          <p className="text-xs text-[#737373] max-w-md mx-auto">{loadError}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-[#E31B23] text-white text-xs font-bold rounded-xl hover:bg-[#C9151C] transition-colors"
          >
            Retry Loading
          </button>
        </div>
      ) : purchases.length === 0 ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-12 text-center rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] space-y-2">
          <ShoppingBag className="w-10 h-10 text-[#737373] mx-auto" />
          <p className="font-black text-[#171717] dark:text-white text-sm">No sales recorded yet</p>
          <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4]">Click "Add New Sale" to log a new cylinder order.</p>
        </div>
      ) : (
        <div className="saas-card bg-white dark:bg-[#171717] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAFAFA] dark:bg-[#1F1F1F] border-b border-[#E5E5E5] dark:border-[#2A2A2A] font-extrabold text-[#525252] dark:text-[#D4D4D4] uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Purchase Code</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Items / Qty</th>
                  <th className="py-3.5 px-4">Total Amount</th>
                  <th className="py-3.5 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F1F1] dark:divide-[#262626] text-[#171717] dark:text-[#F5F5F5] font-semibold">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-black text-[#E31B23]">{p.purchase_code}</td>
                    <td className="py-3.5 px-4 font-bold">
                      {new Date(p.purchase_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-4">
                      {p.customer ? (
                        <Link to={`/customers/${p.customer_id}`} className="font-black text-[#171717] dark:text-white hover:text-[#E31B23]">
                          {p.customer.name}
                        </Link>
                      ) : (
                        <span className="text-[#737373]">Customer ID: {p.customer_id.substring(0, 8)}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {p.items && p.items.length > 0 ? (
                        <div className="space-y-0.5">
                          {p.items.map((it, idx) => (
                            <span key={idx} className="block text-[11px] font-bold text-[#525252] dark:text-[#D4D4D4]">
                              {typeof it.cylinder_type === 'object' ? (it.cylinder_type as any)?.name : String(it.cylinder_type || '')} × {it.quantity} (₹{it.unit_price}/each)
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[#737373]">Gas Refill Order</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-black text-[#171717] dark:text-white text-sm">
                      ₹{p.total_gas_amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-[#737373]">{p.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      <AddPurchaseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
};

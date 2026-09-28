import React, { useState, useEffect } from 'react';
import type { Purchase } from '../types/database.types';
import { getPurchases } from '../lib/db';
import { AddPurchaseModal } from '../components/purchases/AddPurchaseModal';
import { EditPurchaseDateModal } from '../components/purchases/EditPurchaseDateModal';
import { DeletePurchaseModal } from '../components/purchases/DeletePurchaseModal';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import { ShoppingBag, Search, Plus, AlertTriangle, Calendar, Edit2, Trash2, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Purchases: React.FC = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [deletingPurchase, setDeletingPurchase] = useState<Purchase | null>(null);

  const { showSuccess } = useToast();

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
    <div className="space-y-6 max-w-7xl mx-auto w-full min-w-0">
      {/* Header */}
      <PageHeader
        title="Sales History"
        subtitle="Complete register of all customer gas cylinder sales & refill invoices"
        icon={<ShoppingBag className="w-5 h-5 text-[#E31B23]" />}
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => setIsAddModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Add New Sale
          </Button>
        }
      />

      {/* Search Bar */}
      <div className="saas-card bg-white dark:bg-[#171717] p-4 rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-[#737373] absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Purchase Code (PUR-000001) or Customer Name..."
            className="w-full pl-10 pr-4 py-2.5 min-h-[44px] bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-semibold text-[#171717] dark:text-white placeholder-[#737373] focus:outline-none focus:ring-2 focus:ring-[#E31B23]/20 input-focus-smooth"
          />
        </div>
      </div>

      {/* Content Table / Cards */}
      {loading ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-12 text-center rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] text-xs font-semibold text-[#737373]">
          Loading sales records...
        </div>
      ) : loadError ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-8 text-center rounded-2xl border border-red-200 dark:border-red-900/50">
          <EmptyState
            title="Failed to load sales history"
            description={loadError}
            icon={<AlertTriangle className="w-6 h-6 text-red-500" />}
            action={
              <Button variant="primary" size="sm" onClick={loadData}>
                Retry Loading
              </Button>
            }
          />
        </div>
      ) : purchases.length === 0 ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-8 text-center rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A]">
          <EmptyState
            title="No sales recorded yet"
            description="Click 'Add New Sale' to log a new cylinder order."
            icon={<ShoppingBag className="w-6 h-6 text-[#737373]" />}
            action={
              <Button variant="primary" size="sm" onClick={() => setIsAddModalOpen(true)} icon={<Plus className="w-4 h-4" />}>
                Add New Sale
              </Button>
            }
          />
        </div>
      ) : (
        <div className="saas-card bg-white dark:bg-[#171717] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs overflow-hidden">
          <div className="overflow-x-auto w-full max-w-full min-w-0">
            <table className="w-full min-w-[760px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAFAFA] dark:bg-[#1F1F1F] border-b border-[#E5E5E5] dark:border-[#2A2A2A] font-bold text-[#525252] dark:text-[#D4D4D4] text-xs">
                  <th className="py-3.5 px-4">Purchase Code</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Items / Qty</th>
                  <th className="py-3.5 px-4">Total Amount</th>
                  <th className="py-3.5 px-4">Notes</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F1F1] dark:divide-[#262626] text-[#171717] dark:text-[#F5F5F5] font-semibold">
                {purchases.map((p) => (
                  <tr key={p.id} className="table-row-enter hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">{p.purchase_code}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#171717] dark:text-white">
                          {p.purchase_date}
                        </span>
                        <button
                          onClick={() => setEditingPurchase(p)}
                          title="Edit transaction date"
                          className="p-1 text-[#737373] hover:text-[#E31B23] hover:bg-[#FFF1F2] dark:hover:bg-red-950/30 rounded-md transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {p.customer ? (
                        <Link to={`/customers/${p.customer_id}`} className="font-black text-[#171717] dark:text-white hover:underline hover:text-[#E31B23] transition-colors">
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
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/billing?saleId=${p.id}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FFF1F2] dark:bg-red-950/40 border border-[#FECDD3] dark:border-red-900/40 text-[#E31B23] hover:bg-[#E31B23] hover:text-white text-[11px] font-bold rounded-lg transition-colors shadow-2xs"
                          title="View approved A4 customer bill"
                        >
                          <FileText className="w-3 h-3" />
                          <span>View Bill</span>
                        </Link>
                        <button
                          onClick={() => setEditingPurchase(p)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-[#222] border border-[#E5E5E5] dark:border-[#333] hover:border-[#E31B23] text-[#171717] dark:text-white hover:text-[#E31B23] text-[11px] font-bold rounded-lg transition-colors shadow-2xs"
                          title="Edit purchase transaction date"
                        >
                          <Calendar className="w-3 h-3 text-[#E31B23]" />
                          <span>Edit Date</span>
                        </button>
                        <button
                          onClick={() => setDeletingPurchase(p)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-[#222] border border-red-200 dark:border-red-900/40 hover:bg-[#FFF1F2] dark:hover:bg-red-950/30 text-[#DC2626] text-[11px] font-bold rounded-lg transition-colors shadow-2xs"
                          title="Delete purchase record"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
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

      {/* Edit Purchase Date Modal */}
      <EditPurchaseDateModal
        isOpen={Boolean(editingPurchase)}
        purchase={editingPurchase}
        onClose={() => setEditingPurchase(null)}
        onSuccess={loadData}
      />

      {/* Delete Confirmation Modal */}
      <DeletePurchaseModal
        isOpen={Boolean(deletingPurchase)}
        purchase={deletingPurchase}
        onClose={() => setDeletingPurchase(null)}
        onSuccess={(msg) => {
          showSuccess(msg || 'Purchase deleted successfully.');
          loadData();
        }}
      />
    </div>
  );
};


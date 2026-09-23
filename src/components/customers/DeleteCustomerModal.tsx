import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, ShieldAlert, X, Loader2 } from 'lucide-react';
import type { Customer } from '../../types/database.types';
import { deleteCustomer } from '../../lib/db';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface DeleteCustomerModalProps {
  isOpen: boolean;
  customer: Customer | null;
  onClose: () => void;
  onDeleted: (result: { mode: 'permanently_deleted' | 'soft_deleted'; message: string }) => void;
}

export const DeleteCustomerModal: React.FC<DeleteCustomerModalProps> = ({
  isOpen,
  customer,
  onClose,
  onDeleted,
}) => {
  const [loadingDependencies, setLoadingDependencies] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [stats, setStats] = useState<{
    purchases: number;
    payments: number;
    deposits: number;
    deliveries: number;
  }>({ purchases: 0, payments: 0, deposits: 0, deliveries: 0 });

  useEffect(() => {
    if (isOpen && customer) {
      checkDependencies(customer.id);
    } else {
      setErrorMsg('');
      setDeleting(false);
    }
  }, [isOpen, customer]);

  const checkDependencies = async (customerId: string) => {
    setLoadingDependencies(true);
    setErrorMsg('');
    try {
      if (isSupabaseConfigured()) {
        const [pRes, pyRes, dRes, delRes] = await Promise.all([
          supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
          supabase.from('payments').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
          supabase.from('deposits').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
          supabase.from('deliveries').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
        ]);
        setStats({
          purchases: pRes.count || 0,
          payments: pyRes.count || 0,
          deposits: dRes.count || 0,
          deliveries: delRes.count || 0,
        });
      }
    } catch (e: any) {
      console.error('Failed to inspect customer records:', e);
    } finally {
      setLoadingDependencies(false);
    }
  };

  if (!isOpen || !customer) return null;

  const totalHistory = stats.purchases + stats.payments + stats.deposits + stats.deliveries;
  const isSoftDelete = totalHistory > 0;

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setErrorMsg('');

    try {
      const res = await deleteCustomer(customer.id);
      onDeleted(res);
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to delete customer.');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs backdrop-enter">
      <div className="bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl shadow-xl w-full max-w-md overflow-hidden modal-enter">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#F1F5F9] dark:border-[#262626] flex items-center justify-between bg-[#FFF1F2] dark:bg-red-950/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FFE4E6] dark:bg-red-900/40 text-[#E31B23] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#111111] dark:text-white">
                {isSoftDelete ? 'Archive Customer Account' : 'Delete Customer Account'}
              </h3>
              <p className="text-[11px] font-bold text-[#DC2626] dark:text-red-400">
                {customer.customer_code} · {customer.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={deleting}
            className="text-[#737373] hover:text-[#111111] dark:hover:text-white p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-[#FFF1F2] dark:bg-red-950/30 border border-[#FFD6D8] dark:border-red-900/40 rounded-xl text-xs font-bold text-[#DC2626] dark:text-red-400">
              {errorMsg}
            </div>
          )}

          {loadingDependencies ? (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-xs font-bold text-[#737373]">
              <Loader2 className="w-6 h-6 animate-spin text-[#E31B23]" />
              <span>Verifying customer financial records & audit trails...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {isSoftDelete ? (
                <div className="space-y-3">
                  <div className="p-3.5 bg-[#FFFBEB] dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-black text-[#D97706] dark:text-amber-400">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>Historical Transactions Detected</span>
                    </div>
                    <p className="text-[11px] font-semibold text-[#525252] dark:text-[#D4D4D4] leading-relaxed">
                      This customer has <strong className="text-[#111111] dark:text-white font-black">{totalHistory} recorded entries</strong> ({stats.purchases} sales, {stats.payments} payments, {stats.deposits} deposits, {stats.deliveries} deliveries).
                    </p>
                  </div>

                  <p className="text-xs font-semibold text-[#525252] dark:text-[#A3A3A3] leading-relaxed">
                    To preserve tax compliance, ledger audits, and financial accuracy, this account will be <strong>archived and deactivated</strong>. It will be removed from all active dropdowns and customer lists while retaining historical ledger entries.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4] leading-relaxed">
                    This customer account has <strong className="text-[#059669]">0 historical transactions</strong>. Proceeding will <strong>permanently delete</strong> the profile and address records from the database.
                  </p>
                  <p className="text-[11px] font-bold text-[#DC2626]">This action cannot be undone.</p>
                </div>
              )}

              {/* Customer summary box */}
              <div className="p-3 bg-[#F8FAFC] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#737373] font-bold">Customer Name:</span>
                  <span className="font-black text-[#111111] dark:text-white">{customer.name}</span>
                </div>
                {customer.company_name && (
                  <div className="flex justify-between">
                    <span className="text-[#737373] font-bold">Company:</span>
                    <span className="font-semibold text-[#525252] dark:text-[#D4D4D4]">{customer.company_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#737373] font-bold">Phone:</span>
                  <span className="font-semibold text-[#525252] dark:text-[#D4D4D4]">{customer.phone}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#F1F5F9] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2.5 min-h-[44px] rounded-xl border border-[#D1D5DB] dark:border-[#2A2A2A] text-xs font-bold text-[#525252] dark:text-[#D4D4D4] hover:bg-white dark:hover:bg-[#262626] transition-all disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || loadingDependencies}
            className="flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-black shadow-xs transition-all disabled:opacity-50"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>{isSoftDelete ? 'Archive Customer' : 'Permanently Delete'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

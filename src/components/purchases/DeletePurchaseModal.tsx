import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, Loader2, Calendar, User, DollarSign, Package } from 'lucide-react';
import type { Purchase } from '../../types/database.types';
import { deletePurchase } from '../../lib/db';

interface DeletePurchaseModalProps {
  isOpen: boolean;
  purchase: Purchase | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const DeletePurchaseModal: React.FC<DeletePurchaseModalProps> = ({
  isOpen,
  purchase,
  onClose,
  onSuccess,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !purchase) return null;

  const customerName = purchase.customer?.name || 'Unknown Customer';
  const formattedAmount = `₹${(purchase.total_gas_amount || 0).toLocaleString('en-IN')}`;

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setErrorMsg('');

    try {
      const res = await deletePurchase(purchase.id);
      onSuccess(res.message);
      onClose();
    } catch (err: any) {
      console.error('Failed to delete purchase:', err);
      setErrorMsg(err.message || 'Failed to delete purchase. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs backdrop-enter">
      <div className="bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl shadow-xl w-full max-w-md overflow-hidden modal-enter">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#F1F5F9] dark:border-[#262626] flex items-center justify-between bg-[#FFF1F2] dark:bg-red-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFE4E6] dark:bg-red-900/40 text-[#E31B23] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#111111] dark:text-white">
                Delete Purchase {purchase.purchase_code}?
              </h3>
              <p className="text-[11px] font-bold text-[#DC2626] dark:text-red-400">
                Permanent sales record removal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={deleting}
            className="text-[#737373] hover:text-[#111111] dark:hover:text-white p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all disabled:opacity-50"
            title="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-[#FFF1F2] dark:bg-red-950/30 border border-[#FFD6D8] dark:border-red-900/40 rounded-xl text-xs font-bold text-[#DC2626] dark:text-red-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Record Summary Card */}
          <div className="bg-[#FAFAFA] dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-[#F1F1F1] dark:border-[#262626] pb-2">
              <span className="text-[11px] font-bold text-[#737373]">Purchase Code</span>
              <span className="font-mono font-black text-[#E31B23] text-xs">{purchase.purchase_code}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#737373] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Customer
              </span>
              <span className="font-black text-xs text-[#171717] dark:text-white">{customerName}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#737373] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Purchase Date
              </span>
              <span className="font-bold text-xs text-[#171717] dark:text-white">{purchase.purchase_date}</span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#F1F1F1] dark:border-[#262626]">
              <span className="text-xs font-extrabold text-[#171717] dark:text-white flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-[#E31B23]" /> Total Amount
              </span>
              <span className="text-sm font-black text-[#E31B23]">{formattedAmount}</span>
            </div>

            {purchase.items && purchase.items.length > 0 && (
              <div className="pt-2 border-t border-[#F1F1F1] dark:border-[#262626] space-y-1">
                <span className="text-[10px] font-bold text-[#737373] uppercase tracking-wider flex items-center gap-1">
                  <Package className="w-3 h-3" /> Particulars
                </span>
                {purchase.items.map((it, idx) => (
                  <div key={idx} className="text-[11px] font-semibold text-[#525252] dark:text-[#D4D4D4] flex justify-between">
                    <span>
                      {typeof it.cylinder_type === 'object' ? (it.cylinder_type as any)?.name : String(it.cylinder_type || 'Cylinder')} × {it.quantity}
                    </span>
                    <span className="font-bold">₹{(it.total_price || it.quantity * it.unit_price).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Destructive Warning */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl text-[11px] font-semibold text-amber-800 dark:text-amber-300">
            <strong>Warning:</strong> This action cannot be undone. The purchase invoice and any associated delivery/payment links for this sale will be permanently deleted from the database.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#FAFAFA] dark:bg-[#1C1C1C] border-t border-[#F1F1F1] dark:border-[#262626] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-xs font-bold text-[#525252] dark:text-[#D4D4D4] hover:bg-[#F1F1F1] dark:hover:bg-[#262626] rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center justify-center gap-2 bg-[#DC2626] hover:bg-red-700 text-white text-xs font-black px-4 py-2 rounded-xl shadow-xs transition-all active:scale-98 disabled:opacity-50"
          >
            {deleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting Record...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Purchase</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

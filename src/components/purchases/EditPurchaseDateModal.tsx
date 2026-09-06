import React, { useState, useEffect } from 'react';
import type { Purchase } from '../../types/database.types';
import { updatePurchaseDate } from '../../lib/db';
import { useToast } from '../../context/ToastContext';
import { Calendar, X, AlertTriangle, Loader2 } from 'lucide-react';

interface EditPurchaseDateModalProps {
  isOpen: boolean;
  purchase: Purchase | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditPurchaseDateModal: React.FC<EditPurchaseDateModalProps> = ({
  isOpen,
  purchase,
  onClose,
  onSuccess,
}) => {
  const { showSuccess, showError } = useToast();
  const [purchaseDate, setPurchaseDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (purchase) {
      setPurchaseDate(purchase.purchase_date || new Date().toISOString().split('T')[0]);
      setErrorMessage('');
    }
  }, [purchase]);

  if (!isOpen || !purchase) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseDate) {
      setErrorMessage('Please select a valid purchase date.');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    try {
      await updatePurchaseDate(purchase.id, purchaseDate);
      showSuccess(`Purchase date updated to ${purchaseDate} for ${purchase.purchase_code}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      const msg = err.message || 'Failed to update purchase date';
      setErrorMessage(msg);
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#1F1F1F]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FFF1F2] dark:bg-red-950/40 text-[#E31B23] flex items-center justify-center border border-[#FFD6D8]">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#171717] dark:text-white">Edit Purchase Date</h2>
              <p className="text-[11px] font-mono font-bold text-[#E31B23]">{purchase.purchase_code}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1 text-[#737373] hover:text-[#171717] dark:hover:text-white rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#2A2A2A] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl flex items-start gap-2 text-xs text-red-600 dark:text-red-400 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Details summary */}
          <div className="p-3.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-[#737373] font-bold">Customer:</span>
              <span className="font-black text-[#171717] dark:text-white">
                {purchase.customer?.name || 'Customer'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#737373] font-bold">Total Amount:</span>
              <span className="font-black text-[#171717] dark:text-white">
                ₹{purchase.total_gas_amount.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-[#737373]">System Created At:</span>
              <span className="text-[#737373] font-mono">
                {new Date(purchase.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-[#171717] dark:text-white uppercase tracking-wider mb-1.5">
              Transaction / Business Date <span className="text-[#E31B23]">*</span>
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#141414] border border-[#D4D4D4] dark:border-[#333] rounded-xl text-xs font-bold text-[#171717] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E31B23]/20"
            />
            <p className="text-[11px] text-[#737373] mt-1">
              Changes the business transaction date used for reports and ledger filtering. The system creation timestamp (<code className="text-[10px]">created_at</code>) and record ID remain untouched.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-[#525252] dark:text-[#D4D4D4] hover:bg-[#F5F5F5] dark:hover:bg-[#2A2A2A] rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#E31B23] hover:bg-[#C9151C] text-white text-xs font-black rounded-xl transition-all shadow-xs disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>Save New Date</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

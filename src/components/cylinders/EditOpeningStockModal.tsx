import React, { useState, useEffect } from 'react';
import { getCylinderStockSummary, getInventoryOpeningBalances, updateInventoryOpeningBalances } from '../../lib/db';
import { useToast } from '../../context/ToastContext';
import { X, Save, AlertCircle, Database, Info, Loader2, AlertTriangle } from 'lucide-react';

interface EditOpeningStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface StockRowState {
  cylinderTypeId: string;
  name: string;
  weightKg: number;
  currentOpening: number;
  currentAvailable: number;
  withCustomer: number;
  empty: number;
  inDelivery: number;
  committedOutflow: number; // pending + inDelivery + withCustomer + empty - supplierIntake
  inputQty: string;
}

export const EditOpeningStockModal: React.FC<EditOpeningStockModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showSuccess, showError } = useToast();

  const [rows, setRows] = useState<StockRowState[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [summaries, balances] = await Promise.all([
        getCylinderStockSummary(),
        getInventoryOpeningBalances(),
      ]);

      const mappedRows: StockRowState[] = summaries.map((s) => {
        const balanceRec = balances.find((b) => b.cylinder_type_id === s.cylinder_type_id);
        const opening = balanceRec ? balanceRec.opening_full_quantity : (s.opening_balance ?? 0);
        
        // committedOutflow = Total physically committed in active circulation / unrefilled returns
        // available = opening + supplierIntake - committedOutflow
        // therefore committedOutflow = opening + supplierIntake - available = s.total - s.available
        const committedOutflow = Math.max(0, s.total - s.available);

        return {
          cylinderTypeId: s.cylinder_type_id || '',
          name: s.size,
          weightKg: s.weight_kg ?? 0,
          currentOpening: opening,
          currentAvailable: s.available,
          withCustomer: s.withCustomer,
          empty: s.empty,
          inDelivery: s.inDelivery,
          committedOutflow,
          inputQty: String(opening),
        };
      });

      // Sort consistently by weight
      mappedRows.sort((a, b) => a.weightKg - b.weightKg);
      setRows(mappedRows);
    } catch (err: any) {
      console.error('Failed to load opening balances:', err);
      setErrorMsg(err.message || 'Failed to load current opening stock configuration from Supabase.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleQtyChange = (cylinderTypeId: string, val: string) => {
    setRows((prev) =>
      prev.map((r) => (r.cylinderTypeId === cylinderTypeId ? { ...r, inputQty: val } : r))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || loading) return;
    setErrorMsg('');

    // Strict validation
    const updates: Array<{ cylinder_type_id: string; opening_full_quantity: number }> = [];

    for (const r of rows) {
      const trimmed = r.inputQty.trim();
      if (trimmed === '') {
        setErrorMsg(`Please enter an opening stock quantity for ${r.name}.`);
        return;
      }
      if (!/^\d+$/.test(trimmed)) {
        setErrorMsg(`${r.name} opening stock must be a whole non-negative integer without decimals or special characters.`);
        return;
      }
      const num = Number(trimmed);
      if (isNaN(num) || !isFinite(num) || num < 0) {
        setErrorMsg(`${r.name} opening stock must be a valid non-negative number.`);
        return;
      }
      if (num > 100000) {
        setErrorMsg(`${r.name} opening stock cannot exceed 100,000 units.`);
        return;
      }

      // Invariant validation: Prevent impossible negative available inventory
      // If new opening stock is less than already committed net outflow, reject
      const minRequiredOpening = r.committedOutflow;
      if (num < minRequiredOpening) {
        setErrorMsg(
          `Opening stock cannot be lower than the quantity already committed through recorded transactions (minimum ${minRequiredOpening} required for ${r.name}).`
        );
        return;
      }

      updates.push({
        cylinder_type_id: r.cylinderTypeId,
        opening_full_quantity: num,
      });
    }

    setSaving(true);
    try {
      await updateInventoryOpeningBalances(updates);
      showSuccess('Opening stock updated successfully.');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to update opening stock balances:', err);
      const userMessage = err.message || 'Unable to update opening stock. Please try again.';
      setErrorMsg(userMessage);
      showError('Unable to update opening stock. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto backdrop-enter">
      <div className="bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] w-full max-w-lg overflow-hidden modal-enter my-auto">
        {/* Header */}
        <div className="bg-white dark:bg-[#171717] text-[#171717] dark:text-white px-6 py-4 flex items-center justify-between border-b border-[#F1F1F1] dark:border-[#262626]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FFF1F2] dark:bg-red-950/40 text-[#E31B23] flex items-center justify-center shrink-0 border border-[#FECDD3]">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#171717] dark:text-white">Edit Opening Stock</h2>
              <p className="text-[11px] font-semibold text-[#737373]">Initial full cylinders baseline configuration</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1.5 rounded-lg text-[#737373] hover:text-[#171717] dark:hover:text-white hover:bg-[#F5F5F5] dark:hover:bg-[#262626] transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational & Warning Banners */}
        <div className="px-6 pt-4 space-y-2.5">
          <div className="p-3 bg-[#EEF2FF] dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40 rounded-xl flex items-start gap-2.5 text-xs text-[#3730A3] dark:text-indigo-300">
            <Info className="w-4 h-4 text-[#4F46E5] shrink-0 mt-0.5" />
            <div>
              <span className="font-black block">Opening Stock Definition</span>
              <p className="text-[11px] font-medium leading-relaxed">
                Opening stock represents the full cylinders physically held by the agency before recorded inventory transactions.
              </p>
            </div>
          </div>

          <div className="p-2.5 bg-[#FFFBEB] dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 rounded-xl flex items-start gap-2 text-xs text-[#92400E] dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
            <p className="text-[11px] font-medium leading-relaxed">
              Changing opening stock affects inventory calculations. Recorded transactions will not be modified.
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-[#FFF1F2] border border-[#FECDD3] text-[#DC2626] rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-xs font-bold text-[#737373] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#E31B23]" />
              Loading authoritative opening balances from Supabase...
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <div
                  key={row.cylinderTypeId}
                  className="p-3.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <span className="block text-xs font-black text-[#171717] dark:text-white">
                      {row.name}
                    </span>
                    <span className="text-[11px] font-bold text-[#16A34A] dark:text-emerald-400">
                      Current Available: {row.currentAvailable}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={`input-stock-${row.cylinderTypeId}`}
                      className="text-[11px] font-bold text-[#737373] shrink-0"
                    >
                      Opening Stock:
                    </label>
                    <input
                      id={`input-stock-${row.cylinderTypeId}`}
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={row.inputQty}
                      onChange={(e) => handleQtyChange(row.cylinderTypeId, e.target.value)}
                      disabled={saving}
                      placeholder="0"
                      className="w-28 px-3 py-2 min-h-[44px] bg-white dark:bg-[#171717] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#171717] dark:text-white text-right focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F1F1F1] dark:border-[#262626]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-[#525252] dark:text-[#D4D4D4] hover:bg-[#F5F5F5] dark:hover:bg-[#262626] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="flex items-center justify-center gap-2 bg-[#E31B23] hover:bg-[#C9151C] text-white font-black text-xs px-5 py-2.5 min-h-[44px] rounded-xl shadow-[0_4px_12px_rgba(227,27,35,0.2)] transition-all disabled:opacity-50 active:scale-98"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { getAgencySettings, updateOpeningStock } from '../../lib/db';
import { useToast } from '../../context/ToastContext';
import { X, Save, AlertCircle, Database, Info, Loader2 } from 'lucide-react';

interface EditOpeningStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditOpeningStockModal: React.FC<EditOpeningStockModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showSuccess, showError } = useToast();

  const [stock4kg, setStock4kg] = useState<string>('40');
  const [stock12kg, setStock12kg] = useState<string>('150');
  const [stock17kg, setStock17kg] = useState<string>('60');
  const [stock21kg, setStock21kg] = useState<string>('80');

  // Baseline quantities loaded from database
  const [currentStock, setCurrentStock] = useState({
    kg4: 40,
    kg12: 150,
    kg17: 60,
    kg21: 80,
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadCurrentOpeningStock();
    }
  }, [isOpen]);

  const loadCurrentOpeningStock = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const settings = await getAgencySettings();
      const s4 = settings.opening_stock_4kg ?? 40;
      const s12 = settings.opening_stock_12kg ?? 150;
      const s17 = settings.opening_stock_17kg ?? 60;
      const s21 = settings.opening_stock_21kg ?? 80;

      setCurrentStock({ kg4: s4, kg12: s12, kg17: s17, kg21: s21 });
      setStock4kg(String(s4));
      setStock12kg(String(s12));
      setStock17kg(String(s17));
      setStock21kg(String(s21));
    } catch (err: any) {
      console.error('Failed to load opening stock settings:', err);
      setErrorMsg(err.message || 'Failed to load current opening stock configuration.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || loading) return;
    setErrorMsg('');

    // Strict validation
    const fields = [
      { label: '4 kg Domestic', raw: stock4kg },
      { label: '12 kg Commercial', raw: stock12kg },
      { label: '17 kg Commercial', raw: stock17kg },
      { label: '21 kg Industrial', raw: stock21kg },
    ];

    for (const f of fields) {
      const trimmed = f.raw.trim();
      if (trimmed === '') {
        setErrorMsg(`Please enter a quantity for ${f.label}.`);
        return;
      }
      if (!/^\d+$/.test(trimmed)) {
        setErrorMsg(`${f.label} must be a whole positive integer without decimals or special characters.`);
        return;
      }
      const num = Number(trimmed);
      if (isNaN(num) || !isFinite(num) || num < 0) {
        setErrorMsg(`${f.label} must be a valid non-negative number.`);
        return;
      }
      if (num > 100000) {
        setErrorMsg(`${f.label} cannot exceed 100,000 units.`);
        return;
      }
    }

    const payload = {
      opening_stock_4kg: parseInt(stock4kg.trim(), 10),
      opening_stock_12kg: parseInt(stock12kg.trim(), 10),
      opening_stock_17kg: parseInt(stock17kg.trim(), 10),
      opening_stock_21kg: parseInt(stock21kg.trim(), 10),
    };

    setSaving(true);
    try {
      await updateOpeningStock(payload);
      showSuccess('Opening stock updated successfully.');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to update opening stock:', err);
      const userMessage = err.message || 'Unable to update opening stock. Please try again.';
      setErrorMsg(userMessage);
      showError('Unable to update opening stock. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
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

        {/* Informational Banner */}
        <div className="px-6 pt-4">
          <div className="p-3 bg-[#EEF2FF] dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40 rounded-xl flex items-start gap-2.5 text-xs text-[#3730A3] dark:text-indigo-300">
            <Info className="w-4 h-4 text-[#4F46E5] shrink-0 mt-0.5" />
            <div>
              <span className="font-black block">Opening Stock Baseline</span>
              <p className="text-[11px] font-medium leading-relaxed">
                Initial full cylinders available before recorded transactions. Updating this baseline recalculates warehouse stock without creating fake customer or purchase records.
              </p>
            </div>
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
              Loading current configuration...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 4 kg Domestic */}
              <div className="p-3.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-stock-4kg" className="block text-xs font-black text-[#171717] dark:text-white">
                    4 kg Domestic
                  </label>
                  <span className="text-[10px] font-bold text-[#737373]">Current: {currentStock.kg4}</span>
                </div>
                <input
                  id="input-stock-4kg"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={stock4kg}
                  onChange={(e) => setStock4kg(e.target.value)}
                  disabled={saving}
                  placeholder="0"
                  className="w-full px-3.5 py-2.5 min-h-[44px] bg-white dark:bg-[#171717] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
                />
              </div>

              {/* 12 kg Commercial */}
              <div className="p-3.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-stock-12kg" className="block text-xs font-black text-[#171717] dark:text-white">
                    12 kg Commercial
                  </label>
                  <span className="text-[10px] font-bold text-[#737373]">Current: {currentStock.kg12}</span>
                </div>
                <input
                  id="input-stock-12kg"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={stock12kg}
                  onChange={(e) => setStock12kg(e.target.value)}
                  disabled={saving}
                  placeholder="0"
                  className="w-full px-3.5 py-2.5 min-h-[44px] bg-white dark:bg-[#171717] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
                />
              </div>

              {/* 17 kg Commercial */}
              <div className="p-3.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-stock-17kg" className="block text-xs font-black text-[#171717] dark:text-white">
                    17 kg Commercial
                  </label>
                  <span className="text-[10px] font-bold text-[#737373]">Current: {currentStock.kg17}</span>
                </div>
                <input
                  id="input-stock-17kg"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={stock17kg}
                  onChange={(e) => setStock17kg(e.target.value)}
                  disabled={saving}
                  placeholder="0"
                  className="w-full px-3.5 py-2.5 min-h-[44px] bg-white dark:bg-[#171717] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
                />
              </div>

              {/* 21 kg Industrial */}
              <div className="p-3.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-stock-21kg" className="block text-xs font-black text-[#171717] dark:text-white">
                    21 kg Industrial
                  </label>
                  <span className="text-[10px] font-bold text-[#737373]">Current: {currentStock.kg21}</span>
                </div>
                <input
                  id="input-stock-21kg"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={stock21kg}
                  onChange={(e) => setStock21kg(e.target.value)}
                  disabled={saving}
                  placeholder="0"
                  className="w-full px-3.5 py-2.5 min-h-[44px] bg-white dark:bg-[#171717] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
                />
              </div>
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

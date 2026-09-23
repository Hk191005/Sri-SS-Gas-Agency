import React, { useState, useEffect } from 'react';
import type { Customer, CylinderType } from '../../types/database.types';
import { getCustomers, getCylinderTypes, recordCylinderReturn } from '../../lib/db';
import { useToast } from '../../context/ToastContext';
import { X, RotateCcw, Save, AlertCircle } from 'lucide-react';

interface CylinderReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedCustomerId?: string;
}

export const CylinderReturnModal: React.FC<CylinderReturnModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedCustomerId,
}) => {
  const { showSuccess, showError } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cylinderTypes, setCylinderTypes] = useState<CylinderType[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(preselectedCustomerId || '');
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [condition, setCondition] = useState<'good' | 'damaged' | 'needs_inspection'>('good');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const custRes = await getCustomers({ activeOnly: true, limit: 500 });
      setCustomers(custRes.customers);
      if (preselectedCustomerId) {
        setSelectedCustomerId(preselectedCustomerId);
      } else if (custRes.customers.length > 0) {
        setSelectedCustomerId(custRes.customers[0].id);
      }

      const types = await getCylinderTypes();
      setCylinderTypes(types);
      if (types.length > 0) {
        const default12 = types.find((t) => t.weight_kg === 12) || types[0];
        setSelectedTypeId(default12.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg('');

    if (!selectedCustomerId) {
      setErrorMsg('Please select a customer.');
      return;
    }
    if (!selectedTypeId) {
      setErrorMsg('Please select a cylinder size.');
      return;
    }

    setSubmitting(true);
    try {
      await recordCylinderReturn({
        customer_id: selectedCustomerId,
        cylinder_type_id: selectedTypeId,
        quantity: Math.max(1, Number(quantity)),
        condition,
        notes: notes.trim() || undefined,
      });

      onSuccess();
      onClose();
      showSuccess('Cylinder return recorded successfully!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record cylinder return.');
      showError(err.message || 'Failed to record cylinder return');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto backdrop-enter">
      <div className="bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] w-full max-w-lg overflow-hidden modal-enter">
        {/* Header */}
        <div className="bg-white dark:bg-[#171717] text-[#171717] dark:text-white px-6 py-4 flex items-center justify-between border-b border-[#F1F1F1] dark:border-[#262626]">
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#171717] dark:text-white flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-[#E31B23]" /> Record Cylinder Return
            </h2>
            <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4] mt-0.5">SRI SS GAS AGENCY Inventory</p>
          </div>
          <button onClick={onClose} className="text-[#737373] hover:text-[#171717] dark:hover:text-white p-1.5 rounded-lg hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-[#171717] dark:text-[#F5F5F5]">
          {errorMsg && (
            <div className="p-3 bg-[#FFF1F2] border border-[#FFD6D8] text-[#DC2626] text-xs rounded-xl flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">
              Customer <span className="text-[#DC2626]">*</span>
            </label>
            <select
              required
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#171717] dark:text-white focus:border-[#E31B23] focus:outline-none"
            >
              <option value="">-- Select Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customer_code} — {c.name} {c.company_name ? `(${c.company_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">
                Cylinder Size <span className="text-[#DC2626]">*</span>
              </label>
              <select
                required
                value={selectedTypeId}
                onChange={(e) => setSelectedTypeId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#171717] dark:text-white focus:border-[#E31B23] focus:outline-none"
              >
                {cylinderTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">
                Return Quantity <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#171717] dark:text-white focus:border-[#E31B23] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">Cylinder Condition</label>
            <select
              value={condition}
              onChange={(e: any) => setCondition(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#171717] dark:text-white focus:outline-none"
            >
              <option value="good">Good (Ready for Refill)</option>
              <option value="damaged">Damaged (Requires Repair)</option>
              <option value="needs_inspection">Needs Safety Inspection</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Serial numbers or return notes..."
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-semibold text-[#171717] dark:text-white focus:outline-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F1F1F1] dark:border-[#262626]">
            <button type="button" onClick={onClose} className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-[#525252] dark:text-[#D4D4D4] hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 px-6 py-2.5 min-h-[44px] rounded-xl text-xs font-black text-white bg-[#E31B23] hover:bg-[#C9151C] shadow-[0_6px_18px_rgba(227,27,35,0.16)] transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Recording Return...' : 'Record Return'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

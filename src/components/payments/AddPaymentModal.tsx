import React, { useState, useEffect } from 'react';
import type { Customer } from '../../types/database.types';
import { getCustomers, createPayment, getCustomerFinancials } from '../../lib/db';
import { useToast } from '../../context/ToastContext';
import { X, CreditCard, Save, AlertCircle } from 'lucide-react';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedCustomerId?: string;
  currentOutstanding?: number;
}

export const AddPaymentModal: React.FC<AddPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedCustomerId,
  currentOutstanding,
}) => {
  const { showSuccess, showError } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(preselectedCustomerId || '');
  const [amount, setAmount] = useState<number>(currentOutstanding || 0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'bank_transfer' | 'other'>('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [calculatedDue, setCalculatedDue] = useState<number>(currentOutstanding || 0);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadCustomers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedCustomerId) {
      loadOutstanding(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  const loadCustomers = async () => {
    try {
      const res = await getCustomers({ activeOnly: true, limit: 500 });
      setCustomers(res.customers);
      if (preselectedCustomerId) {
        setSelectedCustomerId(preselectedCustomerId);
      } else if (res.customers.length > 0) {
        setSelectedCustomerId(res.customers[0].id);
      }
    } catch (e) {
      console.error('Failed to load customers for payment modal', e);
    }
  };

  const loadOutstanding = async (cust: string) => {
    try {
      const fin = await getCustomerFinancials(cust);
      setCalculatedDue(fin.outstanding);
      if (!currentOutstanding) {
        setAmount(fin.outstanding);
      }
    } catch (e) {
      console.error('Failed to get customer outstanding', e);
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
    if (!amount || amount <= 0) {
      setErrorMsg('Please enter a valid payment amount greater than zero.');
      return;
    }

    setSubmitting(true);

    try {
      const isFull = amount >= calculatedDue;
      await createPayment({
        customer_id: selectedCustomerId,
        amount: Number(amount),
        payment_method: paymentMethod,
        payment_date: paymentDate,
        status: isFull ? 'paid' : 'partial',
        notes: notes.trim() || undefined,
      });

      onSuccess();
      onClose();
      showSuccess('Customer payment recorded successfully!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record payment.');
      showError(err.message || 'Failed to record payment');
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
              <CreditCard className="w-5 h-5 text-[#16A34A]" /> Record Customer Payment
            </h2>
            <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4] mt-0.5">SRI SS GAS AGENCY Cashier</p>
          </div>
          <button onClick={onClose} className="text-[#737373] hover:text-[#171717] dark:hover:text-white p-1.5 rounded-lg hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-[#171717] dark:text-[#F5F5F5]">
          {errorMsg && (
            <div className="p-3 bg-[#FFF1F2] border border-[#FFD6D8] text-[#DC2626] text-xs rounded-xl flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Customer Selection */}
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

          {/* Current Outstanding Banner */}
          <div className="p-3.5 bg-[#FFFBEB] dark:bg-amber-950/20 rounded-xl border border-amber-200/60 flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-300">Current Outstanding Balance:</span>
            <span className="text-base font-black text-amber-950 dark:text-amber-200">₹{calculatedDue.toLocaleString('en-IN')}</span>
          </div>

          {/* Payment Amount & Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">
                Payment Amount (₹) <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#171717] dark:text-white focus:border-[#E31B23] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">
                Payment Method <span className="text-[#DC2626]">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e: any) => setPaymentMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#171717] dark:text-white focus:outline-none"
              >
                <option value="cash">Cash Payment</option>
                <option value="upi">UPI (GPay/PhonePe/Paytm)</option>
                <option value="bank_transfer">Bank Transfer / NEFT</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Date & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">Payment Date</label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#171717] dark:text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">Receipt / Reference Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Transaction reference ID..."
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-semibold text-[#171717] dark:text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F1F1F1] dark:border-[#262626]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-[#525252] dark:text-[#D4D4D4] hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 px-6 py-2.5 min-h-[44px] rounded-xl text-xs font-black text-white bg-[#16A34A] hover:bg-[#15803D] shadow-xs transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Recording Payment...' : 'Save Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

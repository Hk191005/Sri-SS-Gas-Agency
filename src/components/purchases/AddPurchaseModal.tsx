import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Customer, CylinderType } from '../../types/database.types';
import { getCustomers, getCylinderTypes, createPurchase } from '../../lib/db';
import { useToast } from '../../context/ToastContext';
import { X, ShoppingBag, Plus, Trash2, Save, AlertCircle, Calculator, FileText } from 'lucide-react';

interface AddPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedCustomerId?: string;
}

export const AddPurchaseModal: React.FC<AddPurchaseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedCustomerId,
}) => {
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cylinderTypes, setCylinderTypes] = useState<CylinderType[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(preselectedCustomerId || '');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);

  // Line items
  const [items, setItems] = useState<{ cylinder_type_id: string; quantity: number; unit_price: number }[]>([
    { cylinder_type_id: '', quantity: 1, unit_price: 0 },
  ]);

  // Empty cylinder return (Refill exchange - ₹0)
  const [emptyReturnedQty, setEmptyReturnedQty] = useState<number>(0);
  const [emptyReturnedTypeId, setEmptyReturnedTypeId] = useState<string>('');

  // Financial options
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositMethod, setDepositMethod] = useState<'cash' | 'upi' | 'bank_transfer' | 'other'>('cash');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'bank_transfer' | 'other'>('cash');
  const [deliveryStatus, setDeliveryStatus] = useState<'pending' | 'delivered'>('pending');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadDependencies = async () => {
    try {
      const [custRes, types] = await Promise.all([
        getCustomers({ activeOnly: true, limit: 500 }),
        getCylinderTypes(),
      ]);
      setCustomers(custRes.customers);
      setCylinderTypes(types);

      if (types.length > 0) {
        const default12kg = types.find((t) => t.weight_kg === 12) || types[0];
        setItems([
          {
            cylinder_type_id: default12kg.id,
            quantity: 1,
            unit_price: default12kg.default_price,
          },
        ]);
        setEmptyReturnedTypeId(default12kg.id);
      }

      if (preselectedCustomerId) {
        setSelectedCustomerId(preselectedCustomerId);
      } else if (custRes.customers.length > 0) {
        setSelectedCustomerId(custRes.customers[0].id);
      }
    } catch (e) {
      console.error('Failed to load purchase modal data', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDependencies();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    if (cylinderTypes.length === 0) return;
    const defaultType = cylinderTypes[0];
    setItems([...items, { cylinder_type_id: defaultType.id, quantity: 1, unit_price: defaultType.default_price }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemTypeChange = (index: number, typeId: string) => {
    const targetType = cylinderTypes.find((t) => t.id === typeId);
    const updated = [...items];
    updated[index].cylinder_type_id = typeId;
    if (targetType) {
      updated[index].unit_price = targetType.default_price;
    }
    setItems(updated);
  };

  const handleItemQuantityChange = (index: number, qty: number) => {
    const updated = [...items];
    updated[index].quantity = Math.max(1, qty);
    setItems(updated);
  };

  const handleItemPriceChange = (index: number, price: number) => {
    const updated = [...items];
    updated[index].unit_price = Math.max(0, price);
    setItems(updated);
  };

  const totalGasAmount = items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);

  const handleSubmit = async (e: React.FormEvent, andViewBill: boolean = false) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg('');

    if (!selectedCustomerId) {
      setErrorMsg('Please select a customer.');
      return;
    }
    if (items.some((i) => !i.cylinder_type_id)) {
      setErrorMsg('Please select cylinder type for all items.');
      return;
    }

    setSubmitting(true);

    try {
      const selectedEmptyType = cylinderTypes.find((t) => t.id === emptyReturnedTypeId);
      const created = await createPurchase({
        customer_id: selectedCustomerId,
        purchase_date: purchaseDate,
        items,
        deposit_amount: Number(depositAmount) || 0,
        deposit_payment_method: depositMethod,
        payment_amount: Number(paymentAmount) || 0,
        payment_method: paymentMethod,
        delivery_status: deliveryStatus,
        notes: notes.trim() || undefined,
        empty_return_quantity: Number(emptyReturnedQty) || 0,
        empty_return_type_id: emptyReturnedTypeId || undefined,
        empty_return_type_name: selectedEmptyType?.name,
      });

      onSuccess();
      onClose();
      showSuccess('Customer gas sale transaction recorded successfully!');
      if (andViewBill && created?.id) {
        navigate(`/billing?saleId=${created.id}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to record purchase. Please try again.');
      showError(err.message || 'Failed to record purchase transaction');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto backdrop-enter">
      <div className="bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden modal-enter">
        {/* Modal Header */}
        <div className="bg-white dark:bg-[#171717] text-[#171717] dark:text-white px-6 py-4 flex items-center justify-between border-b border-[#F1F1F1] dark:border-[#262626]">
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#171717] dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#E31B23]" /> New Gas Sale Transaction
            </h2>
            <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4] mt-0.5">SRI SS GAS AGENCY Billing</p>
          </div>
          <button onClick={onClose} className="text-[#737373] hover:text-[#171717] dark:hover:text-white p-1.5 rounded-lg hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 text-[#171717] dark:text-[#F5F5F5]">
          {errorMsg && (
            <div className="p-3 bg-[#FFF1F2] border border-[#FFD6D8] text-[#DC2626] text-xs rounded-xl flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Customer & Date Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div>
              <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">
                Purchase Date <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#171717] dark:text-white focus:border-[#E31B23] focus:outline-none"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-[#525252] uppercase tracking-wider">
                Cylinder Purchase Items
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs font-bold text-[#E31B23] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Cylinder Item
              </button>
            </div>

            {items.map((item, idx) => (
              <div key={idx} className="p-3.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl grid grid-cols-12 gap-3 items-center">
                <div className="col-span-5 sm:col-span-5">
                  <label className="block text-[10px] font-extrabold text-[#737373] mb-1">Cylinder Size</label>
                  <select
                    value={item.cylinder_type_id}
                    onChange={(e) => handleItemTypeChange(idx, e.target.value)}
                    className="w-full px-2.5 py-2 bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg text-xs font-bold text-[#171717] dark:text-white"
                  >
                    {cylinderTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (Default: ₹{t.default_price})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-3 sm:col-span-2">
                  <label className="block text-[10px] font-extrabold text-[#737373] mb-1">Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemQuantityChange(idx, parseInt(e.target.value) || 1)}
                    className="w-full px-2.5 py-2 bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg text-xs font-black text-center text-[#171717] dark:text-white"
                  />
                </div>

                <div className="col-span-3 sm:col-span-3">
                  <label className="block text-[10px] font-extrabold text-[#737373] mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={item.unit_price}
                    onChange={(e) => handleItemPriceChange(idx, parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-2 bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg text-xs font-black text-[#171717] dark:text-white"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2 text-right flex items-center justify-end pt-4">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 text-[#737373] hover:text-[#DC2626] rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Total Auto Calculation Display */}
            <div className="bg-[#FFF1F2] dark:bg-red-950/30 p-4 rounded-xl border border-[#FFD6D8] dark:border-red-900/40 flex items-center justify-between">
              <span className="text-xs font-bold text-[#C9151C] dark:text-red-400 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-[#E31B23]" /> Total Gas Sales Amount:
              </span>
              <span className="text-xl font-black text-[#E31B23]">₹{totalGasAmount.toLocaleString('en-IN')}</span>
            </div>

            {/* Empty Cylinder Return Section (Refill Exchange - ₹0 to Total) */}
            <div className="p-3.5 bg-slate-50 dark:bg-[#1E1E1E] rounded-xl border border-[#E5E5E5] dark:border-[#333] space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-[#171717] dark:text-white uppercase">
                  Empty Cylinder Return (Refill Exchange)
                </label>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200/50">
                  Operational Record · ₹0 to Bill Total
                </span>
              </div>
              <p className="text-[11px] text-[#737373] font-medium">
                Returned empty cylinders are logged for inventory tracking and appear on the customer bill as informational only.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#737373] mb-1">Returned Cylinder Type</label>
                  <select
                    value={emptyReturnedTypeId}
                    onChange={(e) => setEmptyReturnedTypeId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#333] rounded-lg text-xs font-bold text-[#171717] dark:text-white"
                  >
                    <option value="">-- No Empty Return --</option>
                    {cylinderTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.weight_kg} kg)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#737373] mb-1">Returned Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={emptyReturnedQty || ''}
                    onChange={(e) => setEmptyReturnedQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="0"
                    className="w-full px-2.5 py-2 bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#333] rounded-lg text-xs font-bold text-[#171717] dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Separate Deposit & Payment Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#F1F1F1] dark:border-[#262626]">
            {/* Deposit Box */}
            <div className="p-3.5 bg-[#FFFBEB] dark:bg-amber-950/20 rounded-xl border border-amber-200/60 space-y-2">
              <label className="block text-xs font-black text-amber-900 dark:text-amber-300 uppercase">Cylinder Security Deposit (Optional)</label>
              <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">Tracked separately from gas sales revenue</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Amount ₹"
                  value={depositAmount || ''}
                  onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                  className="w-1/2 px-2.5 py-2 bg-white dark:bg-[#171717] border border-amber-300 dark:border-amber-700/50 rounded-lg text-xs font-bold text-amber-900 dark:text-amber-200"
                />
                <select
                  value={depositMethod}
                  onChange={(e: any) => setDepositMethod(e.target.value)}
                  className="w-1/2 px-2 py-2 bg-white dark:bg-[#171717] border border-amber-300 dark:border-amber-700/50 rounded-lg text-xs font-semibold text-amber-900 dark:text-amber-200"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Payment Box */}
            <div className="p-3.5 bg-[#F0FDF4] dark:bg-emerald-950/20 rounded-xl border border-emerald-200/60 space-y-2">
              <label className="block text-xs font-black text-emerald-900 dark:text-emerald-300 uppercase">Immediate Payment Received (Optional)</label>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">Auto reduces customer outstanding amount</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Amount ₹"
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-1/2 px-2.5 py-2 bg-white dark:bg-[#171717] border border-emerald-300 dark:border-emerald-700/50 rounded-lg text-xs font-bold text-emerald-900 dark:text-emerald-200"
                />
                <select
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                  className="w-1/2 px-2 py-2 bg-white dark:bg-[#171717] border border-emerald-300 dark:border-emerald-700/50 rounded-lg text-xs font-semibold text-emerald-900 dark:text-emerald-200"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Delivery & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">Initial Delivery Status</label>
              <select
                value={deliveryStatus}
                onChange={(e: any) => setDeliveryStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#171717] dark:text-white focus:outline-none"
              >
                <option value="pending">Schedule for Pending Delivery</option>
                <option value="delivered">Already Handed Over / Delivered</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">Transaction Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes or invoice serial number..."
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-semibold text-[#171717] dark:text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-[#F1F1F1] dark:border-[#262626]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-[#525252] dark:text-[#D4D4D4] hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-white dark:bg-[#222] border border-[#E5E5E5] dark:border-[#333] hover:border-[#E31B23] text-[#E31B23] font-bold text-xs rounded-xl shadow-2xs transition-all active:scale-98 disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              <span>Save & View Bill</span>
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 px-6 py-2.5 min-h-[44px] rounded-xl text-xs font-black text-white bg-[#E31B23] hover:bg-[#C9151C] shadow-[0_6px_18px_rgba(227,27,35,0.16)] transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Recording Sale...' : 'Save Gas Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import type { Customer, CustomerMergeStats, CustomerMergeResult } from '../../types/database.types';
import { getCustomers, getCustomerStatsForMerge, mergeCustomers } from '../../lib/db';
import { useToast } from '../../context/ToastContext';
import {
  GitMerge,
  AlertTriangle,
  X,
  Loader2,
  Phone,
  MapPin,
  ShieldAlert,
} from 'lucide-react';

interface MergeCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: CustomerMergeResult) => void;
  initialDuplicateCustomer?: Customer | null;
  initialPrimaryCustomer?: Customer | null;
}

export const MergeCustomerModal: React.FC<MergeCustomerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialDuplicateCustomer,
  initialPrimaryCustomer,
}) => {
  const { showSuccess, showError } = useToast();

  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [duplicateCustomerId, setDuplicateCustomerId] = useState<string>('');
  const [primaryCustomerId, setPrimaryCustomerId] = useState<string>('');

  const [duplicateStats, setDuplicateStats] = useState<CustomerMergeStats | null>(null);
  const [primaryStats, setPrimaryStats] = useState<CustomerMergeStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [confirmedRisk, setConfirmedRisk] = useState(false);
  const [merging, setMerging] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load customer directory catalog for dropdowns
  useEffect(() => {
    if (!isOpen) return;

    const fetchAll = async () => {
      setLoadingList(true);
      try {
        const res = await getCustomers({ limit: 1000, activeOnly: false });
        setAllCustomers(res.customers);
      } catch (err: any) {
        console.error('Failed to load customers for merge dropdown:', err);
      } finally {
        setLoadingList(false);
      }
    };

    fetchAll();
  }, [isOpen]);

  // Set initial selections when opened
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setConfirmedRisk(false);
      if (initialDuplicateCustomer) {
        setDuplicateCustomerId(initialDuplicateCustomer.id);
      } else {
        setDuplicateCustomerId('');
      }

      if (initialPrimaryCustomer) {
        setPrimaryCustomerId(initialPrimaryCustomer.id);
      } else {
        setPrimaryCustomerId('');
      }
    }
  }, [isOpen, initialDuplicateCustomer, initialPrimaryCustomer]);

  // Fetch comparative statistics whenever selections change
  useEffect(() => {
    if (!isOpen) return;

    const fetchStats = async () => {
      setErrorMsg('');
      if (duplicateCustomerId && primaryCustomerId && duplicateCustomerId === primaryCustomerId) {
        setErrorMsg('Duplicate customer and Primary customer cannot be the same account.');
        setDuplicateStats(null);
        setPrimaryStats(null);
        return;
      }

      if (!duplicateCustomerId && !primaryCustomerId) {
        setDuplicateStats(null);
        setPrimaryStats(null);
        return;
      }

      setLoadingStats(true);
      try {
        if (duplicateCustomerId) {
          const dStats = await getCustomerStatsForMerge(duplicateCustomerId);
          setDuplicateStats(dStats);
        } else {
          setDuplicateStats(null);
        }

        if (primaryCustomerId) {
          const pStats = await getCustomerStatsForMerge(primaryCustomerId);
          setPrimaryStats(pStats);
        } else {
          setPrimaryStats(null);
        }
      } catch (err: any) {
        console.error('Failed to fetch merge comparison stats:', err);
        setErrorMsg(err.message || 'Failed to fetch customer profile details');
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [isOpen, duplicateCustomerId, primaryCustomerId]);

  if (!isOpen) return null;

  const handleMergeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!duplicateCustomerId || !primaryCustomerId) {
      setErrorMsg('Please select both a Duplicate Customer and a Primary Customer.');
      return;
    }

    if (duplicateCustomerId === primaryCustomerId) {
      setErrorMsg('Cannot merge a customer into itself. Please select two distinct accounts.');
      return;
    }

    if (!confirmedRisk) {
      setErrorMsg('Please check the confirmation box to confirm this merge.');
      return;
    }

    setMerging(true);
    setErrorMsg('');

    try {
      const result = await mergeCustomers(primaryCustomerId, duplicateCustomerId);
      showSuccess(
        `Customer ${result.duplicate_code} successfully merged into ${result.primary_code}! All transactions and documents preserved.`
      );
      onSuccess(result);
      onClose();
    } catch (err: any) {
      console.error('Customer merge failed:', err);
      setErrorMsg(err.message || 'Failed to complete customer merge. Transaction rolled back safely.');
      showError(err.message || 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#F1F5F9] dark:border-[#262626] flex items-center justify-between bg-[#FFF1F2] dark:bg-red-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFE4E6] dark:bg-red-900/40 text-[#E31B23] flex items-center justify-center shrink-0 border border-[#FECDD3] dark:border-red-800/40">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#111111] dark:text-white">
                Merge Duplicate Customer Account
              </h3>
              <p className="text-[11px] font-bold text-[#525252] dark:text-[#A3A3A3]">
                Safely transfer all purchases, payments, deposits, deliveries, and documents into the primary account
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={merging}
            className="text-[#737373] hover:text-[#111111] dark:hover:text-white p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all disabled:opacity-50"
            title="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {errorMsg && (
            <div className="p-3.5 bg-[#FFF1F2] dark:bg-red-950/30 border border-[#FFD6D8] dark:border-red-900/40 rounded-xl font-bold text-[#DC2626] dark:text-red-400 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Customer Selection Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. DUPLICATE CUSTOMER SELECTOR */}
            <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> 1. Duplicate Account (To Be Merged & Removed)
                </span>
              </div>
              <select
                value={duplicateCustomerId}
                onChange={(e) => setDuplicateCustomerId(e.target.value)}
                disabled={loadingList || merging}
                className="w-full px-3 py-2 bg-white dark:bg-[#1F1F1F] border border-amber-300 dark:border-amber-800/60 rounded-xl text-xs font-bold text-[#171717] dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
              >
                <option value="">-- Select Duplicate Customer --</option>
                {allCustomers.map((c) => (
                  <option key={c.id} value={c.id} disabled={c.id === primaryCustomerId}>
                    {c.customer_code} — {c.name} {c.company_name ? `(${c.company_name})` : ''} • {c.phone}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                All records attached to this account will be transferred to the Primary customer.
              </p>
            </div>

            {/* 2. PRIMARY CUSTOMER SELECTOR */}
            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 2. Primary Account (Master Kept Account)
                </span>
              </div>
              <select
                value={primaryCustomerId}
                onChange={(e) => setPrimaryCustomerId(e.target.value)}
                disabled={loadingList || merging}
                className="w-full px-3 py-2 bg-white dark:bg-[#1F1F1F] border border-emerald-300 dark:border-emerald-800/60 rounded-xl text-xs font-bold text-[#171717] dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
              >
                <option value="">-- Select Primary Master Customer --</option>
                {allCustomers.map((c) => (
                  <option key={c.id} value={c.id} disabled={c.id === duplicateCustomerId}>
                    {c.customer_code} — {c.name} {c.company_name ? `(${c.company_name})` : ''} • {c.phone}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                This account identity, code, and profile will be retained as the single authoritative record.
              </p>
            </div>
          </div>

          {/* Comparison Cards Section */}
          {loadingStats ? (
            <div className="p-8 text-center bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] space-y-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#E31B23] mx-auto" />
              <p className="font-bold text-[#737373]">Loading side-by-side comparison data...</p>
            </div>
          ) : duplicateStats && primaryStats ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-black text-[#171717] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  Side-By-Side Account Comparison
                </h4>
                <span className="text-[10px] font-bold text-[#737373] bg-[#F1F1F1] dark:bg-[#262626] px-2 py-0.5 rounded">
                  Atomic Rollback Protected
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Duplicate Card */}
                <div className="p-4 bg-[#FAFAFA] dark:bg-[#1C1C1C] rounded-xl border-2 border-amber-300/80 dark:border-amber-800/60 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-black text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/40">
                        {duplicateStats.customer.customer_code} (DUPLICATE)
                      </span>
                      <h4 className="text-sm font-black text-[#171717] dark:text-white mt-1">
                        {duplicateStats.customer.name}
                      </h4>
                      {duplicateStats.customer.company_name && (
                        <p className="text-[11px] font-bold text-[#525252] dark:text-[#D4D4D4]">
                          {duplicateStats.customer.company_name}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      To Be Merged
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px] font-semibold text-[#525252] dark:text-[#D4D4D4] pt-2 border-t border-[#E5E5E5] dark:border-[#2A2A2A]">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[#737373] shrink-0" />
                      <span>{duplicateStats.customer.phone}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#737373] shrink-0 mt-0.5" />
                      <span className="line-clamp-2">
                        {[
                          duplicateStats.customer.street,
                          duplicateStats.customer.landmark,
                          duplicateStats.customer.area1,
                          duplicateStats.customer.city || 'Tiruppur',
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </div>
                  </div>

                  {/* Metrics Ledger Breakdown */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E5E5E5] dark:border-[#2A2A2A] text-center">
                    <div className="p-2 bg-white dark:bg-[#171717] rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A]">
                      <span className="text-[10px] font-bold text-[#737373] block uppercase">Purchases</span>
                      <span className="font-black text-xs text-[#E31B23]">{duplicateStats.purchasesCount}</span>
                    </div>
                    <div className="p-2 bg-white dark:bg-[#171717] rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A]">
                      <span className="text-[10px] font-bold text-[#737373] block uppercase">Payments</span>
                      <span className="font-black text-xs text-[#16A34A]">{duplicateStats.paymentsCount}</span>
                    </div>
                    <div className="p-2 bg-white dark:bg-[#171717] rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A]">
                      <span className="text-[10px] font-bold text-[#737373] block uppercase">Documents</span>
                      <span className="font-black text-xs text-[#171717] dark:text-white">{duplicateStats.documentsCount}</span>
                    </div>
                    <div className="p-2 bg-white dark:bg-[#171717] rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A]">
                      <span className="text-[10px] font-bold text-[#737373] block uppercase">Deposits</span>
                      <span className="font-black text-xs text-[#D97706]">{duplicateStats.depositsCount}</span>
                    </div>
                    <div className="p-2 bg-white dark:bg-[#171717] rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A]">
                      <span className="text-[10px] font-bold text-[#737373] block uppercase">Deliveries</span>
                      <span className="font-black text-xs text-[#171717] dark:text-white">{duplicateStats.deliveriesCount}</span>
                    </div>
                    <div className="p-2 bg-white dark:bg-[#171717] rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A]">
                      <span className="text-[10px] font-bold text-[#737373] block uppercase">Cylinders</span>
                      <span className="font-black text-xs text-[#171717] dark:text-white">{duplicateStats.cylindersCount}</span>
                    </div>
                  </div>
                </div>

                {/* Primary Card */}
                <div className="p-4 bg-[#FAFAFA] dark:bg-[#1C1C1C] rounded-xl border-2 border-emerald-400/80 dark:border-emerald-800/60 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
                        {primaryStats.customer.customer_code} (PRIMARY MASTER)
                      </span>
                      <h4 className="text-sm font-black text-[#171717] dark:text-white mt-1">
                        {primaryStats.customer.name}
                      </h4>
                      {primaryStats.customer.company_name && (
                        <p className="text-[11px] font-bold text-[#525252] dark:text-[#D4D4D4]">
                          {primaryStats.customer.company_name}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Master Profile
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px] font-semibold text-[#525252] dark:text-[#D4D4D4] pt-2 border-t border-[#E5E5E5] dark:border-[#2A2A2A]">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[#737373] shrink-0" />
                      <span>{primaryStats.customer.phone}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#737373] shrink-0 mt-0.5" />
                      <span className="line-clamp-2">
                        {[
                          primaryStats.customer.street,
                          primaryStats.customer.landmark,
                          primaryStats.customer.area1,
                          primaryStats.customer.city || 'Tiruppur',
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </div>
                  </div>

                  {/* Metrics Ledger Breakdown */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E5E5E5] dark:border-[#2A2A2A] text-center">
                    <div className="p-2 bg-white dark:bg-[#171717] rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A]">
                      <span className="text-[10px] font-bold text-[#737373] block uppercase">Purchases</span>
                      <span className="font-black text-xs text-[#E31B23]">
                        {primaryStats.purchasesCount} <span className="text-[10px] text-emerald-600 font-bold">(+{duplicateStats.purchasesCount})</span>
                      </span>
                    </div>
                    <div className="p-2 bg-white dark:bg-[#171717] rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A]">
                      <span className="text-[10px] font-bold text-[#737373] block uppercase">Payments</span>
                      <span className="font-black text-xs text-[#16A34A]">
                        {primaryStats.paymentsCount} <span className="text-[10px] text-emerald-600 font-bold">(+{duplicateStats.paymentsCount})</span>
                      </span>
                    </div>
                    <div className="p-2 bg-white dark:bg-[#171717] rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A]">
                      <span className="text-[10px] font-bold text-[#737373] block uppercase">Documents</span>
                      <span className="font-black text-xs text-[#171717] dark:text-white">
                        {primaryStats.documentsCount} <span className="text-[10px] text-emerald-600 font-bold">(+{duplicateStats.documentsCount})</span>
                      </span>
                    </div>
                    <div className="p-2 bg-white dark:bg-[#171717] rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A]">
                      <span className="text-[10px] font-bold text-[#737373] block uppercase">Deposits</span>
                      <span className="font-black text-xs text-[#D97706]">
                        {primaryStats.depositsCount} <span className="text-[10px] text-emerald-600 font-bold">(+{duplicateStats.depositsCount})</span>
                      </span>
                    </div>
                    <div className="p-2 bg-white dark:bg-[#171717] rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A]">
                      <span className="text-[10px] font-bold text-[#737373] block uppercase">Deliveries</span>
                      <span className="font-black text-xs text-[#171717] dark:text-white">
                        {primaryStats.deliveriesCount} <span className="text-[10px] text-emerald-600 font-bold">(+{duplicateStats.deliveriesCount})</span>
                      </span>
                    </div>
                    <div className="p-2 bg-white dark:bg-[#171717] rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A]">
                      <span className="text-[10px] font-bold text-[#737373] block uppercase">Cylinders</span>
                      <span className="font-black text-xs text-[#171717] dark:text-white">
                        {primaryStats.cylindersCount} <span className="text-[10px] text-emerald-600 font-bold">(+{duplicateStats.cylindersCount})</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Banner Confirmation */}
              <div className="p-4 bg-[#FFF1F2] dark:bg-red-950/20 border border-[#FFD6D8] dark:border-red-900/40 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-[#E31B23] shrink-0" />
                  <span className="font-black text-sm text-[#111111] dark:text-white">
                    Merge {duplicateStats.customer.customer_code} ({duplicateStats.customer.name}) into {primaryStats.customer.customer_code} ({primaryStats.customer.name})
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-[#525252] dark:text-[#D4D4D4] leading-relaxed">
                  All {duplicateStats.purchasesCount} purchases, {duplicateStats.paymentsCount} payments, {duplicateStats.depositsCount} deposits, {duplicateStats.deliveriesCount} deliveries, {duplicateStats.documentsCount} documents, notes, and cylinders will be safely re-linked to <strong>{primaryStats.customer.name} ({primaryStats.customer.customer_code})</strong>. An official audit log entry (<code className="font-mono text-[10px] bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded">CUSTOMER_MERGED</code>) will be recorded.
                </p>

                <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmedRisk}
                    onChange={(e) => setConfirmedRisk(e.target.checked)}
                    className="mt-0.5 rounded text-[#E31B23] focus:ring-[#E31B23]"
                  />
                  <span className="text-[11px] font-black text-[#171717] dark:text-white">
                    I confirm that {duplicateStats.customer.name} is a duplicate and should be permanently merged into {primaryStats.customer.name}.
                  </span>
                </label>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] text-xs font-semibold text-[#737373]">
              Please select both a Duplicate Customer and a Primary Customer above to compare profiles.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#FAFAFA] dark:bg-[#1C1C1C] border-t border-[#F1F1F1] dark:border-[#262626] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={merging}
            className="px-4 py-2 text-xs font-bold text-[#525252] dark:text-[#D4D4D4] hover:bg-[#F1F1F1] dark:hover:bg-[#262626] rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleMergeSubmit}
            disabled={!duplicateStats || !primaryStats || !confirmedRisk || merging}
            className="flex items-center justify-center gap-2 bg-[#E31B23] hover:bg-[#C9151C] text-white text-xs font-black px-6 py-2.5 rounded-xl shadow-[0_6px_18px_rgba(227,27,35,0.16)] transition-all active:scale-98 disabled:opacity-50"
          >
            {merging ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Executing Atomic Merge...</span>
              </>
            ) : (
              <>
                <GitMerge className="w-4 h-4" />
                <span>Confirm & Merge Customers</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

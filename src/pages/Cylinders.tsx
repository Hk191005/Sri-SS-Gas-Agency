import React, { useState, useEffect } from 'react';
import type { CylinderStockSummary } from '../types/database.types';
import { getCylinderStockSummary } from '../lib/db';
import { CylinderReturnModal } from '../components/cylinders/CylinderReturnModal';
import { EditOpeningStockModal } from '../components/cylinders/EditOpeningStockModal';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Database, RotateCcw, PackageCheck, Truck, RefreshCw, ShieldCheck, AlertTriangle, SlidersHorizontal } from 'lucide-react';

export const Cylinders: React.FC = () => {
  const [stockSummaries, setStockSummaries] = useState<CylinderStockSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isOpeningStockModalOpen, setIsOpeningStockModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const summary = await getCylinderStockSummary();
      setStockSummaries(summary);
    } catch (e: any) {
      console.error(e);
      setLoadError(e.message || 'Failed to load cylinder inventory stock');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full min-w-0">
      {/* Header */}
      <PageHeader
        title="Inventory Stock & Cylinder Holdings"
        subtitle="Real-time stock management across 4 kg, 12 kg, 17 kg and 21 kg cylinders"
        icon={<Database className="w-5 h-5 text-[#E31B23]" />}
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setIsOpeningStockModalOpen(true)}
              icon={<SlidersHorizontal className="w-4 h-4 text-[#E31B23]" />}
            >
              Edit Opening Stock
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsReturnModalOpen(true)}
              icon={<RotateCcw className="w-4 h-4" />}
            >
              Record Cylinder Return
            </Button>
          </>
        }
      />

      {/* Stock Cards Grid per Size */}
      {loading ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-12 text-center rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] text-xs font-semibold text-[#737373]">
          Calculating live cylinder inventory stock...
        </div>
      ) : loadError ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-8 text-center rounded-2xl border border-red-200 dark:border-red-900/50">
          <EmptyState
            title="Failed to load cylinder inventory"
            description={loadError}
            icon={<AlertTriangle className="w-6 h-6 text-red-500" />}
            action={
              <Button variant="primary" size="sm" onClick={loadData}>
                Retry Loading
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stockSummaries.map((stock, idx) => (
            <div
              key={stock.size}
              className={`saas-card bg-white dark:bg-[#171717] p-5 rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs space-y-4 animate-card-enter stagger-${(idx % 4) + 1} hover:-translate-y-0.5 transition-all duration-200`}
            >
              <div className="flex items-center justify-between border-b border-[#F1F1F1] dark:border-[#262626] pb-3">
                <span className="text-base font-black text-[#171717] dark:text-white">{stock.size} Cylinders</span>
                <span className="text-xs font-extrabold text-[#171717] dark:text-white bg-[#FAFAFA] dark:bg-[#1F1F1F] px-2.5 py-1 rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A]">
                  Total: {stock.total}
                </span>
              </div>

              <div className="space-y-2 text-xs font-bold">
                <div
                  className={`flex items-center justify-between p-2.5 rounded-xl border ${
                    stock.available === 0
                      ? 'bg-[#FFF1F2] dark:bg-red-950/30 text-[#DC2626] dark:text-red-400 border-[#FFD6D8] dark:border-red-900/40'
                      : stock.available <= 5
                      ? 'bg-[#FFFBEB] dark:bg-amber-950/30 text-[#D97706] dark:text-amber-400 border-amber-200/60 dark:border-amber-900/40'
                      : 'bg-[#F0FDF4] dark:bg-emerald-950/30 text-[#16A34A] dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/40'
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-bold">
                    <PackageCheck className="w-4 h-4 shrink-0" /> Full Available
                  </span>
                  <span className="text-sm font-black">
                    {stock.available}
                    {stock.available === 0 ? (
                      <span className="text-[10px] font-bold ml-1 opacity-80">(Out of Stock)</span>
                    ) : stock.available <= 5 ? (
                      <span className="text-[10px] font-bold ml-1 opacity-80">(Low)</span>
                    ) : null}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#525252] dark:text-[#D4D4D4] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A]">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Database className="w-4 h-4 text-[#525252]" /> With Customers
                  </span>
                  <span className="text-sm font-black">{stock.withCustomer}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-[#FFFBEB] dark:bg-amber-950/30 text-[#D97706] dark:text-amber-400 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
                  <span className="flex items-center gap-1.5 font-bold">
                    <RefreshCw className="w-4 h-4 text-[#D97706]" /> Empty Stock
                  </span>
                  <span className="text-sm font-black">{stock.empty}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-[#FFF1F2] dark:bg-red-950/30 text-[#C9151C] dark:text-red-400 rounded-xl border border-[#FFD6D8] dark:border-red-900/40">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Truck className="w-4 h-4 text-[#E31B23]" /> In Delivery
                  </span>
                  <span className="text-sm font-black">{stock.inDelivery}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Safety & Compliance Card */}
      <div className="saas-card bg-white dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] p-6 rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] flex items-start gap-4 shadow-xs">
        <ShieldCheck className="w-8 h-8 text-[#16A34A] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h3 className="text-sm font-black text-[#171717] dark:text-white">Sri SS Gas Agency — Safety & Inventory Quality Standards</h3>
          <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4] leading-relaxed">
            All 4kg, 12kg, 17kg, and 21kg cylinders in stock undergo strict pressure testing and weight calibration before field dispatch across Tiruppur District.
          </p>
        </div>
      </div>

      {/* Cylinder Return Modal */}
      <CylinderReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        onSuccess={loadData}
      />

      {/* Edit Opening Stock Modal */}
      <EditOpeningStockModal
        isOpen={isOpeningStockModalOpen}
        onClose={() => setIsOpeningStockModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
};

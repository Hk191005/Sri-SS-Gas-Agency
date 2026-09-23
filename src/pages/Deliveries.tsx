import React, { useState, useEffect } from 'react';
import type { Delivery, DeliveryStatus } from '../types/database.types';
import { getDeliveries, updateDeliveryStatus } from '../lib/db';
import { AddPaymentModal } from '../components/payments/AddPaymentModal';
import { useToast } from '../context/ToastContext';
import {
  Truck,
  PhoneCall,
  Navigation,
  CheckCircle2,
  Clock,
  MapPin,
  AlertTriangle,
} from 'lucide-react';

export const Deliveries: React.FC = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'all'>('today');

  const { showSuccess, showError } = useToast();

  // Modal for payment on delivery
  const [paymentDelivery, setPaymentDelivery] = useState<Delivery | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (dateFilter === 'today') params.date = todayStr;
      const list = await getDeliveries(params);
      setDeliveries(list);
    } catch (e: any) {
      console.error(e);
      setLoadError(e.message || 'Failed to load deliveries from database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, dateFilter]);

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleUpdateStatus = async (delId: string, status: DeliveryStatus) => {
    if (updatingId === delId) return;
    setUpdatingId(delId);
    try {
      await updateDeliveryStatus(delId, status);
      await loadData();
      showSuccess(`Delivery marked as ${status.replace(/_/g, ' ')} successfully!`);
    } catch (e: any) {
      console.error(e);
      showError(e.message || 'Failed to update delivery status');
    } finally {
      setUpdatingId(null);
    }
  };

  const openDirections = (d: Delivery) => {
    if (d.latitude && d.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${d.latitude},${d.longitude}`, '_blank');
    } else {
      const addr = encodeURIComponent(d.delivery_address);
      window.open(`https://www.google.com/maps/search/?api=1&query=${addr}`, '_blank');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#171717] dark:text-white tracking-tight flex items-center gap-2.5">
            <Truck className="w-7 h-7 text-[#E31B23]" /> Deliveries
          </h1>
          <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4] mt-1">
            Field delivery dispatch, GPS navigation & completion tracking across Tiruppur District
          </p>
        </div>
      </div>

      {/* Quick Date & Status Filter Bar */}
      <div className="saas-card bg-white dark:bg-[#171717] p-4 rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full min-w-0">
        <div className="flex items-center gap-2 bg-[#FAFAFA] dark:bg-[#1F1F1F] p-1 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] overflow-x-auto scrollbar-none">
          <button
            onClick={() => setDateFilter('today')}
            className={`px-3.5 py-2 min-h-[44px] rounded-lg text-xs font-black transition-all border shrink-0 ${
              dateFilter === 'today'
                ? 'bg-[#FFF1F2] dark:bg-[#3B1214] text-[#C9151C] dark:text-[#FF8085] border-[#FFD6D8] dark:border-[#5C1D24] shadow-2xs'
                : 'text-[#404040] dark:text-[#D4D4D4] border-transparent hover:text-[#171717]'
            }`}
          >
            Today's Deliveries ({todayStr})
          </button>
          <button
            onClick={() => setDateFilter('all')}
            className={`px-3.5 py-2 min-h-[44px] rounded-lg text-xs font-black transition-all border shrink-0 ${
              dateFilter === 'all'
                ? 'bg-[#FFF1F2] dark:bg-[#3B1214] text-[#C9151C] dark:text-[#FF8085] border-[#FFD6D8] dark:border-[#5C1D24] shadow-2xs'
                : 'text-[#404040] dark:text-[#D4D4D4] border-transparent hover:text-[#171717]'
            }`}
          >
            All Dates
          </button>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] text-xs font-black text-[#171717] dark:text-white px-3 py-2 min-h-[44px] rounded-xl focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending Field Dispatch</option>
          <option value="out_for_delivery">Out for Delivery</option>
          <option value="delivered">Delivered Successfully</option>
          <option value="cancelled">Cancelled / Rescheduled</option>
        </select>
      </div>

      {/* Deliveries List Grid */}
      {loading ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-12 text-center rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] text-xs font-semibold text-[#737373]">
          Loading field deliveries dispatch list...
        </div>
      ) : loadError ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-8 text-center rounded-2xl border border-red-200 dark:border-red-900/50 space-y-3">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="font-black text-red-600 dark:text-red-400 text-sm">Failed to load field deliveries</p>
          <p className="text-xs text-[#737373] max-w-md mx-auto">{loadError}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-[#E31B23] text-white text-xs font-bold rounded-xl hover:bg-[#C9151C] transition-colors"
          >
            Retry Loading
          </button>
        </div>
      ) : deliveries.length === 0 ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-12 text-center rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] space-y-2">
          <Truck className="w-10 h-10 text-[#737373] mx-auto" />
          <p className="font-black text-[#171717] dark:text-white text-sm">No deliveries found</p>
          <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4]">There are no matching delivery dispatches for the selected filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deliveries.map((del, idx) => {
            const isDelivered = del.status === 'delivered';
            const isOut = del.status === 'out_for_delivery';

            return (
              <div
                key={del.id}
                className={`saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl p-5 space-y-4 shadow-xs animate-card-enter stagger-${(idx % 6) + 1} hover:-translate-y-0.5 transition-all duration-200`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FFF1F2] dark:bg-red-950/30 text-[#E31B23] flex items-center justify-center font-black text-sm shrink-0 border border-[#FFD6D8]">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono font-bold text-[#737373] block">{del.delivery_code}</span>
                      <h3 className="text-sm font-black text-[#171717] dark:text-white line-clamp-1">
                        {del.customer?.name || 'Valued Customer'}
                      </h3>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                      isDelivered
                        ? 'bg-[#F0FDF4] text-[#16A34A] border-emerald-200/60'
                        : isOut
                        ? 'bg-[#FFF1F2] text-[#E31B23] border-[#FFD6D8]'
                        : 'bg-[#FFFBEB] text-[#D97706] border-amber-200/60'
                    }`}
                  >
                    {isDelivered ? 'Delivered' : isOut ? 'Out for Delivery' : 'Pending'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-[#525252] dark:text-[#D4D4D4] font-semibold">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[#737373] shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{del.delivery_address || 'Tiruppur District, Tamil Nadu'}</span>
                  </div>
                  {del.customer?.phone && (
                    <div className="flex items-center gap-2">
                      <PhoneCall className="w-3.5 h-3.5 text-[#737373] shrink-0" />
                      <span>{del.customer.phone}</span>
                    </div>
                  )}
                  {del.notes && (
                    <div className="flex items-center gap-2 text-[11px] text-[#737373] pt-1">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{del.notes}</span>
                    </div>
                  )}
                </div>

                {/* Field Action Buttons */}
                <div className="pt-3 border-t border-[#F1F1F1] dark:border-[#262626] flex items-center gap-2">
                  {del.customer?.phone && (
                    <a
                      href={`tel:${del.customer.phone}`}
                      className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 bg-[#F0FDF4] text-[#16A34A] hover:bg-[#16A34A] hover:text-white text-xs font-black px-3 rounded-xl border border-emerald-200/60 transition-all"
                      title="Call Customer"
                    >
                      <PhoneCall className="w-4 h-4" />
                      <span>Call</span>
                    </a>
                  )}

                  <button
                    onClick={() => openDirections(del)}
                    className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#171717] dark:text-white hover:bg-[#E5E5E5] text-xs font-black px-3 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] transition-all"
                    title="GPS Directions"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Navigate</span>
                  </button>

                  {!isDelivered && (
                    <button
                      onClick={() => handleUpdateStatus(del.id, 'delivered')}
                      disabled={updatingId === del.id}
                      className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 bg-[#E31B23] hover:bg-[#C9151C] active:bg-[#A90F16] text-white text-xs font-black px-3 rounded-xl shadow-[0_6px_18px_rgba(227,27,35,0.16)] transition-all active:scale-98 disabled:opacity-50"
                      title="Mark as Delivered"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Delivered</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment Modal for Delivery */}
      {paymentDelivery && (
        <AddPaymentModal
          isOpen={!!paymentDelivery}
          onClose={() => setPaymentDelivery(null)}
          onSuccess={() => {
            setPaymentDelivery(null);
            loadData();
          }}
          preselectedCustomerId={paymentDelivery.customer_id}
        />
      )}
    </div>
  );
};

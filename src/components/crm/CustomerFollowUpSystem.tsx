import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PhoneCall, MessageSquare, Clock, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Customer, FollowUpCategory, FollowUpStatus } from '../../types/database.types';
import { getFollowUpCustomers, getCustomers, addCustomerNote } from '../../lib/db';

type FollowUpItem = {
  customer: Customer;
  daysSinceLastPurchase: number;
  outstanding: number;
  category: FollowUpCategory;
  status: FollowUpStatus;
};

export const CustomerFollowUpSystem: React.FC = () => {
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [filterCategory, setFilterCategory] = useState<'all' | FollowUpCategory>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 6;
  const [loading, setLoading] = useState(true);

  const loadFollowUps = async () => {
    setLoading(true);
    try {
      const [fuList, custRes] = await Promise.all([
        getFollowUpCustomers(),
        getCustomers({ limit: 1000, activeOnly: true }),
      ]);

      const items: FollowUpItem[] = [];

      fuList.forEach(({ customer, daysSinceLastPurchase }) => {
        let category: FollowUpCategory = 'refill_30';
        if (daysSinceLastPurchase >= 90) category = 'critical_90';
        else if (daysSinceLastPurchase >= 60) category = 'important_60';

        items.push({
          customer,
          daysSinceLastPurchase,
          outstanding: 0,
          category,
          status: 'not_contacted',
        });
      });

      // Preserve the existing payment-follow-up records without changing database behavior.
      custRes.customers.forEach((customer) => {
        if (!items.some((item) => item.customer.id === customer.id)) {
          items.push({
            customer,
            daysSinceLastPurchase: 15,
            outstanding: 0,
            category: 'payment_outstanding',
            status: 'not_contacted',
          });
        }
      });

      setFollowUps(items);
    } catch (error) {
      console.error('Customer follow-up load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFollowUps();
  }, []);

  const counts = useMemo(() => {
    return {
      all: followUps.length,
      refill_30: followUps.filter((i) => i.category === 'refill_30').length,
      important_60: followUps.filter((i) => i.category === 'important_60').length,
      critical_90: followUps.filter((i) => i.category === 'critical_90').length,
      payment_outstanding: followUps.filter((i) => i.category === 'payment_outstanding').length,
    };
  }, [followUps]);

  const filteredItems = useMemo(() => {
    if (filterCategory === 'all') return followUps;
    return followUps.filter((i) => i.category === filterCategory);
  }, [followUps, filterCategory]);

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, currentPage, PAGE_SIZE]);

  const handleFilterChange = (cat: 'all' | FollowUpCategory) => {
    setFilterCategory(cat);
    setCurrentPage(1);
  };

  const handleMarkDone = async (customer: Customer) => {
    try {
      await addCustomerNote(
        customer.id,
        `Customer follow-up completed on ${new Date().toLocaleDateString('en-IN')}`,
        'SRI SS Admin'
      );
      setFollowUps((prev) =>
        prev.map((item) =>
          item.customer.id === customer.id ? { ...item, status: 'contacted' } : item
        )
      );
    } catch (err) {
      console.error('Failed to log follow-up note:', err);
    }
  };

  const getWhatsAppUrl = (phone: string, name: string, days: number) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = encodeURIComponent(
      `Hello ${name}, this is Sri SS Gas Agency. Your LPG cylinder refill was last serviced ${days} days ago. Please let us know if you require a booking or cylinder delivery today. Thank you!`
    );
    return `https://wa.me/${phoneWithCountry}?text=${msg}`;
  };

  return (
    <div className="saas-card bg-white dark:bg-[#171717] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] p-5 sm:p-6 space-y-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F1F1F1] dark:border-[#262626] pb-4">
        <div>
          <h2 className="text-base font-black text-[#171717] dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#E31B23]" />
            Customer Follow-Up & Refill Alerts
          </h2>
          <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4] mt-0.5">
            Automated notifications for customers due for commercial / retail LPG refills
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all border btn-press ${
              filterCategory === 'all'
                ? 'bg-[#171717] dark:bg-white text-white dark:text-[#171717] border-transparent shadow-2xs font-extrabold'
                : 'text-[#525252] dark:text-[#D4D4D4] border-transparent hover:text-[#171717]'
            }`}
          >
            All Alerts ({counts.all})
          </button>
          <button
            onClick={() => handleFilterChange('refill_30')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all border btn-press ${
              filterCategory === 'refill_30'
                ? 'bg-[#FFFBEB] text-[#D97706] border-amber-200/60 shadow-2xs font-extrabold'
                : 'text-[#525252] dark:text-[#D4D4D4] border-transparent hover:text-[#171717]'
            }`}
          >
            30+ days due
          </button>
          <button
            onClick={() => handleFilterChange('important_60')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all border btn-press ${
              filterCategory === 'important_60'
                ? 'bg-[#FFFBEB] text-[#D97706] border-amber-200/60 shadow-2xs font-extrabold'
                : 'text-[#525252] dark:text-[#D4D4D4] border-transparent hover:text-[#171717]'
            }`}
          >
            60+ days due
          </button>
          <button
            onClick={() => handleFilterChange('critical_90')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all border btn-press ${
              filterCategory === 'critical_90'
                ? 'bg-[#FFF1F2] text-[#DC2626] border-red-200/60 shadow-2xs font-extrabold'
                : 'text-[#525252] dark:text-[#D4D4D4] border-transparent hover:text-[#171717]'
            }`}
          >
            90+ days urgent
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-xs text-[#737373] font-semibold">Loading follow-up records...</div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-8 text-xs text-[#737373] font-semibold">No active customer follow-ups required in this category.</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedItems.map(({ customer, daysSinceLastPurchase, category, status }, idx) => (
              <div
                key={customer.id}
                className={`p-4 rounded-xl bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] space-y-3 relative flex flex-col justify-between shadow-2xs hover:border-[#D6D6D6] hover:-translate-y-0.5 transition-all duration-200 animate-card-enter stagger-${(idx % 6) + 1}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <Link
                        to={`/customers/${customer.id}`}
                        className="text-sm font-bold text-[#171717] dark:text-white hover:text-[#E31B23] hover:underline transition-colors block truncate"
                        title={`View ${customer.name} profile`}
                        aria-label={`Open ${customer.name} customer profile`}
                      >
                        {customer.name}
                      </Link>
                      <span className="text-xs font-mono font-semibold text-[#737373]">{customer.customer_code}</span>
                    </div>

                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                        category === 'critical_90'
                          ? 'bg-[#FFF1F2] text-[#DC2626] border-[#FFD6D8]'
                          : category === 'important_60'
                          ? 'bg-[#FFFBEB] text-[#D97706] border-amber-200/60'
                          : 'bg-[#F0FDF4] text-[#16A34A] border-emerald-200/60'
                      }`}
                    >
                      {category === 'critical_90' ? '90+ Days Inactive' : category === 'important_60' ? '60+ Days Inactive' : '30+ Days Due'}
                    </span>
                  </div>

                  <div className="text-xs font-medium text-[#525252] dark:text-[#D4D4D4] space-y-1">
                    <p>Phone: <strong className="text-[#171717] dark:text-white font-bold">{customer.phone}</strong></p>
                    <p>Area: {customer.area1 || 'Tiruppur'}</p>
                    {status === 'contacted' && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#16A34A]">
                        <CheckCircle2 className="w-3 h-3" /> Contacted recently
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Toolbar Buttons */}
                <div className="pt-3 border-t border-[#F1F1F1] dark:border-[#262626] flex items-center gap-2">
                  <a
                    href={`tel:${customer.phone}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 p-2 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/30 text-[#16A34A] dark:text-emerald-400 hover:bg-[#16A34A] hover:text-white text-xs font-bold border border-emerald-200/60 dark:border-emerald-900/40 transition-all min-h-[38px] btn-press"
                    title="Call Customer"
                    aria-label={`Call ${customer.name}`}
                  >
                    <PhoneCall className="w-3.5 h-3.5" /> Call
                  </a>

                  <a
                    href={getWhatsAppUrl(customer.phone, customer.name, daysSinceLastPurchase)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 p-2 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/30 text-[#16A34A] dark:text-emerald-400 hover:bg-[#16A34A] hover:text-white text-xs font-bold border border-emerald-200/60 dark:border-emerald-900/40 transition-all min-h-[38px] btn-press"
                    title="WhatsApp Reminder"
                    aria-label={`Send WhatsApp reminder to ${customer.name}`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                  </a>

                  <button
                    onClick={() => handleMarkDone(customer)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 p-2 rounded-xl bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#171717] dark:text-white hover:bg-[#F3F4F6] dark:hover:bg-[#262626] text-xs font-bold border border-[#E5E5E5] dark:border-[#2A2A2A] transition-all min-h-[38px] cursor-pointer btn-press"
                    title="Mark follow-up as done"
                    aria-label={`Mark ${customer.name} follow-up as done`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                    <span>Done</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#F1F1F1] dark:border-[#262626] text-xs">
              <span className="font-semibold text-[#737373]">
                Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, filteredItems.length)} of {filteredItems.length} follow-ups
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#FAFAFA] transition-colors btn-press"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </button>
                <span className="px-2 font-bold text-[#171717] dark:text-white">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#FAFAFA] transition-colors btn-press"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

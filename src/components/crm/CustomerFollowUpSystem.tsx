import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PhoneCall, MessageSquare, Clock, CheckCircle2 } from 'lucide-react';
import type { Customer, FollowUpCategory, FollowUpStatus } from '../../types/database.types';
import { getFollowUpCustomers, getCustomers, addCustomerNote } from '../../lib/db';

export const CustomerFollowUpSystem: React.FC = () => {
  const [followUps, setFollowUps] = useState<Array<{
    customer: Customer;
    daysSinceLastPurchase: number;
    outstanding: number;
    category: FollowUpCategory;
    status: FollowUpStatus;
  }>>([]);

  const [filterCategory, setFilterCategory] = useState<'all' | FollowUpCategory>('all');
  const [loading, setLoading] = useState(true);

  const loadFollowUps = async () => {
    setLoading(true);
    try {
      const [fuList, custRes] = await Promise.all([
        getFollowUpCustomers(),
        getCustomers({ limit: 1000, activeOnly: true }),
      ]);

      const items: Array<{
        customer: Customer;
        daysSinceLastPurchase: number;
        outstanding: number;
        category: FollowUpCategory;
        status: FollowUpStatus;
      }> = [];

      fuList.forEach(({ customer, daysSinceLastPurchase }) => {
        let cat: FollowUpCategory = 'refill_30';
        if (daysSinceLastPurchase >= 90) cat = 'critical_90';
        else if (daysSinceLastPurchase >= 60) cat = 'important_60';

        items.push({
          customer,
          daysSinceLastPurchase,
          outstanding: 0,
          category: cat,
          status: 'not_contacted',
        });
      });

      // Add outstanding payment follow-ups
      custRes.customers.forEach((c) => {
        if (!items.some((i) => i.customer.id === c.id)) {
          items.push({
            customer: c,
            daysSinceLastPurchase: 15,
            outstanding: 0,
            category: 'payment_outstanding',
            status: 'not_contacted',
          });
        }
      });

      setFollowUps(items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFollowUps();
  }, []);

  const filteredItems = followUps.filter((item) => {
    if (filterCategory === 'all') return true;
    return item.category === filterCategory;
  });

  const handleOpenStatusModal = async (cust: Customer) => {
    try {
      await addCustomerNote(cust.id, `Contacted customer ${cust.name} for refill reminder.`);
      setFollowUps((prev) =>
        prev.map((item) => (item.customer.id === cust.id ? { ...item, status: 'contacted' } : item))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const getWhatsAppUrl = (phone: string, customerName: string, days: number) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = encodeURIComponent(
      `Hello ${customerName}, Greetings from SRI SS GAS AGENCY! We noticed your last cylinder refill was ${days} days ago. Please let us know if you require a fresh gas cylinder refill delivery. Thank you!`
    );
    return `https://wa.me/${formattedPhone}?text=${msg}`;
  };

  return (
    <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] p-6 rounded-2xl shadow-xs space-y-6">
      {/* Header & Category Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F1F1F1] dark:border-[#262626] pb-4">
        <div>
          <h3 className="text-base font-black text-[#171717] dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#E31B23]" /> Customer Follow-ups
          </h3>
          <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4] mt-0.5">
            Refill due reminders (30+, 60+, 90+ days inactive) & payment follow-ups
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] p-1 rounded-xl overflow-x-auto text-xs font-extrabold border border-[#E5E5E5] dark:border-[#2A2A2A]">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all border ${
              filterCategory === 'all'
                ? 'bg-[#FFF1F2] text-[#C9151C] border-[#FFD6D8] shadow-2xs font-black'
                : 'text-[#525252] dark:text-[#D4D4D4] border-transparent hover:text-[#171717]'
            }`}
          >
            All Follow-ups ({followUps.length})
          </button>
          <button
            onClick={() => setFilterCategory('refill_30')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all border ${
              filterCategory === 'refill_30'
                ? 'bg-[#FFF1F2] text-[#C9151C] border-[#FFD6D8] shadow-2xs font-black'
                : 'text-[#525252] dark:text-[#D4D4D4] border-transparent hover:text-[#171717]'
            }`}
          >
            30+ Days
          </button>
          <button
            onClick={() => setFilterCategory('important_60')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all border ${
              filterCategory === 'important_60'
                ? 'bg-[#FFFBEB] text-[#D97706] border-amber-200/60 shadow-2xs font-black'
                : 'text-[#525252] dark:text-[#D4D4D4] border-transparent hover:text-[#171717]'
            }`}
          >
            60+ Days
          </button>
          <button
            onClick={() => setFilterCategory('critical_90')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all border ${
              filterCategory === 'critical_90'
                ? 'bg-[#FFF1F2] text-[#DC2626] border-red-200/60 shadow-2xs font-black'
                : 'text-[#525252] dark:text-[#D4D4D4] border-transparent hover:text-[#171717]'
            }`}
          >
            90+ Days Urgent
          </button>
        </div>
      </div>

      {/* Follow-up Cards Grid */}
      {loading ? (
        <div className="text-center py-8 text-xs text-[#737373] font-semibold">Loading follow-up records...</div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-8 text-xs text-[#737373] font-semibold">No active customer follow-ups required in this category.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(({ customer, daysSinceLastPurchase, category }) => (
            <div
              key={customer.id}
              className="p-4 rounded-2xl bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] space-y-3 relative flex flex-col justify-between shadow-2xs hover:border-[#D6D6D6] transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <Link
                      to={`/customers/${customer.id}`}
                      className="text-sm font-black text-[#171717] dark:text-white hover:text-[#E31B23] transition-colors block truncate"
                    >
                      {customer.name}
                    </Link>
                    <span className="text-[10px] font-mono font-bold text-[#737373]">{customer.customer_code}</span>
                  </div>

                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                      category === 'critical_90'
                        ? 'bg-[#FFF1F2] text-[#DC2626] border-[#FFD6D8]'
                        : category === 'important_60'
                        ? 'bg-[#FFFBEB] text-[#D97706] border-amber-200/60'
                        : 'bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#525252] dark:text-[#D4D4D4] border-[#E5E5E5]'
                    }`}
                  >
                    {category === 'critical_90' ? '90+ Days Inactive' : category === 'important_60' ? '60+ Days Inactive' : '30+ Days Due'}
                  </span>
                </div>

                <div className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4] space-y-1">
                  <p>Phone: <strong className="text-[#171717] dark:text-white">{customer.phone}</strong></p>
                  <p>Area: {customer.area1 || 'Tiruppur'}</p>
                </div>
              </div>

              {/* Action Toolbar Buttons */}
              <div className="pt-3 border-t border-[#F1F1F1] dark:border-[#262626] flex items-center gap-2">
                <a
                  href={`tel:${customer.phone}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 p-2 rounded-xl bg-[#F0FDF4] text-[#16A34A] hover:bg-[#16A34A] hover:text-white text-xs font-black border border-emerald-200/60 transition-all"
                  title="Call Customer"
                >
                  <PhoneCall className="w-3.5 h-3.5" /> Call
                </a>

                <a
                  href={getWhatsAppUrl(customer.phone, customer.name, daysSinceLastPurchase)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 p-2 rounded-xl bg-[#F0FDF4] text-[#16A34A] hover:bg-[#16A34A] hover:text-white text-xs font-black border border-emerald-200/60 transition-all"
                  title="WhatsApp Reminder"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#16A34A]" /> WhatsApp
                </a>

                <button
                  onClick={() => handleOpenStatusModal(customer)}
                  className="p-2 rounded-xl bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#525252] hover:text-[#171717] border border-[#E5E5E5] transition-all"
                  title="Mark Contacted"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

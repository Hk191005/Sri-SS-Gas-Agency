import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PhoneCall, MessageSquare, Clock, CheckCircle2, ChevronDown } from 'lucide-react';
import type { Customer, FollowUpCategory, FollowUpStatus } from '../../types/database.types';
import { getFollowUpCustomers, getCustomers, addCustomerNote } from '../../lib/db';

const PAGE_SIZE = 9;

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
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

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filterCategory]);

  const filteredItems = useMemo(
    () => followUps.filter((item) => filterCategory === 'all' || item.category === filterCategory),
    [followUps, filterCategory]
  );

  const visibleItems = filteredItems.slice(0, visibleCount);
  const hasMore = visibleCount < filteredItems.length;

  const handleMarkDone = async (customer: Customer) => {
    try {
      await addCustomerNote(customer.id, `Contacted customer ${customer.name} for refill reminder.`);
      setFollowUps((prev) =>
        prev.map((item) =>
          item.customer.id === customer.id ? { ...item, status: 'contacted' } : item
        )
      );
    } catch (error) {
      console.error('Unable to mark follow-up complete:', error);
    }
  };

  const getWhatsAppUrl = (phone: string, customerName: string, days: number) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const message = encodeURIComponent(
      `Hello ${customerName}, Greetings from SRI SS GAS AGENCY! We noticed your last cylinder refill was ${days} days ago. Please let us know if you require a fresh gas cylinder refill delivery. Thank you!`
    );
    return `https://wa.me/${formattedPhone}?text=${message}`;
  };

  const getCategoryLabel = (category: FollowUpCategory) => {
    if (category === 'critical_90') return '90+ days inactive';
    if (category === 'important_60') return '60+ days inactive';
    if (category === 'payment_outstanding') return 'Payment follow-up';
    return '30+ days due';
  };

  return (
    <div className="follow-up-system saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] p-6 rounded-2xl shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F1F1F1] dark:border-[#262626] pb-4">
        <div>
          <h3 className="text-base font-black text-[#171717] dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#E31B23]" /> Customer Follow-ups
          </h3>
          <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4] mt-0.5">
            Refill reminders for 30+, 60+, and 90+ day inactive accounts, plus payment follow-ups
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] p-1 rounded-lg overflow-x-auto text-xs font-extrabold border border-[#E5E5E5] dark:border-[#2A2A2A]">
          <button
            onClick={() => setFilterCategory('all')}
            className={`follow-up-filter ${filterCategory === 'all' ? 'follow-up-filter-active' : ''}`}
          >
            All ({followUps.length})
          </button>
          <button
            onClick={() => setFilterCategory('refill_30')}
            className={`follow-up-filter ${filterCategory === 'refill_30' ? 'follow-up-filter-active' : ''}`}
          >
            30+ days
          </button>
          <button
            onClick={() => setFilterCategory('important_60')}
            className={`follow-up-filter ${filterCategory === 'important_60' ? 'follow-up-filter-active' : ''}`}
          >
            60+ days
          </button>
          <button
            onClick={() => setFilterCategory('critical_90')}
            className={`follow-up-filter ${filterCategory === 'critical_90' ? 'follow-up-filter-active' : ''}`}
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
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleItems.map(({ customer, daysSinceLastPurchase, category, status }) => (
              <div
                key={customer.id}
                className="follow-up-card p-4 rounded-2xl bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] space-y-3 relative flex flex-col justify-between shadow-2xs hover:border-[#D6D6D6] transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <Link
                        to={`/customers/${customer.id}`}
                        className="customer-profile-link text-sm font-black text-[#171717] dark:text-white hover:text-[#E31B23] transition-colors block truncate"
                        aria-label={`Open ${customer.name} customer profile`}
                      >
                        {customer.name}
                      </Link>
                      <span className="text-xs font-mono font-bold text-[#737373]">{customer.customer_code}</span>
                    </div>

                    <span className="text-xs font-extrabold px-2 py-1 rounded-lg border bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#525252] dark:text-[#D4D4D4] border-[#E5E5E5] shrink-0">
                      {getCategoryLabel(category)}
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-[#525252] dark:text-[#D4D4D4] space-y-1">
                    <p>Phone: <strong className="text-[#171717] dark:text-white">{customer.phone}</strong></p>
                    <p>Area: {customer.area1 || 'Tiruppur'}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#F1F1F1] dark:border-[#262626] grid grid-cols-3 gap-2">
                  <a
                    href={`tel:${customer.phone}`}
                    className="follow-up-action"
                    title="Call customer"
                    aria-label={`Call ${customer.name}`}
                  >
                    <PhoneCall className="w-3.5 h-3.5" /> Call
                  </a>

                  <a
                    href={getWhatsAppUrl(customer.phone, customer.name, daysSinceLastPurchase)}
                    target="_blank"
                    rel="noreferrer"
                    className="follow-up-action"
                    title="Send WhatsApp reminder"
                    aria-label={`Send WhatsApp reminder to ${customer.name}`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                  </a>

                  <button
                    onClick={() => handleMarkDone(customer)}
                    className={`follow-up-action ${status === 'contacted' ? 'follow-up-action-done' : ''}`}
                    title="Mark follow-up as done"
                    aria-label={`Mark ${customer.name} follow-up as done`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {status === 'contacted' ? 'Done' : 'Done'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-1">
              <button
                onClick={() => setVisibleCount((count) => Math.min(count + PAGE_SIZE, filteredItems.length))}
                className="follow-up-load-more"
              >
                <ChevronDown className="w-4 h-4" />
                Load more follow-ups ({filteredItems.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

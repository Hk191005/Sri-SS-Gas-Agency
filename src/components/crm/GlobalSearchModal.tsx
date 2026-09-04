import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, User, Building2, ArrowRight } from 'lucide-react';
import { getCustomers, getPurchases, getDeliveries } from '../../lib/db';
import { getSupplierPurchases } from '../../lib/supplierDb';
import type { Customer, Purchase, Delivery, SupplierPurchase } from '../../types/database.types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const [matchedCustomers, setMatchedCustomers] = useState<Customer[]>([]);
  const [matchedPurchases, setMatchedPurchases] = useState<Purchase[]>([]);
  const [matchedDeliveries, setMatchedDeliveries] = useState<Delivery[]>([]);
  const [matchedSupplierPurchases, setMatchedSupplierPurchases] = useState<SupplierPurchase[]>([]);

  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setMatchedCustomers([]);
      setMatchedPurchases([]);
      setMatchedDeliveries([]);
      setMatchedSupplierPurchases([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setMatchedCustomers([]);
      setMatchedPurchases([]);
      setMatchedDeliveries([]);
      setMatchedSupplierPurchases([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const q = query.trim().toLowerCase();

        // Query customers
        const custRes = await getCustomers({ search: q, limit: 5 });
        setMatchedCustomers(custRes.customers);

        // Query Purchases
        const purRes = await getPurchases({ search: q });
        setMatchedPurchases(purRes.slice(0, 4));

        // Query Deliveries
        const delRes = await getDeliveries();
        const delMatched = delRes.filter(
          (d) =>
            d.delivery_code.toLowerCase().includes(q) ||
            d.delivery_address.toLowerCase().includes(q) ||
            d.customer?.name.toLowerCase().includes(q)
        );
        setMatchedDeliveries(delMatched.slice(0, 4));

        // Query Supplier Purchases
        const supRes = await getSupplierPurchases();
        const supMatched = supRes.filter(
          (sp) =>
            sp.purchase_code.toLowerCase().includes(q) ||
            sp.invoice_number.toLowerCase().includes(q) ||
            sp.supplier_name.toLowerCase().includes(q)
        );
        setMatchedSupplierPurchases(supMatched.slice(0, 4));
      } catch (e) {
        console.error('Global search error:', e);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleSelectCustomer = (id: string) => {
    onClose();
    navigate(`/customers/${id}`);
  };

  const totalResults =
    matchedCustomers.length + matchedPurchases.length + matchedDeliveries.length + matchedSupplierPurchases.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 p-4 overflow-y-auto">
      <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Search Bar Header */}
        <div className="p-4 border-b border-[#F1F1F1] dark:border-[#262626] flex items-center gap-3 bg-[#FAFAFA] dark:bg-[#1F1F1F]">
          <Search className="w-5 h-5 text-[#E31B23] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers, sales, deliveries... (Name, Phone '9876...', ID 'SSG-0001')"
            className="w-full bg-transparent text-sm font-semibold text-[#171717] dark:text-white placeholder-[#737373] focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[#737373] hover:text-[#171717] p-1">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block text-[10px] font-mono font-bold text-[#737373] bg-white dark:bg-[#171717] px-2 py-0.5 rounded border border-[#E5E5E5] dark:border-[#2A2A2A]">
            ESC
          </kbd>
        </div>

        {/* Search Results Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!query.trim() ? (
            <div className="py-8 text-center text-[#737373] space-y-2">
              <Search className="w-8 h-8 mx-auto text-[#737373] opacity-50" />
              <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4]">Type to search customers, sales, supplier bills, or deliveries...</p>
              <div className="flex justify-center gap-2 pt-2 text-[11px] font-mono text-[#737373]">
                <span className="bg-[#FAFAFA] dark:bg-[#1F1F1F] px-2 py-1 rounded border border-[#E5E5E5] dark:border-[#2A2A2A]">Phone: 98765...</span>
                <span className="bg-[#FAFAFA] dark:bg-[#1F1F1F] px-2 py-1 rounded border border-[#E5E5E5] dark:border-[#2A2A2A]">ID: SSG-000001</span>
                <span className="bg-[#FAFAFA] dark:bg-[#1F1F1F] px-2 py-1 rounded border border-[#E5E5E5] dark:border-[#2A2A2A]">Inv: SPUR-000001</span>
              </div>
            </div>
          ) : loading ? (
            <div className="py-8 text-center text-xs font-semibold text-[#737373]">Searching records...</div>
          ) : totalResults === 0 ? (
            <div className="py-8 text-center text-xs font-semibold text-[#737373]">No matching records found for "{query}".</div>
          ) : (
            <div className="space-y-4">
              {/* Customers Group */}
              {matchedCustomers.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-[#737373] uppercase tracking-wider px-2">
                    Customers ({matchedCustomers.length})
                  </h4>
                  <div className="space-y-1">
                    {matchedCustomers.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => handleSelectCustomer(c.id)}
                        className="p-3 rounded-xl hover:bg-[#FFF1F2] dark:hover:bg-red-950/20 cursor-pointer flex items-center justify-between transition-colors group border border-transparent hover:border-[#FFD6D8]"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                              c.customer_type === 'company'
                                ? 'bg-[#FFF1F2] text-[#E31B23]'
                                : 'bg-[#FAFAFA] text-[#171717]'
                            }`}
                          >
                            {c.customer_type === 'company' ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-xs font-black text-[#171717] dark:text-white group-hover:text-[#E31B23] transition-colors">
                              {c.name}
                            </p>
                            <span className="text-[11px] text-[#525252] dark:text-[#D4D4D4] font-semibold">
                              <strong className="text-[#C9151C] font-mono">{c.customer_code}</strong> • {c.phone} • {c.area1 || c.city || 'Tiruppur'}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#737373] group-hover:text-[#E31B23] transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Supplier Purchases Group */}
              {matchedSupplierPurchases.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-[#737373] uppercase tracking-wider px-2">
                    Supplier Stock Purchases ({matchedSupplierPurchases.length})
                  </h4>
                  <div className="space-y-1">
                    {matchedSupplierPurchases.map((sp) => (
                      <div
                        key={sp.id}
                        onClick={() => {
                          onClose();
                          navigate('/supplier-purchases');
                        }}
                        className="p-3 rounded-xl hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F] cursor-pointer flex items-center justify-between transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#FAFAFA] text-[#171717] flex items-center justify-center font-bold text-xs border border-[#E5E5E5]">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-[#171717] dark:text-white">
                              {sp.supplier_name} — Invoice #{sp.invoice_number}
                            </p>
                            <span className="text-[11px] text-[#525252] font-mono">
                              {sp.purchase_code} • ₹{sp.total_amount.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#737373] group-hover:text-[#E31B23] transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

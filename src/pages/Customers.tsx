import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Customer } from '../types/database.types';
import { getCustomers, toggleCustomerActive } from '../lib/db';
import { CustomerFormModal } from '../components/customers/CustomerFormModal';
import { DeleteCustomerModal } from '../components/customers/DeleteCustomerModal';
import { MergeCustomerModal } from '../components/customers/MergeCustomerModal';
import { useToast } from '../context/ToastContext';
import {
  Users,
  Search,
  Plus,
  User,
  Building2,
  Phone,
  MapPin,
  Edit,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  PhoneCall,
  LayoutGrid,
  List,
  MessageSquare,
  Trash2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  GitMerge,
} from 'lucide-react';

/**
 * Compares two customer codes / IDs numerically based on the numeric portion of the ID.
 * Handles formats like SSG-000001, SSG-000010, etc.
 */
export function compareCustomerCodes(
  codeA: string = '',
  codeB: string = '',
  direction: 'asc' | 'desc' = 'asc'
): number {
  const cleanA = (codeA || '').trim();
  const cleanB = (codeB || '').trim();

  const matchA = cleanA.match(/\d+/);
  const matchB = cleanB.match(/\d+/);

  let result = 0;
  if (matchA && matchB) {
    const prefixA = cleanA.substring(0, matchA.index);
    const prefixB = cleanB.substring(0, matchB.index);
    const prefixCmp = prefixA.localeCompare(prefixB, undefined, { sensitivity: 'base' });

    if (prefixCmp !== 0) {
      result = prefixCmp;
    } else {
      const valA = parseInt(matchA[0], 10);
      const valB = parseInt(matchB[0], 10);
      if (valA !== valB) {
        result = valA - valB;
      } else {
        result = cleanA.localeCompare(cleanB, undefined, { numeric: true, sensitivity: 'base' });
      }
    }
  } else if (matchA && !matchB) {
    result = -1;
  } else if (!matchA && matchB) {
    result = 1;
  } else {
    result = cleanA.localeCompare(cleanB, undefined, { numeric: true, sensitivity: 'base' });
  }

  return direction === 'asc' ? result : -result;
}

export const Customers: React.FC = () => {
  const [allFetchedCustomers, setAllFetchedCustomers] = useState<Customer[]>([]);
  const [displayedCustomers, setDisplayedCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const { showSuccess, showError } = useToast();

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<
    'all' | 'active' | 'inactive' | 'individual' | 'company' | 'followup'
  >('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'name' | 'code'>('code');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [customerToMerge, setCustomerToMerge] = useState<Customer | null>(null);

  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      // Fetch complete real dataset from Supabase (all active & inactive/soft-deleted)
      const res = await getCustomers({
        search: '',
        type: 'all',
        activeOnly: false,
        page: 1,
        limit: 1000,
      });

      setAllFetchedCustomers(res.customers);
    } catch (e: any) {
      console.error(e);
      setLoadError(e.message || 'Failed to load customers from database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter and sort the complete dataset reactively
  useEffect(() => {
    let filtered = [...allFetchedCustomers];

    // 1. Tab filtering
    if (activeTab === 'active') {
      filtered = filtered.filter((c) => c.is_active && !c.deleted_at);
    } else if (activeTab === 'inactive') {
      filtered = filtered.filter((c) => !c.is_active || c.deleted_at !== null);
    } else if (activeTab === 'individual') {
      filtered = filtered.filter((c) => c.customer_type === 'individual');
    } else if (activeTab === 'company') {
      filtered = filtered.filter((c) => c.customer_type === 'company');
    } else if (activeTab === 'followup') {
      // Followup filter (active accounts)
      filtered = filtered.filter((c) => c.is_active);
    }
    // 'all' preserves all customer records (active, inactive, soft-deleted)

    // 2. Search filtering across complete dataset
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      filtered = filtered.filter((c) => {
        const codeMatch = c.customer_code?.toLowerCase().includes(term);
        const nameMatch = c.name?.toLowerCase().includes(term);
        const companyMatch = c.company_name?.toLowerCase().includes(term);
        const contactMatch = c.contact_person_name?.toLowerCase().includes(term);
        const phoneMatch = c.phone?.toLowerCase().includes(term);
        const altPhoneMatch = c.alternate_phone?.toLowerCase().includes(term);
        const streetMatch = c.street?.toLowerCase().includes(term);
        const areaMatch = c.area1?.toLowerCase().includes(term);
        const cityMatch = c.city?.toLowerCase().includes(term);
        return (
          codeMatch ||
          nameMatch ||
          companyMatch ||
          contactMatch ||
          phoneMatch ||
          altPhoneMatch ||
          streetMatch ||
          areaMatch ||
          cityMatch
        );
      });
    }

    // 3. Sorting
    if (sortField === 'name') {
      filtered.sort((a, b) =>
        sortDirection === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name)
      );
    } else {
      filtered.sort((a, b) => compareCustomerCodes(a.customer_code, b.customer_code, sortDirection));
    }

    setDisplayedCustomers(filtered);
  }, [allFetchedCustomers, activeTab, search, sortField, sortDirection]);

  const handleSortToggle = (field: 'code' | 'name') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setPage(1);
  };

  const handleToggleActive = async (cust: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    const action = cust.is_active ? 'deactivate' : 'reactivate';
    if (window.confirm(`Are you sure you want to ${action} customer ${cust.name}?`)) {
      try {
        await toggleCustomerActive(cust.id, !cust.is_active);
        await loadData();
        showSuccess(`Customer ${cust.name} ${cust.is_active ? 'deactivated' : 'reactivated'} successfully.`);
      } catch (err: any) {
        showError(err.message || 'Failed to update customer status');
      }
    }
  };

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cust: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCustomer(cust);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (cust: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomerToDelete(cust);
    setIsDeleteModalOpen(true);
  };

  const handleOpenMerge = (cust?: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCustomerToMerge(cust || null);
    setIsMergeModalOpen(true);
  };

  // Pagination calculation
  const totalCount = displayedCustomers.length;
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const paginatedCustomers = displayedCustomers.slice((page - 1) * limit, page * limit);

  // Tab counts
  const totalAll = allFetchedCustomers.length;
  const totalActive = allFetchedCustomers.filter((c) => c.is_active && !c.deleted_at).length;
  const totalInactive = allFetchedCustomers.filter((c) => !c.is_active || c.deleted_at !== null).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#171717] dark:text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-[#E31B23]" /> Customers Directory
          </h1>
          <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4] mt-1">
            Manage customer accounts, refill activity & contact details ({totalAll} total accounts registered)
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => handleOpenMerge()}
            className="flex items-center justify-center gap-2 bg-white dark:bg-[#1F1F1F] hover:bg-[#FAFAFA] text-[#171717] dark:text-white border border-[#E5E5E5] dark:border-[#2A2A2A] font-black text-xs px-4 py-2.5 rounded-[12px] shadow-xs transition-all active:scale-98"
            title="Merge duplicate customer accounts safely"
          >
            <GitMerge className="w-4 h-4 text-[#E31B23]" /> Merge Customers
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 bg-[#E31B23] hover:bg-[#C9151C] text-white font-black text-xs px-4.5 py-2.5 rounded-[12px] shadow-[0_6px_18px_rgba(227,27,35,0.16)] transition-all active:scale-98"
          >
            <Plus className="w-4 h-4" /> Add New Customer
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#F1F1F1] dark:border-[#262626] pb-2 overflow-x-auto text-xs font-extrabold">
        {[
          { id: 'all', label: `All Customers (${totalAll})` },
          { id: 'active', label: `Active Customers (${totalActive})` },
          { id: 'inactive', label: `Inactive Accounts (${totalInactive})` },
          { id: 'individual', label: 'Individuals' },
          { id: 'company', label: 'Companies' },
          { id: 'followup', label: 'Follow-up Due' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all border ${
              activeTab === tab.id
                ? 'bg-[#FFF1F2] text-[#C9151C] border-[#FFD6D8] font-black shadow-2xs'
                : 'bg-white dark:bg-[#171717] text-[#525252] dark:text-[#D4D4D4] border-[#E5E5E5] dark:border-[#2A2A2A] hover:bg-[#FAFAFA]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter & View Controls */}
      <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] p-4 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#737373]" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search ID (SSG-...), Name, Phone, Company, Street..."
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs text-[#171717] dark:text-white placeholder-[#737373] focus:outline-none focus:ring-2 focus:ring-[#E31B23]/20 font-semibold"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            <select
              value={`${sortField}_${sortDirection}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split('_') as ['code' | 'name', 'asc' | 'desc'];
                setSortField(field);
                setSortDirection(dir);
                setPage(1);
              }}
              className="bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] text-xs text-[#171717] dark:text-white px-3 py-2 rounded-xl focus:outline-none font-bold cursor-pointer"
            >
              <option value="code_asc">Sort: Customer ID (Asc 1 → 9)</option>
              <option value="code_desc">Sort: Customer ID (Desc 9 → 1)</option>
              <option value="name_asc">Sort: Name (A → Z)</option>
              <option value="name_desc">Sort: Name (Z → A)</option>
            </select>

            <div className="flex items-center bg-[#FAFAFA] dark:bg-[#1F1F1F] p-1 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A]">
              <button
                onClick={() => setViewMode('card')}
                className={`p-1.5 rounded-lg text-xs font-semibold ${
                  viewMode === 'card'
                    ? 'bg-white dark:bg-[#262626] text-[#E31B23] border border-[#E5E5E5] shadow-2xs'
                    : 'text-[#737373]'
                }`}
                title="Card Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-semibold ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-[#262626] text-[#E31B23] border border-[#E5E5E5] shadow-2xs'
                    : 'text-[#737373]'
                }`}
                title="Table Ledger View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Customers List Grid or Table */}
      {loading ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-12 text-center rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] text-xs font-semibold text-[#737373]">
          Loading customer directory accounts...
        </div>
      ) : loadError ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-8 text-center rounded-2xl border border-red-200 dark:border-red-900/50 space-y-3">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="font-black text-red-600 dark:text-red-400 text-sm">Failed to load customers</p>
          <p className="text-xs text-[#737373] max-w-md mx-auto">{loadError}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-[#E31B23] text-white text-xs font-bold rounded-xl hover:bg-[#C9151C] transition-colors"
          >
            Retry Loading
          </button>
        </div>
      ) : paginatedCustomers.length === 0 ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-12 text-center rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] space-y-2">
          <Users className="w-10 h-10 text-[#737373] mx-auto" />
          <p className="font-black text-[#171717] dark:text-white text-sm">No customers found</p>
          <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4]">
            Try adjusting your search query or active filter category.
          </p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedCustomers.map((cust) => (
            <div
              key={cust.id}
              onClick={() => navigate(`/customers/${cust.id}`)}
              className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl p-5 space-y-4 cursor-pointer hover:border-[#D6D6D6] transition-all shadow-xs group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border ${
                      cust.customer_type === 'company'
                        ? 'bg-[#FFF1F2] text-[#E31B23] border-[#FFD6D8]'
                        : 'bg-[#FAFAFA] text-[#171717] border-[#E5E5E5]'
                    }`}
                  >
                    {cust.customer_type === 'company' ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-black text-[#C9151C] bg-[#FFF1F2] px-2 py-0.5 rounded border border-[#FFD6D8]">
                      {cust.customer_code}
                    </span>
                    <h3 className="text-sm font-black text-[#171717] dark:text-white group-hover:text-[#E31B23] transition-colors mt-1 line-clamp-1">
                      {cust.name}
                    </h3>
                    {cust.company_name && (
                      <p className="text-[11px] font-bold text-[#737373] line-clamp-1">{cust.company_name}</p>
                    )}
                  </div>
                </div>

                <span
                  className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border shrink-0 ${
                    cust.is_active && !cust.deleted_at
                      ? 'bg-[#F0FDF4] text-[#16A34A] border-emerald-200/60'
                      : 'bg-[#FAFAFA] text-[#737373] border-[#E5E5E5]'
                  }`}
                >
                  {cust.is_active && !cust.deleted_at ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-[#525252] dark:text-[#D4D4D4] font-semibold">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-[#737373] shrink-0" />
                  <span>{cust.phone}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#737373] shrink-0 mt-0.5" />
                  <span className="line-clamp-1">
                    {[cust.street, cust.area1, cust.city || 'Tiruppur'].filter(Boolean).join(', ')}
                  </span>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="pt-3 border-t border-[#F1F1F1] dark:border-[#262626] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <a
                    href={`tel:${cust.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 rounded-lg bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#525252] hover:text-[#16A34A] hover:bg-[#F0FDF4] border border-[#E5E5E5] dark:border-[#2A2A2A] transition-colors"
                    title="Call Customer"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/messages?customerId=${cust.id}`);
                    }}
                    className="p-2 rounded-lg bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#525252] hover:text-[#E31B23] hover:bg-[#FFF1F2] border border-[#E5E5E5] dark:border-[#2A2A2A] transition-colors"
                    title="Send Message / Refill Reminder"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#E31B23]" />
                  </button>
                  <button
                    onClick={(e) => handleOpenMerge(cust, e)}
                    className="p-2 rounded-lg bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#525252] hover:text-[#E31B23] hover:bg-[#FFF1F2] border border-[#E5E5E5] dark:border-[#2A2A2A] transition-colors"
                    title="Merge Customer Account"
                  >
                    <GitMerge className="w-3.5 h-3.5 text-[#E31B23]" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => handleOpenEdit(cust, e)}
                    className="p-2 rounded-lg bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#525252] hover:text-[#171717] border border-[#E5E5E5] transition-colors"
                    title="Edit Customer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleToggleActive(cust, e)}
                    className="p-2 rounded-lg bg-[#FAFAFA] dark:bg-[#1F1F1F] text-[#525252] hover:text-[#DC2626] border border-[#E5E5E5] transition-colors"
                    title={cust.is_active ? 'Deactivate Account' : 'Reactivate Account'}
                  >
                    {cust.is_active ? (
                      <UserX className="w-3.5 h-3.5" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5 text-[#16A34A]" />
                    )}
                  </button>
                  <button
                    onClick={(e) => handleOpenDelete(cust, e)}
                    className="p-2 rounded-lg bg-[#FFF1F2] dark:bg-red-950/30 text-[#DC2626] hover:bg-[#FFE4E6] border border-[#FFD6D8] dark:border-red-900/40 transition-colors"
                    title="Delete or Archive Customer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="saas-card bg-white dark:bg-[#171717] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[780px] text-left border-collapse text-xs font-semibold">
              <thead>
                <tr className="bg-[#FAFAFA] dark:bg-[#1F1F1F] border-b border-[#E5E5E5] dark:border-[#2A2A2A] font-extrabold text-[#525252] uppercase text-[10px] tracking-wider">
                  <th
                    onClick={() => handleSortToggle('code')}
                    className="py-3.5 px-4 cursor-pointer select-none hover:text-[#C9151C] transition-colors group"
                    title="Click to sort by Customer ID"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={sortField === 'code' ? 'text-[#C9151C] font-black' : ''}>Customer ID</span>
                      {sortField === 'code' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#C9151C] stroke-[2.5]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#C9151C] stroke-[2.5]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-[#737373] opacity-40 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortToggle('name')}
                    className="py-3.5 px-4 cursor-pointer select-none hover:text-[#C9151C] transition-colors group"
                    title="Click to sort by Name"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={sortField === 'name' ? 'text-[#C9151C] font-black' : ''}>Name / Company</span>
                      {sortField === 'name' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#C9151C] stroke-[2.5]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#C9151C] stroke-[2.5]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-[#737373] opacity-40 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th className="py-3.5 px-4">Phone</th>
                  <th className="py-3.5 px-4">Area / Location</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F1F1] dark:divide-[#262626] text-[#171717] dark:text-[#F5F5F5]">
                {paginatedCustomers.map((cust) => (
                  <tr
                    key={cust.id}
                    onClick={() => navigate(`/customers/${cust.id}`)}
                    className="hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F] cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-black text-[#C9151C]">{cust.customer_code}</td>
                    <td className="py-3.5 px-4 font-black">
                      {cust.name}
                      {cust.company_name && (
                        <span className="block text-[11px] text-[#737373] font-normal">{cust.company_name}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-bold">{cust.phone}</td>
                    <td className="py-3.5 px-4 font-medium text-[#525252]">
                      {[cust.street, cust.area1, cust.city || 'Tiruppur'].filter(Boolean).join(', ')}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                          cust.is_active && !cust.deleted_at
                            ? 'bg-[#F0FDF4] text-[#16A34A] border-emerald-200/60'
                            : 'bg-[#FAFAFA] text-[#737373] border-[#E5E5E5]'
                        }`}
                      >
                        {cust.is_active && !cust.deleted_at ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/messages?customerId=${cust.id}`);
                          }}
                          className="p-1.5 text-[#525252] hover:text-[#E31B23] transition-colors"
                          title="Message Customer"
                        >
                          <MessageSquare className="w-4 h-4 text-[#E31B23]" />
                        </button>
                        <button
                          onClick={(e) => handleOpenMerge(cust, e)}
                          className="p-1.5 text-[#525252] hover:text-[#E31B23] transition-colors"
                          title="Merge Customer Account"
                        >
                          <GitMerge className="w-4 h-4 text-[#E31B23]" />
                        </button>
                        <button
                          onClick={(e) => handleOpenEdit(cust, e)}
                          className="p-1.5 text-[#525252] hover:text-[#171717] transition-colors"
                          title="Edit Customer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleOpenDelete(cust, e)}
                          className="p-1.5 text-[#DC2626] hover:text-red-700 transition-colors"
                          title="Delete or Archive Customer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Footer */}
      <div className="flex items-center justify-between text-xs font-semibold text-[#525252] dark:text-[#D4D4D4] pt-2">
        <span>
          Showing {paginatedCustomers.length} of {totalCount} accounts (Page {page} of {totalPages})
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-xl bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#171717] dark:text-white disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-xl bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#171717] dark:text-white disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Form Modal */}
      <CustomerFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        customerToEdit={editingCustomer}
        onSuccess={loadData}
      />

      {/* Delete Confirmation Modal */}
      <DeleteCustomerModal
        isOpen={isDeleteModalOpen}
        customer={customerToDelete}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setCustomerToDelete(null);
        }}
        onDeleted={() => {
          loadData();
        }}
      />

      {/* Merge Duplicate Customer Modal */}
      <MergeCustomerModal
        isOpen={isMergeModalOpen}
        onClose={() => {
          setIsMergeModalOpen(false);
          setCustomerToMerge(null);
        }}
        initialDuplicateCustomer={customerToMerge}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Customer, CustomerType } from '../types/database.types';
import { getCustomers, toggleCustomerActive } from '../lib/db';
import { CustomerFormModal } from '../components/customers/CustomerFormModal';
import { DeleteCustomerModal } from '../components/customers/DeleteCustomerModal';
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
} from 'lucide-react';

export const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const { showSuccess, showError } = useToast();

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<'all' | 'individual' | 'company' | 'followup' | 'inactive'>('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'name' | 'code'>('name');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      let type: CustomerType | 'all' = 'all';
      let activeOnly = true;

      if (activeTab === 'individual') type = 'individual';
      else if (activeTab === 'company') type = 'company';
      else if (activeTab === 'inactive') activeOnly = false;

      const res = await getCustomers({
        search,
        type,
        activeOnly,
        page,
        limit,
      });

      let filtered = [...res.customers];

      if (activeTab === 'inactive') {
        filtered = filtered.filter((c) => !c.is_active);
      }

      if (sortField === 'name') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
      } else {
        filtered.sort((a, b) => a.customer_code.localeCompare(b.customer_code));
      }

      setCustomers(filtered);
      setTotalCount(res.total);
    } catch (e: any) {
      console.error(e);
      setLoadError(e.message || 'Failed to load customers from database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, activeTab, sortField, page]);

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

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#171717] dark:text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-[#E31B23]" /> Customers
          </h1>
          <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4] mt-1">
            Manage customer accounts, refill activity & contact details across Tiruppur District
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 bg-[#E31B23] hover:bg-[#C9151C] text-white font-black text-xs px-4.5 py-2.5 rounded-[12px] shadow-[0_6px_18px_rgba(227,27,35,0.16)] transition-all active:scale-98 shrink-0"
        >
          <Plus className="w-4 h-4" /> Add New Customer
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#F1F1F1] dark:border-[#262626] pb-2 overflow-x-auto text-xs font-extrabold">
        {[
          { id: 'all', label: 'All Customers' },
          { id: 'individual', label: 'Individuals' },
          { id: 'company', label: 'Companies' },
          { id: 'followup', label: 'Follow-up Due' },
          { id: 'inactive', label: 'Inactive Accounts' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all border ${
              activeTab === tab.id
                ? 'bg-[#FFF1F2] text-[#C9151C] border-[#FFD6D8] font-black'
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
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#737373]" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search ID (SSG-...), Name, Phone, Street..."
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs text-[#171717] dark:text-white placeholder-[#737373] focus:outline-none focus:ring-2 focus:ring-[#E31B23]/20 font-semibold"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] text-xs text-[#171717] dark:text-white px-3 py-2 rounded-xl focus:outline-none font-bold"
            >
              <option value="name">Sort: Name (A-Z)</option>
              <option value="code">Sort: Customer ID</option>
            </select>

            <div className="flex items-center bg-[#FAFAFA] dark:bg-[#1F1F1F] p-1 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A]">
              <button
                onClick={() => setViewMode('card')}
                className={`p-1.5 rounded-lg text-xs font-semibold ${
                  viewMode === 'card' ? 'bg-white dark:bg-[#262626] text-[#E31B23] border border-[#E5E5E5] shadow-2xs' : 'text-[#737373]'
                }`}
                title="Card Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-semibold ${
                  viewMode === 'table' ? 'bg-white dark:bg-[#262626] text-[#E31B23] border border-[#E5E5E5] shadow-2xs' : 'text-[#737373]'
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
      ) : customers.length === 0 ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-12 text-center rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] space-y-2">
          <Users className="w-10 h-10 text-[#737373] mx-auto" />
          <p className="font-black text-[#171717] dark:text-white text-sm">No customers found</p>
          <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4]">Try adjusting your search query or active filter category.</p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((cust) => (
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
                  </div>
                </div>

                <span
                  className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                    cust.is_active
                      ? 'bg-[#F0FDF4] text-[#16A34A] border-emerald-200/60'
                      : 'bg-[#FAFAFA] text-[#737373] border-[#E5E5E5]'
                  }`}
                >
                  {cust.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-[#525252] dark:text-[#D4D4D4] font-semibold">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-[#737373] shrink-0" />
                  <span>{cust.phone}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#737373] shrink-0 mt-0.5" />
                  <span className="line-clamp-1">{[cust.area1, cust.city || 'Tiruppur'].filter(Boolean).join(', ')}</span>
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
                    {cust.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5 text-[#16A34A]" />}
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
            <table className="w-full min-w-[750px] text-left border-collapse text-xs font-semibold">
              <thead>
                <tr className="bg-[#FAFAFA] dark:bg-[#1F1F1F] border-b border-[#E5E5E5] dark:border-[#2A2A2A] font-extrabold text-[#525252] uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Customer ID</th>
                  <th className="py-3.5 px-4">Name / Company</th>
                  <th className="py-3.5 px-4">Phone</th>
                  <th className="py-3.5 px-4">Area / Location</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F1F1] dark:divide-[#262626] text-[#171717] dark:text-[#F5F5F5]">
                {customers.map((cust) => (
                  <tr
                    key={cust.id}
                    onClick={() => navigate(`/customers/${cust.id}`)}
                    className="hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F] cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-black text-[#C9151C]">{cust.customer_code}</td>
                    <td className="py-3.5 px-4 font-black">
                      {cust.name}
                      {cust.company_name && <span className="block text-[11px] text-[#737373] font-normal">{cust.company_name}</span>}
                    </td>
                    <td className="py-3.5 px-4 font-bold">{cust.phone}</td>
                    <td className="py-3.5 px-4 font-medium text-[#525252]">{cust.area1 || cust.city || 'Tiruppur'}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                          cust.is_active
                            ? 'bg-[#F0FDF4] text-[#16A34A] border-emerald-200/60'
                            : 'bg-[#FAFAFA] text-[#737373] border-[#E5E5E5]'
                        }`}
                      >
                        {cust.is_active ? 'Active' : 'Inactive'}
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
          Showing {customers.length} of {totalCount} accounts (Page {page} of {totalPages})
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
    </div>
  );
};

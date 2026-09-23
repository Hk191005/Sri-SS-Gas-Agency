import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { Customer, Purchase, Payment, Deposit, CustomerNote } from '../types/database.types';
import {
  getCustomerById,
  getPurchases,
  getPayments,
  getDeposits,
  getCustomerNotes,
  addCustomerNote,
} from '../lib/db';
import { exportCustomerProfilePdf } from '../lib/pdfExport';
import { useToast } from '../context/ToastContext';
import { CustomerDocuments } from '../components/customers/CustomerDocuments';
import { CustomerFormModal } from '../components/customers/CustomerFormModal';
import { DeleteCustomerModal } from '../components/customers/DeleteCustomerModal';
import { MergeCustomerModal } from '../components/customers/MergeCustomerModal';
import { EditPurchaseDateModal } from '../components/purchases/EditPurchaseDateModal';
import { DeletePurchaseModal } from '../components/purchases/DeletePurchaseModal';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Building2,
  User,
  ShoppingBag,
  CreditCard,
  PhoneCall,
  Edit,
  Database,
  Download,
  Trash2,
  Clock,
  Loader2,
  MessageSquare,
  Send,
  AlertTriangle,
  Calendar,
  Edit2,
  GitMerge,
  FileText,
} from 'lucide-react';

export const CustomerProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [notes, setNotes] = useState<CustomerNote[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'purchases' | 'payments' | 'documents'>('overview');

  // Notes state
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [deletingPurchase, setDeletingPurchase] = useState<Purchase | null>(null);

  const loadCustomerData = async () => {
    if (!id) return;
    setLoading(true);
    setLoadError('');
    try {
      const c = await getCustomerById(id);
      if (!c) {
        setLoadError('Customer record not found.');
        return;
      }
      setCustomer(c);

      const [pur, pay, dep, nts] = await Promise.all([
        getPurchases({ customerId: id }),
        getPayments(id),
        getDeposits(id),
        getCustomerNotes(id),
      ]);

      setPurchases(pur);
      setPayments(pay);
      setDeposits(dep);
      setNotes(nts);
    } catch (e: any) {
      console.error('Error loading customer profile', e);
      setLoadError(e.message || 'Failed to load customer profile from database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomerData();
  }, [id]);

  const handleAddNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newNote.trim()) return;
    setSavingNote(true);
    try {
      await addCustomerNote(id, newNote.trim());
      setNewNote('');
      await loadCustomerData();
      showSuccess('Customer note added successfully!');
    } catch (err: any) {
      showError(err.message || 'Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-[#737373] text-xs font-bold">Loading customer profile...</div>;
  }

  if (loadError || !customer) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="saas-card max-w-md mx-auto bg-white dark:bg-[#171717] p-8 rounded-2xl border border-red-200 dark:border-red-900/50 space-y-3">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="font-black text-red-600 dark:text-red-400 text-sm">{loadError || 'Customer not found'}</p>
          <div className="flex justify-center gap-2 pt-2">
            <button
              onClick={() => navigate('/customers')}
              className="px-4 py-2 bg-gray-100 dark:bg-[#262626] text-[#171717] dark:text-white text-xs font-bold rounded-xl hover:bg-gray-200 transition-colors"
            >
              Back to Customers
            </button>
            <button
              onClick={loadCustomerData}
              className="px-4 py-2 bg-[#E31B23] text-white text-xs font-bold rounded-xl hover:bg-[#C9151C] transition-colors"
            >
              Retry Loading
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalPurchasesAmount = purchases.reduce((sum, p) => sum + p.total_gas_amount, 0);
  const totalPaymentsAmount = payments.reduce((sum, py) => sum + py.amount, 0);
  const activeDepositsHeld = deposits.filter((d) => d.status === 'given' || d.status === 'held').reduce((sum, d) => sum + d.amount, 0);
  const outstandingAmount = Math.max(0, totalPurchasesAmount - totalPaymentsAmount);

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full min-w-0">
      {/* Top Header & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 w-full min-w-0">
        <button
          onClick={() => navigate('/customers')}
          className="inline-flex items-center gap-2 text-xs font-black text-[#525252] dark:text-[#D4D4D4] hover:text-[#171717] dark:hover:text-white transition-colors min-h-[40px] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Customers Directory
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={async () => {
              if (exportingPdf || !customer) return;
              setExportingPdf(true);
              try {
                await exportCustomerProfilePdf(customer, purchases, payments, deposits);
              } catch (e: any) {
                alert('PDF Export error: ' + e.message);
              } finally {
                setExportingPdf(false);
              }
            }}
            disabled={exportingPdf}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-white dark:bg-[#1F1F1F] text-[#111111] dark:text-white border border-[#E5E5E5] dark:border-[#2A2A2A] text-xs font-black hover:bg-[#FAFAFA] transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            title="Download confidential customer ledger & statement as PDF"
          >
            {exportingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E31B23]" />
            ) : (
              <Download className="w-3.5 h-3.5 text-[#E31B23]" />
            )}
            <span>Export Statement (PDF)</span>
          </button>

          <button
            onClick={() => navigate(`/messages?customerId=${customer.id}`)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-white dark:bg-[#1F1F1F] text-[#111111] dark:text-white border border-[#E5E5E5] dark:border-[#2A2A2A] text-xs font-black hover:bg-[#FAFAFA] transition-all shadow-xs cursor-pointer"
            title="Send direct message / reminder to customer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#E31B23]" />
            <span>Message</span>
          </button>

          <button
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-white dark:bg-[#1F1F1F] text-[#171717] dark:text-white border border-[#E5E5E5] dark:border-[#2A2A2A] text-xs font-black hover:bg-[#FAFAFA] transition-all shadow-xs cursor-pointer"
          >
            <Edit className="w-3.5 h-3.5 text-[#525252] dark:text-[#D4D4D4]" /> Edit
          </button>

          <button
            onClick={() => setIsMergeModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-white dark:bg-[#1F1F1F] text-[#171717] dark:text-white border border-[#E5E5E5] dark:border-[#2A2A2A] text-xs font-black hover:bg-[#FAFAFA] transition-all shadow-xs cursor-pointer"
            title="Merge duplicate customer account into this primary profile"
          >
            <GitMerge className="w-3.5 h-3.5 text-[#E31B23]" /> Merge
          </button>

          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-[#FFF1F2] dark:bg-red-950/30 text-[#DC2626] border border-[#FFD6D8] dark:border-red-900/40 text-xs font-black hover:bg-[#FFE4E6] transition-all shadow-xs cursor-pointer"
            title="Delete or archive customer account"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Customer Master Workspace Hero Banner — Pure White Card */}
      <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] p-4 sm:p-6 rounded-2xl shadow-xs space-y-4 w-full min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 border ${
                customer.customer_type === 'company'
                  ? 'bg-[#FFF1F2] dark:bg-rose-950/40 text-[#E31B23] dark:text-red-400 border-[#FFD6D8] dark:border-red-900/40'
                  : 'bg-[#FAFAFA] dark:bg-[#222222] text-[#171717] dark:text-white border-[#E5E5E5] dark:border-[#333333]'
              }`}
            >
              {customer.customer_type === 'company' ? <Building2 className="w-6 h-6" /> : <User className="w-6 h-6" />}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center text-xs font-mono font-bold text-[#E31B23] dark:text-red-400 bg-[#FFF1F2] dark:bg-rose-950/40 border border-[#FECDD3] dark:border-red-900/40 px-2.5 py-1 rounded-md min-h-[26px] tracking-wide shadow-2xs">
                  {customer.customer_code}
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A] border border-emerald-200/60 uppercase">
                  {customer.customer_type}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#171717] dark:text-white tracking-tight mt-1 truncate">
                {customer.name}
              </h1>
              {customer.company_name && (
                <p className="text-xs font-bold text-[#525252] dark:text-[#D4D4D4] truncate">{customer.company_name}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`tel:${customer.phone}`}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#F0FDF4] text-[#16A34A] hover:bg-[#16A34A] hover:text-white border border-emerald-200/60 text-xs font-black transition-all"
            >
              <PhoneCall className="w-4 h-4" /> Call {customer.phone}
            </a>
          </div>
        </div>

        {/* Address & Contact Bar */}
        <div className="pt-3 border-t border-[#F1F1F1] dark:border-[#262626] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#525252] dark:text-[#D4D4D4] font-semibold">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-[#737373] shrink-0" />
            <span>Primary Phone: {customer.phone}</span>
          </div>
          <div className="flex items-start gap-2 sm:col-span-2">
            <MapPin className="w-4 h-4 text-[#737373] shrink-0 mt-0.5" />
            <span className="break-words">
              Address: {[customer.street, customer.landmark, customer.area1, customer.city || 'Tiruppur', customer.pincode].filter(Boolean).join(', ')}
            </span>
          </div>
        </div>
      </div>

      {/* Financial Overview Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 w-full min-w-0">
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[#737373] mb-1">
            <span className="text-[11px] font-black uppercase text-[#525252] dark:text-[#A3A3A3]">Total Purchases</span>
            <div className="w-8 h-8 rounded-lg bg-[#FAFAFA] dark:bg-[#222] text-[#171717] dark:text-white border border-[#E5E5E5] dark:border-[#333] flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-[#171717] dark:text-white">₹{totalPurchasesAmount.toLocaleString('en-IN')}</p>
        </div>

        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[#737373] mb-1">
            <span className="text-[11px] font-black uppercase text-[#525252] dark:text-[#A3A3A3]">Total Paid</span>
            <div className="w-8 h-8 rounded-lg bg-[#F0FDF4] dark:bg-emerald-950/40 text-[#16A34A] border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-[#16A34A] dark:text-emerald-400">₹{totalPaymentsAmount.toLocaleString('en-IN')}</p>
        </div>

        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[#737373] mb-1">
            <span className="text-[11px] font-black uppercase text-[#525252] dark:text-[#A3A3A3]">Outstanding Due</span>
            <div className="w-8 h-8 rounded-lg bg-[#FFF1F2] dark:bg-rose-950/40 text-[#DC2626] border border-[#FFD6D8] dark:border-red-900/40 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-[#DC2626]">₹{outstandingAmount.toLocaleString('en-IN')}</p>
        </div>

        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[#737373] mb-1">
            <span className="text-[11px] font-black uppercase text-[#525252] dark:text-[#A3A3A3]">Held Deposits</span>
            <div className="w-8 h-8 rounded-lg bg-[#FAFAFA] dark:bg-[#222] text-[#171717] dark:text-white border border-[#E5E5E5] dark:border-[#333] flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-[#171717] dark:text-white">₹{activeDepositsHeld.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Profile Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#F1F1F1] dark:border-[#262626] pb-2 overflow-x-auto scrollbar-none w-full max-w-full text-xs font-extrabold">
        {[
          { id: 'overview', label: 'Overview & Ledger' },
          { id: 'purchases', label: `Purchases (${purchases.length})` },
          { id: 'payments', label: `Payments (${payments.length})` },
          { id: 'documents', label: 'KYC & GST Documents' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`min-h-[40px] px-3.5 sm:px-4 py-2 rounded-xl whitespace-nowrap transition-all border text-xs font-black shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E31B23] ${
              activeTab === tab.id
                ? 'bg-[#FFF1F2] dark:bg-rose-950/50 text-[#E31B23] dark:text-red-400 border-[#FECDD3] dark:border-red-900/60 shadow-2xs'
                : 'bg-white dark:bg-[#1A1A1A] text-[#525252] dark:text-[#D4D4D4] border-[#E5E7EB] dark:border-[#2E2E2E] hover:bg-[#FFF1F2] hover:text-[#E31B23] dark:hover:bg-[#262626] dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Customer Refill & Communication Management Card */}
          <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] p-5 rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F1F1F1] dark:border-[#262626] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FFF1F2] dark:bg-red-950/40 text-[#E31B23] flex items-center justify-center shrink-0 border border-[#FECDD3]">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#111111] dark:text-white">
                    Refill Schedule & Communication Center
                  </h3>
                  <p className="text-[11px] font-semibold text-[#737373]">
                    Automated cylinder replenishment tracking and message dispatch
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/messages?customerId=${customer.id}`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E31B23] hover:bg-[#C9151C] text-white text-xs font-black rounded-xl transition-all shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Refill Reminder</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A]">
                <span className="text-[#737373] text-[10px] uppercase font-bold block mb-1">
                  Last Cylinder Refill
                </span>
                <span className="font-mono font-bold text-[#111111] dark:text-white text-xs">
                  {purchases[0]?.purchase_date || customer.created_at.split('T')[0]}
                </span>
              </div>

              <div className="p-3 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A]">
                <span className="text-[#737373] text-[10px] uppercase font-bold block mb-1">
                  Primary Cylinder
                </span>
                <span className="font-bold text-[#111111] dark:text-white text-xs">
                  {purchases[0]?.items?.[0]?.cylinder_type?.name || '4 kg Domestic'}
                </span>
              </div>

              <div className="p-3 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A]">
                <span className="text-[#737373] text-[10px] uppercase font-bold block mb-1">
                  Opt-In Preferences
                </span>
                <div className="flex flex-wrap gap-1 text-[10px] font-mono font-bold">
                  <span className="text-[#16A34A] bg-[#F0FDF4] px-1.5 py-0.2 rounded border border-emerald-200">
                    WhatsApp: {customer.whatsapp_enabled !== false ? 'ON' : 'OFF'}
                  </span>
                  <span className="text-[#16A34A] bg-[#F0FDF4] px-1.5 py-0.2 rounded border border-emerald-200">
                    SMS: {customer.sms_enabled !== false ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes logger */}
          <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] p-5 rounded-2xl space-y-4">
            <h3 className="text-sm font-black text-[#171717] dark:text-white">Customer Account Notes ({notes.length})</h3>
            <form onSubmit={handleAddNoteSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Log a note or call interaction..."
                className="flex-1 p-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-semibold text-[#171717] dark:text-white placeholder-[#737373] focus:outline-none focus:ring-2 focus:ring-[#E31B23]/20"
              />
              <button
                type="submit"
                disabled={savingNote}
                className="px-4 py-2.5 bg-[#E31B23] hover:bg-[#C9151C] text-white font-black text-xs rounded-[12px] shadow-[0_6px_18px_rgba(227,27,35,0.16)]"
              >
                {savingNote ? 'Saving...' : 'Add Note'}
              </button>
            </form>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notes.map((n) => (
                <div key={n.id} className="p-3 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] text-xs space-y-1">
                  <p className="font-semibold text-[#171717] dark:text-white">{n.note}</p>
                  <span className="text-[10px] text-[#737373] block">{new Date(n.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Purchases List */}
          <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] p-5 rounded-2xl space-y-3">
            <h3 className="text-sm font-black text-[#171717] dark:text-white">Gas Refill Purchases History</h3>
            {purchases.length === 0 ? (
              <p className="text-xs font-semibold text-[#737373]">No gas refill purchases recorded yet.</p>
            ) : (
              <div className="divide-y divide-[#F1F1F1] dark:divide-[#262626]">
                {purchases.map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between text-xs font-semibold">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-[#E31B23]">{p.purchase_code}</span>
                        <Link
                          to={`/billing?saleId=${p.id}`}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-[#E31B23] hover:underline"
                          title="View approved A4 customer bill"
                        >
                          <FileText className="w-3 h-3" /> View Bill
                        </Link>
                      </div>
                      <span className="text-[#525252] dark:text-[#D4D4D4] block text-[11px]">{p.notes || 'Gas refill cylinder delivery'}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-[#171717] dark:text-white block">₹{p.total_gas_amount.toLocaleString('en-IN')}</span>
                      <span className="text-[10px] font-semibold text-[#737373]">{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'purchases' && (
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto w-full max-w-full min-w-0">
            <table className="w-full min-w-[650px] text-left border-collapse text-xs font-semibold">
              <thead>
                <tr className="bg-[#FAFAFA] dark:bg-[#1F1F1F] border-b border-[#E5E5E5] dark:border-[#2A2A2A] font-extrabold text-[#525252] uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Purchase Code</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Total Amount</th>
                  <th className="py-3.5 px-4">Notes</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F1F1] dark:divide-[#262626] text-[#171717] dark:text-[#F5F5F5]">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#737373]">No purchases recorded yet.</td>
                  </tr>
                ) : (
                  purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F]">
                      <td className="py-3.5 px-4 font-mono font-black text-[#E31B23]">{p.purchase_code}</td>
                      <td className="py-3.5 px-4 font-bold">
                        <div className="flex items-center gap-1.5">
                          <span>{p.purchase_date}</span>
                          <button
                            onClick={() => setEditingPurchase(p)}
                            title="Edit purchase date"
                            className="p-1 text-[#737373] hover:text-[#E31B23] hover:bg-[#FFF1F2] dark:hover:bg-red-950/30 rounded-md transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-black text-[#171717] dark:text-white">₹{p.total_gas_amount.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 text-[#737373]">{p.notes || '-'}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/billing?saleId=${p.id}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FFF1F2] dark:bg-red-950/40 border border-[#FECDD3] dark:border-red-900/40 text-[#E31B23] hover:bg-[#E31B23] hover:text-white text-[11px] font-bold rounded-lg transition-colors shadow-2xs"
                            title="View approved A4 customer bill"
                          >
                            <FileText className="w-3 h-3" />
                            <span>View Bill</span>
                          </Link>
                          <button
                            onClick={() => setEditingPurchase(p)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-[#222] border border-[#E5E5E5] dark:border-[#333] hover:border-[#E31B23] text-[#171717] dark:text-white hover:text-[#E31B23] text-[11px] font-bold rounded-lg transition-colors shadow-2xs"
                            title="Edit purchase date"
                          >
                            <Calendar className="w-3 h-3 text-[#E31B23]" />
                            <span>Edit Date</span>
                          </button>
                          <button
                            onClick={() => setDeletingPurchase(p)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-[#222] border border-red-200 dark:border-red-900/40 hover:bg-[#FFF1F2] dark:hover:bg-red-950/30 text-[#DC2626] text-[11px] font-bold rounded-lg transition-colors shadow-2xs"
                            title="Delete purchase record"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto w-full max-w-full min-w-0">
            <table className="w-full min-w-[650px] text-left border-collapse text-xs font-semibold">
              <thead>
                <tr className="bg-[#FAFAFA] dark:bg-[#1F1F1F] border-b border-[#E5E5E5] dark:border-[#2A2A2A] font-extrabold text-[#525252] uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Receipt ID</th>
                  <th className="py-3.5 px-4">Payment Date</th>
                  <th className="py-3.5 px-4">Payment Method</th>
                  <th className="py-3.5 px-4">Amount Paid</th>
                  <th className="py-3.5 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F1F1] dark:divide-[#262626] text-[#171717] dark:text-[#F5F5F5]">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#737373]">No payments recorded yet.</td>
                  </tr>
                ) : (
                  payments.map((py) => (
                    <tr key={py.id} className="hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F]">
                      <td className="py-3.5 px-4 font-mono font-black text-[#16A34A]">RCP-{(py.id || '').slice(0, 8).toUpperCase()}</td>
                      <td className="py-3.5 px-4 font-bold">{py.payment_date}</td>
                      <td className="py-3.5 px-4 capitalize font-bold text-[#525252]">{py.payment_method}</td>
                      <td className="py-3.5 px-4 font-black text-[#16A34A]">₹{py.amount.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 text-[#737373]">{py.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'documents' && <CustomerDocuments customerId={customer.id} />}

      {/* Edit Form Modal */}
      <CustomerFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        customerToEdit={customer}
        onSuccess={loadCustomerData}
      />

      {/* Delete Customer Confirmation Modal */}
      <DeleteCustomerModal
        isOpen={isDeleteModalOpen}
        customer={customer}
        onClose={() => setIsDeleteModalOpen(false)}
        onDeleted={() => {
          navigate('/customers');
        }}
      />

      {/* Merge Duplicate Customer Modal */}
      <MergeCustomerModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        initialPrimaryCustomer={customer}
        onSuccess={() => {
          showSuccess('Duplicate customer successfully merged into this account!');
          loadCustomerData();
        }}
      />

      {/* Edit Purchase Date Modal */}
      <EditPurchaseDateModal
        isOpen={Boolean(editingPurchase)}
        purchase={editingPurchase}
        onClose={() => setEditingPurchase(null)}
        onSuccess={loadCustomerData}
      />

      {/* Delete Purchase Confirmation Modal */}
      <DeletePurchaseModal
        isOpen={Boolean(deletingPurchase)}
        purchase={deletingPurchase}
        onClose={() => setDeletingPurchase(null)}
        onSuccess={(msg) => {
          showSuccess(msg || 'Purchase deleted successfully.');
          loadCustomerData();
        }}
      />
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MessageSquare,
  Send,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Eye,
  Layers,
  Info,
  Phone,
  Mail,
  RefreshCw,
  X,
  FileText,
  Bell,
} from 'lucide-react';
import {
  getCustomerMessageTemplates,
  getCustomerMessageHistory,
  createCustomerCampaign,
  getCustomerReminderCycles,
  sendRefillReminderToCustomer,
  renderTemplateVariables,
} from '../lib/messaging';
import { getCustomers, getCylinderTypes, getAgencySettings } from '../lib/db';
import { AGENCY_BRANDING } from '../lib/constants';
import type {
  Customer,
  CustomerMessage,
  CustomerMessageTemplate,
  CustomerReminderCycle,
  MessageType,
  AgencySettings,
  CylinderType,
} from '../types/database.types';

export const Messages: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get('customerId');
  const initialMode = searchParams.get('mode') || 'composer';

  const [activeTab, setActiveTab] = useState<'composer' | 'reminders' | 'history' | 'templates'>(
    initialMode === 'reminders' ? 'reminders' : 'composer'
  );

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cylinderTypes, setCylinderTypes] = useState<CylinderType[]>([]);
  const [agencySettings, setAgencySettings] = useState<AgencySettings | null>(null);
  const [templates, setTemplates] = useState<CustomerMessageTemplate[]>([]);
  const [history, setHistory] = useState<CustomerMessage[]>([]);
  const [reminderCycles, setReminderCycles] = useState<CustomerReminderCycle[]>([]);

  // Composer State
  const [messageType, setMessageType] = useState<MessageType>('announcement');
  const [channel, setChannel] = useState<'sms' | 'whatsapp' | 'email'>('whatsapp');
  const [audienceFilter, setAudienceFilter] = useState<'all' | 'cylinder' | 'due' | 'selected'>('all');
  const [selectedCylinderId, setSelectedCylinderId] = useState<string>('');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');

  // Modals and notifications
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Reminders Filter
  const [reminderStatusFilter, setReminderStatusFilter] = useState<'all' | 'due' | 'upcoming' | 'overdue'>('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const [custRes, cyls, settings, tmpls, hist, cycles] = await Promise.all([
        getCustomers({ limit: 1000 }),
        getCylinderTypes(),
        getAgencySettings(),
        getCustomerMessageTemplates(),
        getCustomerMessageHistory({ limit: 100 }),
        getCustomerReminderCycles(),
      ]);

      setCustomers(custRes.customers.filter((c) => !c.deleted_at && c.is_active));
      setCylinderTypes(cyls);
      setAgencySettings(settings);
      setTemplates(tmpls);
      setHistory(hist);
      setReminderCycles(cycles);

      if (cyls.length > 0) {
        setSelectedCylinderId(cyls[0].id);
      }

      if (preselectedCustomerId) {
        setSelectedCustomerIds([preselectedCustomerId]);
        setAudienceFilter('selected');
      }
    } catch (e: any) {
      console.error('Failed to load communication data:', e);
      setStatusMessage({ type: 'error', text: 'Error loading messaging data. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [preselectedCustomerId]);

  // Compute Target Audience Customers
  const targetRecipients = useMemo(() => {
    if (audienceFilter === 'all') {
      return customers;
    }
    if (audienceFilter === 'selected') {
      return customers.filter((c) => selectedCustomerIds.includes(c.id));
    }
    if (audienceFilter === 'cylinder') {
      // Find customers matching cylinder
      const matchingCustomerIds = reminderCycles
        .filter((rc) => rc.cylinder_type_id === selectedCylinderId)
        .map((rc) => rc.customer_id);
      return customers.filter((c) => matchingCustomerIds.includes(c.id));
    }
    if (audienceFilter === 'due') {
      const dueCustomerIds = reminderCycles
        .filter((rc) => rc.reminder_status === 'due' || rc.reminder_status === 'overdue')
        .map((rc) => rc.customer_id);
      return customers.filter((c) => dueCustomerIds.includes(c.id));
    }
    return customers;
  }, [customers, audienceFilter, selectedCustomerIds, selectedCylinderId, reminderCycles]);

  // Handle Loading Template
  const handleSelectTemplate = (template: CustomerMessageTemplate) => {
    setMessageType(template.category);
    if (template.subject) setSubject(template.subject);
    setBodyText(template.body);
    setStatusMessage({ type: 'info', text: `Loaded template: "${template.title}"` });
  };

  // Variable chip inserter
  const handleInsertVariable = (variable: string) => {
    setBodyText((prev) => `${prev} {{${variable}}}`);
  };

  // Sample rendered preview
  const sampleRecipient = targetRecipients[0] || customers[0] || {
    id: 'sample',
    name: 'M/s Senthil Textiles',
    customer_code: 'SSG-000001',
    phone: '9876543210',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const renderedPreview = useMemo(() => {
    return renderTemplateVariables(bodyText, {
      customer_name: sampleRecipient?.name || 'Customer Name',
      customer_code: sampleRecipient?.customer_code || 'SSG-000001',
      cylinder_type: '12 kg Commercial',
      last_order_date: '15 Aug 2026',
      next_refill_date: '14 Sep 2026',
      outstanding_balance: 0,
      agency_name: agencySettings?.agency_name || AGENCY_BRANDING.NAME,
      agency_phone: agencySettings?.phone || AGENCY_BRANDING.DEFAULT_PHONE,
    });
  }, [bodyText, sampleRecipient, agencySettings]);

  // Handle Campaign Dispatch
  const handleDispatchCampaign = async () => {
    if (!bodyText.trim()) {
      setStatusMessage({ type: 'error', text: 'Please write message content or select a template.' });
      return;
    }
    if (targetRecipients.length === 0) {
      setStatusMessage({ type: 'error', text: 'No active recipients match your selected audience.' });
      return;
    }

    setActionLoading(true);
    setStatusMessage(null);

    try {
      const res = await createCustomerCampaign({
        message_type: messageType,
        channel,
        subject: channel === 'email' ? subject : undefined,
        bodyTemplate: bodyText,
        recipients: targetRecipients,
      });

      setConfirmModalOpen(false);
      setStatusMessage({
        type: 'success',
        text: `Campaign prepared successfully for ${res.successful} recipients. External provider integration is pending.`,
      });

      // Reload history
      const updatedHistory = await getCustomerMessageHistory({ limit: 100 });
      setHistory(updatedHistory);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to dispatch campaign.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Direct Single Refill Reminder
  const handleSendSingleReminder = async (cycle: CustomerReminderCycle) => {
    if (!cycle.customer) return;
    setActionLoading(true);
    try {
      await sendRefillReminderToCustomer(
        cycle.customer,
        cycle.cylinder_type?.name || 'LPG Cylinder',
        cycle.expected_refill_date,
        cycle.last_refill_date
      );
      setStatusMessage({
        type: 'success',
        text: `Refill reminder prepared for ${cycle.customer.name}.`,
      });
      const updatedHistory = await getCustomerMessageHistory({ limit: 100 });
      setHistory(updatedHistory);
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e.message || 'Failed to send reminder.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Filter Reminder Cycles
  const filteredCycles = useMemo(() => {
    if (reminderStatusFilter === 'all') return reminderCycles;
    if (reminderStatusFilter === 'due') return reminderCycles.filter((c) => c.reminder_status === 'due');
    if (reminderStatusFilter === 'upcoming') return reminderCycles.filter((c) => c.reminder_status === 'upcoming');
    if (reminderStatusFilter === 'overdue') return reminderCycles.filter((c) => c.reminder_status === 'overdue');
    return reminderCycles;
  }, [reminderCycles, reminderStatusFilter]);

  const dueCount = reminderCycles.filter((c) => c.reminder_status === 'due').length;
  const overdueCount = reminderCycles.filter((c) => c.reminder_status === 'overdue').length;
  const upcomingCount = reminderCycles.filter((c) => c.reminder_status === 'upcoming').length;

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FFF1F2] dark:bg-red-950/30 border border-[#FECDD3] dark:border-red-900/40 rounded-full text-[11px] font-black text-[#C9151C] dark:text-red-400 mb-1">
            <MessageSquare className="w-3.5 h-3.5 text-[#E31B23]" />
            <span>COMMUNICATION & REFILL REMINDER CENTER</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111111] dark:text-white tracking-tight">
            Customer Messaging
          </h1>
          <p className="text-xs font-semibold text-[#525252] dark:text-[#A3A3A3]">
            Broadcast announcements, festival greetings, and automate refill reminder cycles.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#1F1F1F] text-[#111111] dark:text-white border border-[#E5E7EB] dark:border-[#2A2A2A] text-xs font-black hover:bg-[#F8FAFC] transition-all shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#E31B23] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Provider Status Information Banner */}
      <div className="p-4 bg-[#F8FAFC] dark:bg-[#1F1F1F] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl flex items-start gap-3 text-xs">
        <Info className="w-4 h-4 text-[#E31B23] shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold text-[#111111] dark:text-white">
            Messaging Engine & Refill Queue Active
          </p>
          <p className="text-[#525252] dark:text-[#A3A3A3]">
            Campaigns, festival greetings, and refill schedules are computed directly from customer purchase histories. External SMS/WhatsApp API gateway connection is intentionally pending in production.
          </p>
        </div>
      </div>

      {/* Status alert notification */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 border ${
            statusMessage.type === 'success'
              ? 'bg-[#F0FDF4] border-emerald-200 text-[#16A34A]'
              : statusMessage.type === 'error'
              ? 'bg-[#FFF1F2] border-[#FECDD3] text-[#DC2626]'
              : 'bg-[#F8FAFC] border-[#E5E7EB] text-[#111111] dark:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="p-1 hover:bg-black/5 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#E5E7EB] dark:border-[#2A2A2A] pb-2">
        <button
          onClick={() => setActiveTab('composer')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'composer'
              ? 'bg-[#E31B23] text-white shadow-xs'
              : 'bg-white dark:bg-[#1F1F1F] text-[#525252] dark:text-[#A3A3A3] hover:text-[#111111] dark:hover:text-white border border-[#E5E7EB] dark:border-[#2A2A2A]'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>New Campaign</span>
        </button>

        <button
          onClick={() => setActiveTab('reminders')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'reminders'
              ? 'bg-[#E31B23] text-white shadow-xs'
              : 'bg-white dark:bg-[#1F1F1F] text-[#525252] dark:text-[#A3A3A3] hover:text-[#111111] dark:hover:text-white border border-[#E5E7EB] dark:border-[#2A2A2A]'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Refill Reminders</span>
          {dueCount + overdueCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'reminders'
                  ? 'bg-white text-[#E31B23]'
                  : 'bg-[#FFF1F2] text-[#E31B23]'
              }`}
            >
              {dueCount + overdueCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'history'
              ? 'bg-[#E31B23] text-white shadow-xs'
              : 'bg-white dark:bg-[#1F1F1F] text-[#525252] dark:text-[#A3A3A3] hover:text-[#111111] dark:hover:text-white border border-[#E5E7EB] dark:border-[#2A2A2A]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Message History ({history.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'templates'
              ? 'bg-[#E31B23] text-white shadow-xs'
              : 'bg-white dark:bg-[#1F1F1F] text-[#525252] dark:text-[#A3A3A3] hover:text-[#111111] dark:hover:text-white border border-[#E5E7EB] dark:border-[#2A2A2A]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Templates ({templates.length})</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: CAMPAIGN COMPOSER */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'composer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Form & Configuration */}
          <div className="lg:col-span-2 space-y-6">
            <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-6 rounded-2xl shadow-xs space-y-5">
              <h2 className="text-sm font-black text-[#111111] dark:text-white uppercase tracking-wider">
                Compose Message
              </h2>

              {/* Message Type Selector */}
              <div>
                <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-2">
                  Message Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'announcement', label: 'Announcement', icon: Bell },
                    { id: 'festival', label: 'Festival Greeting', icon: Sparkles },
                    { id: 'refill_reminder', label: 'Refill Reminder', icon: Clock },
                    { id: 'custom', label: 'Custom Message', icon: MessageSquare },
                  ].map((t) => {
                    const Icon = t.icon;
                    const isSelected = messageType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setMessageType(t.id as MessageType)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-black transition-all ${
                          isSelected
                            ? 'bg-[#FFF1F2] dark:bg-red-950/30 border-[#E31B23] text-[#E31B23]'
                            : 'bg-white dark:bg-[#1F1F1F] border-[#E5E7EB] dark:border-[#2A2A2A] text-[#525252] dark:text-[#A3A3A3] hover:border-[#D1D5DB]'
                        }`}
                      >
                        <Icon className="w-4 h-4 mb-1" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Audience */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4]">
                    Target Audience
                  </label>
                  <span className="text-[11px] font-black text-[#E31B23] bg-[#FFF1F2] dark:bg-red-950/30 px-2 py-0.5 rounded-full border border-[#FECDD3] dark:border-red-900/40">
                    {targetRecipients.length} Recipient{targetRecipients.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {[
                    { id: 'all', label: `All Active (${customers.length})` },
                    { id: 'due', label: `Due Refills (${dueCount + overdueCount})` },
                    { id: 'cylinder', label: 'By Cylinder' },
                    { id: 'selected', label: `Specific (${selectedCustomerIds.length})` },
                  ].map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAudienceFilter(a.id as any)}
                      className={`p-2 rounded-xl border text-xs font-black transition-all ${
                        audienceFilter === a.id
                          ? 'bg-[#111111] dark:bg-white text-white dark:text-[#111111] border-[#111111]'
                          : 'bg-[#F8FAFC] dark:bg-[#1F1F1F] border-[#E5E7EB] dark:border-[#2A2A2A] text-[#525252] dark:text-[#A3A3A3]'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>

                {/* Cylinder Type dropdown if by cylinder */}
                {audienceFilter === 'cylinder' && (
                  <div className="p-3 bg-[#F8FAFC] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A]">
                    <label className="block text-[11px] font-bold text-[#525252] dark:text-[#A3A3A3] mb-1">
                      Select Cylinder Category
                    </label>
                    <select
                      value={selectedCylinderId}
                      onChange={(e) => setSelectedCylinderId(e.target.value)}
                      className="w-full p-2 bg-white dark:bg-[#171717] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-lg text-xs font-black text-[#111111] dark:text-white"
                    >
                      {cylinderTypes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.weight_kg} kg)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Specific Customer Multi-Select Picker */}
                {audienceFilter === 'selected' && (
                  <div className="p-3 bg-[#F8FAFC] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] space-y-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#737373] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        placeholder="Search customers to add..."
                        className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-[#171717] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-lg text-xs font-semibold text-[#111111] dark:text-white"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                      {customers
                        .filter(
                          (c) =>
                            c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                            c.customer_code.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                            c.phone.includes(customerSearchQuery)
                        )
                        .slice(0, 30)
                        .map((c) => {
                          const isSelected = selectedCustomerIds.includes(c.id);
                          return (
                            <label
                              key={c.id}
                              className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-[#262626] rounded-lg cursor-pointer text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedCustomerIds([...selectedCustomerIds, c.id]);
                                    } else {
                                      setSelectedCustomerIds(selectedCustomerIds.filter((id) => id !== c.id));
                                    }
                                  }}
                                  className="w-3.5 h-3.5 rounded text-[#E31B23] focus:ring-[#E31B23]"
                                />
                                <span className="font-bold text-[#111111] dark:text-white">{c.name}</span>
                                <span className="text-[10px] font-mono text-[#737373]">({c.customer_code})</span>
                              </div>
                              <span className="text-[10px] text-[#525252] dark:text-[#A3A3A3]">{c.phone}</span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Delivery Channel */}
              <div>
                <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-2">
                  Delivery Channel
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'whatsapp', label: 'WhatsApp', icon: Phone },
                    { id: 'sms', label: 'SMS Gateway', icon: MessageSquare },
                    { id: 'email', label: 'Email', icon: Mail },
                  ].map((ch) => {
                    const Icon = ch.icon;
                    const isSelected = channel === ch.id;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setChannel(ch.id as any)}
                        className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-black transition-all ${
                          isSelected
                            ? 'bg-[#FFF1F2] dark:bg-red-950/30 border-[#E31B23] text-[#E31B23]'
                            : 'bg-white dark:bg-[#1F1F1F] border-[#E5E7EB] dark:border-[#2A2A2A] text-[#525252] dark:text-[#A3A3A3]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{ch.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Email Subject (if email) */}
              {channel === 'email' && (
                <div>
                  <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Important Service Notification from SRI SS GAS AGENCY"
                    className="w-full px-3 py-2 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#111111] dark:text-white focus:outline-none focus:border-[#E31B23]"
                  />
                </div>
              )}

              {/* Message Body Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4]">
                    Message Content
                  </label>
                  <span className="text-[10px] font-mono text-[#737373]">
                    {bodyText.length} characters
                  </span>
                </div>
                <textarea
                  rows={5}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Type your message text here or pick a template from the right panel. Use {{customer_name}} to personalize."
                  className="w-full p-3 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-medium text-[#111111] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
                />

                {/* Variable insertion buttons */}
                <div className="pt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#737373]">Insert Variable:</span>
                  {[
                    'customer_name',
                    'customer_code',
                    'cylinder_type',
                    'next_refill_date',
                    'agency_phone',
                  ].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleInsertVariable(v)}
                      className="px-2 py-0.5 bg-[#F8FAFC] dark:bg-[#1F1F1F] hover:bg-[#FFF1F2] hover:text-[#E31B23] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded text-[10px] font-mono font-bold text-[#525252] dark:text-[#A3A3A3] transition-colors"
                    >
                      +{v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Action Buttons */}
              <div className="pt-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A] flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white dark:bg-[#1F1F1F] text-[#111111] dark:text-white border border-[#E5E7EB] dark:border-[#2A2A2A] text-xs font-black hover:bg-[#F8FAFC] transition-all shadow-xs"
                >
                  <Eye className="w-3.5 h-3.5 text-[#E31B23]" />
                  <span>Preview Rendered Message</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmModalOpen(true)}
                  disabled={!bodyText.trim() || targetRecipients.length === 0}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#E31B23] hover:bg-[#C9151C] text-white text-xs font-black rounded-xl shadow-[0_6px_18px_rgba(227,27,35,0.14)] transition-all active:scale-98 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>Prepare & Send to {targetRecipients.length} Recipient{targetRecipients.length !== 1 ? 's' : ''}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Pre-Configured Templates & Quick Insert */}
          <div className="space-y-6">
            <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-5 rounded-2xl shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-[#111111] dark:text-white uppercase tracking-wider">
                  Quick Templates
                </h3>
                <span className="text-[10px] font-bold text-[#737373]">
                  {templates.length} available
                </span>
              </div>

              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {templates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="p-3 bg-[#F8FAFC] dark:bg-[#1F1F1F] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl space-y-2 hover:border-[#D1D5DB] transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-black text-[#111111] dark:text-white">
                          {tmpl.title}
                        </h4>
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 bg-[#FFF1F2] dark:bg-red-950/30 text-[#E31B23] rounded border border-[#FECDD3] dark:border-red-900/40">
                          {tmpl.category}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectTemplate(tmpl)}
                        className="px-2 py-1 bg-[#111111] dark:bg-white text-white dark:text-[#111111] text-[10px] font-black rounded-lg hover:scale-105 transition-all shrink-0"
                      >
                        Use Template
                      </button>
                    </div>
                    <p className="text-[11px] text-[#525252] dark:text-[#A3A3A3] line-clamp-2">
                      {tmpl.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: REFILL REMINDERS QUEUE */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'reminders' && (
        <div className="space-y-6">
          {/* Top Quick Filters */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: `All Reminders (${reminderCycles.length})` },
              { id: 'due', label: `Due Today / Soon (${dueCount})` },
              { id: 'overdue', label: `Overdue (${overdueCount})` },
              { id: 'upcoming', label: `Upcoming (${upcomingCount})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setReminderStatusFilter(f.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                  reminderStatusFilter === f.id
                    ? 'bg-[#111111] dark:bg-white text-white dark:text-[#111111]'
                    : 'bg-white dark:bg-[#1F1F1F] text-[#525252] dark:text-[#A3A3A3] border border-[#E5E7EB] dark:border-[#2A2A2A]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Reminders Table */}
          <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] dark:bg-[#1F1F1F] border-b border-[#E5E7EB] dark:border-[#2A2A2A] text-[#525252] dark:text-[#A3A3A3] font-black uppercase text-[10px]">
                  <tr>
                    <th className="p-3.5">Customer</th>
                    <th className="p-3.5">Cylinder Type</th>
                    <th className="p-3.5">Last Refill</th>
                    <th className="p-3.5">Expected Refill</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
                  {filteredCycles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-[#737373]">
                        No refill reminders match this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredCycles.map((cycle) => (
                      <tr key={cycle.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1F1F1F]/60">
                        <td className="p-3.5">
                          <div className="font-black text-[#111111] dark:text-white">
                            {cycle.customer?.name || 'Customer'}
                          </div>
                          <div className="text-[10px] font-mono text-[#737373]">
                            {cycle.customer?.customer_code} • {cycle.customer?.phone}
                          </div>
                        </td>
                        <td className="p-3.5 font-bold text-[#111111] dark:text-white">
                          {cycle.cylinder_type?.name || 'Gas Cylinder'}
                        </td>
                        <td className="p-3.5 text-[#525252] dark:text-[#A3A3A3] font-mono">
                          {cycle.last_refill_date}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-[#111111] dark:text-white">
                          {cycle.expected_refill_date}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              cycle.reminder_status === 'due'
                                ? 'bg-[#FFF1F2] text-[#DC2626] border border-[#FECDD3]'
                                : cycle.reminder_status === 'overdue'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-[#F0FDF4] text-[#16A34A] border border-emerald-200'
                            }`}
                          >
                            {cycle.reminder_status.replace('_', ' ')}
                            {cycle.days_until_refill !== undefined &&
                              ` (${cycle.days_until_refill > 0 ? `in ${cycle.days_until_refill}d` : `${Math.abs(cycle.days_until_refill)}d ago`})`}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => handleSendSingleReminder(cycle)}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#E31B23] hover:bg-[#C9151C] text-white text-[11px] font-black rounded-lg transition-all shadow-xs disabled:opacity-50"
                          >
                            <Send className="w-3 h-3" />
                            <span>Prepare Reminder</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: MESSAGE HISTORY */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'history' && (
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A] flex items-center justify-between">
            <h3 className="text-xs font-black text-[#111111] dark:text-white uppercase tracking-wider">
              Communication Audit Log
            </h3>
            <span className="text-[10px] font-mono text-[#737373]">
              {history.length} records logged
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] dark:bg-[#1F1F1F] border-b border-[#E5E7EB] dark:border-[#2A2A2A] text-[#525252] dark:text-[#A3A3A3] font-black uppercase text-[10px]">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Recipient</th>
                  <th className="p-3.5">Type & Channel</th>
                  <th className="p-3.5">Message Snippet</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-[#737373]">
                      No messages prepared or dispatched yet.
                    </td>
                  </tr>
                ) : (
                  history.map((msg) => (
                    <tr key={msg.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1F1F1F]/60">
                      <td className="p-3.5 font-mono text-[#525252] dark:text-[#A3A3A3] whitespace-nowrap">
                        {new Date(msg.created_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-[#111111] dark:text-white">
                          {msg.recipient_name || msg.customer?.name || 'Customer'}
                        </div>
                        <div className="text-[10px] font-mono text-[#737373]">
                          {msg.recipient_phone || msg.recipient_email}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-[#111111] dark:text-white uppercase text-[10px] block">
                          {msg.message_type.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-[#737373] uppercase font-mono">
                          via {msg.channel}
                        </span>
                      </td>
                      <td className="p-3.5 text-[#525252] dark:text-[#A3A3A3] max-w-xs truncate">
                        {msg.body}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            msg.status === 'pending_provider' || msg.status === 'prepared'
                              ? 'bg-[#FFF1F2] text-[#E31B23] border border-[#FECDD3]'
                              : msg.status === 'sent' || msg.status === 'delivered'
                              ? 'bg-[#F0FDF4] text-[#16A34A] border border-emerald-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {msg.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: TEMPLATES */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-5 rounded-2xl shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-[#111111] dark:text-white">
                    {tmpl.title}
                  </h3>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-[#FFF1F2] text-[#E31B23] rounded-full border border-[#FECDD3]">
                    {tmpl.category}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleSelectTemplate(tmpl);
                    setActiveTab('composer');
                  }}
                  className="px-3 py-1.5 bg-[#E31B23] text-white text-xs font-black rounded-xl hover:bg-[#C9151C] transition-all"
                >
                  Use in Campaign
                </button>
              </div>
              <p className="text-xs text-[#525252] dark:text-[#A3A3A3] whitespace-pre-line leading-relaxed">
                {tmpl.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#2A2A2A] pb-3">
              <h3 className="text-sm font-black text-[#111111] dark:text-white">
                Live Rendered Preview
              </h3>
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-[#262626] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[#F8FAFC] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[#737373]">Sample Recipient:</span>
                <span className="font-bold text-[#111111] dark:text-white">
                  {sampleRecipient.name} ({sampleRecipient.customer_code})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#737373]">Channel:</span>
                <span className="font-mono uppercase font-bold text-[#E31B23]">{channel}</span>
              </div>
            </div>

            {channel === 'email' && subject && (
              <div className="text-xs font-bold text-[#111111] dark:text-white">
                Subject: {subject}
              </div>
            )}

            <div className="p-4 bg-white dark:bg-[#121212] rounded-xl border border-[#D1D5DB] dark:border-[#2A2A2A] text-xs font-medium text-[#111111] dark:text-white whitespace-pre-line leading-relaxed">
              {renderedPreview || 'No message content to preview.'}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="px-4 py-2 bg-[#111111] dark:bg-white text-white dark:text-[#111111] text-xs font-black rounded-xl"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Safety Confirmation Dialog */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="space-y-1">
              <h3 className="text-base font-black text-[#111111] dark:text-white">
                Confirm Campaign Dispatch
              </h3>
              <p className="text-xs text-[#525252] dark:text-[#A3A3A3]">
                Please confirm the campaign details before adding to the dispatch queue.
              </p>
            </div>

            <div className="p-3 bg-[#F8FAFC] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[#737373]">Recipients:</span>
                <span className="font-black text-[#111111] dark:text-white">
                  {targetRecipients.length} customer(s)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#737373]">Channel:</span>
                <span className="font-mono uppercase font-bold text-[#E31B23]">{channel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#737373]">Message Type:</span>
                <span className="font-bold text-[#111111] dark:text-white uppercase text-[10px]">
                  {messageType}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-[#525252] dark:text-[#A3A3A3] hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDispatchCampaign}
                disabled={actionLoading}
                className="px-5 py-2 bg-[#E31B23] hover:bg-[#C9151C] text-white text-xs font-black rounded-xl transition-all shadow-xs disabled:opacity-50"
              >
                {actionLoading ? 'Preparing...' : 'Confirm & Prepare Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

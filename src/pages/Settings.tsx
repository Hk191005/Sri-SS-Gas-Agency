import React, { useState, useEffect } from 'react';
import { getAgencySettings, updateAgencySettings } from '../lib/db';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Settings as SettingsIcon,
  Save,
  Building,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Moon,
  Sun,
  Laptop,
  ShoppingBag,
  Database,
  Clock,
  KeyRound,
  Eye,
  EyeOff,
  Lock,
  SlidersHorizontal,
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [settingsId, setSettingsId] = useState<string | undefined>(undefined);
  const [agencyName, setAgencyName] = useState('SRI SS GAS AGENCY');
  const [subtitle, setSubtitle] = useState('Gas Agency Management System');
  const [phone, setPhone] = useState('+91 9876543210');
  const [email, setEmail] = useState('contact@srissgas.com');
  const [address, setAddress] = useState('Tiruppur District, Tamil Nadu, India');

  // Selling Prices (Customer Refill)
  const [price4kg, setPrice4kg] = useState<number>(650);
  const [price12kg, setPrice12kg] = useState<number>(1700);
  const [price17kg, setPrice17kg] = useState<number>(2552);
  const [price21kg, setPrice21kg] = useState<number>(3152);

  // Buying Prices (Supplier Acquisition Cost)
  const [buyingPrice4kg, setBuyingPrice4kg] = useState<number>(600);
  const [buyingPrice12kg, setBuyingPrice12kg] = useState<number>(1625);
  const [buyingPrice17kg, setBuyingPrice17kg] = useState<number>(2380);
  const [buyingPrice21kg, setBuyingPrice21kg] = useState<number>(2940);

  // Security Deposits (Held Cylinder Liability)
  const [deposit4kg, setDeposit4kg] = useState<number>(1000);
  const [deposit12kg, setDeposit12kg] = useState<number>(2000);
  const [deposit17kg, setDeposit17kg] = useState<number>(2500);
  const [deposit21kg, setDeposit21kg] = useState<number>(3000);

  // Opening Stock Baseline Inventory (Full Cylinders Available Before Transactions)
  const [openingStock4kg, setOpeningStock4kg] = useState<number>(40);
  const [openingStock12kg, setOpeningStock12kg] = useState<number>(150);
  const [openingStock17kg, setOpeningStock17kg] = useState<number>(60);
  const [openingStock21kg, setOpeningStock21kg] = useState<number>(80);

  // Refill Reminder Rules
  const [reminderAutoEnabled, setReminderAutoEnabled] = useState<boolean>(true);
  const [reminderInterval4kg, setReminderInterval4kg] = useState<number>(14);
  const [reminderInterval12kg, setReminderInterval12kg] = useState<number>(30);
  const [reminderInterval17kg, setReminderInterval17kg] = useState<number>(60);
  const [reminderInterval21kg, setReminderInterval21kg] = useState<number>(60);

  const [reminderLeadDays4kg, setReminderLeadDays4kg] = useState<number>(2);
  const [reminderLeadDays12kg, setReminderLeadDays12kg] = useState<number>(3);
  const [reminderLeadDays17kg, setReminderLeadDays17kg] = useState<number>(5);
  const [reminderLeadDays21kg, setReminderLeadDays21kg] = useState<number>(5);

  // Change Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { theme, setTheme } = useTheme();
  const { updatePassword } = useAuth();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getAgencySettings();
      setSettingsId(data.id);
      setAgencyName(data.agency_name || 'SRI SS GAS AGENCY');
      setSubtitle(data.subtitle || 'Gas Agency Management System');
      setPhone(data.phone || '+91 9876543210');
      setEmail(data.email || 'contact@srissgas.com');
      setAddress(data.address || 'Tiruppur District, Tamil Nadu, India');

      // Selling
      setPrice4kg(data.default_price_4kg ?? data.default_price_5kg ?? 650);
      setPrice12kg(data.default_price_12kg ?? 1700);
      setPrice17kg(data.default_price_17kg ?? 2552);
      setPrice21kg(data.default_price_21kg ?? 3152);

      // Buying
      setBuyingPrice4kg(data.default_buying_price_4kg ?? 600);
      setBuyingPrice12kg(data.default_buying_price_12kg ?? 1625);
      setBuyingPrice17kg(data.default_buying_price_17kg ?? 2380);
      setBuyingPrice21kg(data.default_buying_price_21kg ?? 2940);

      // Deposits
      setDeposit4kg(data.default_deposit_4kg ?? 1000);
      setDeposit12kg(data.default_deposit_12kg ?? 2000);
      setDeposit17kg(data.default_deposit_17kg ?? 2500);
      setDeposit21kg(data.default_deposit_21kg ?? 3000);

      // Opening Stock Baseline
      setOpeningStock4kg(data.opening_stock_4kg ?? 40);
      setOpeningStock12kg(data.opening_stock_12kg ?? 150);
      setOpeningStock17kg(data.opening_stock_17kg ?? 60);
      setOpeningStock21kg(data.opening_stock_21kg ?? 80);

      // Reminders
      setReminderAutoEnabled(data.reminder_auto_enabled ?? true);
      setReminderInterval4kg(data.reminder_interval_4kg ?? 14);
      setReminderInterval12kg(data.reminder_interval_12kg ?? 30);
      setReminderInterval17kg(data.reminder_interval_17kg ?? 60);
      setReminderInterval21kg(data.reminder_interval_21kg ?? 60);

      setReminderLeadDays4kg(data.reminder_lead_days_4kg ?? 2);
      setReminderLeadDays12kg(data.reminder_lead_days_12kg ?? 3);
      setReminderLeadDays17kg(data.reminder_lead_days_17kg ?? 5);
      setReminderLeadDays21kg(data.reminder_lead_days_21kg ?? 5);
    } catch (e: any) {
      console.error('Failed to load agency settings', e);
      setErrorMsg(e.message || 'Failed to load settings from database');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const allPrices = [
      price4kg,
      price12kg,
      price17kg,
      price21kg,
      buyingPrice4kg,
      buyingPrice12kg,
      buyingPrice17kg,
      buyingPrice21kg,
      deposit4kg,
      deposit12kg,
      deposit17kg,
      deposit21kg,
    ];

    if (allPrices.some((p) => isNaN(p) || !isFinite(p) || p < 0)) {
      setErrorMsg('All pricing and deposit values must be valid non-negative numbers (₹0 or greater).');
      return;
    }

    const openingStockInputs = [
      { label: '4 kg Domestic Opening Stock', val: openingStock4kg },
      { label: '12 kg Commercial Opening Stock', val: openingStock12kg },
      { label: '17 kg Commercial Opening Stock', val: openingStock17kg },
      { label: '21 kg Industrial Opening Stock', val: openingStock21kg },
    ];

    for (const item of openingStockInputs) {
      if (isNaN(item.val) || !isFinite(item.val) || item.val < 0 || !Number.isInteger(item.val)) {
        setErrorMsg(`${item.label} must be a valid non-negative whole integer.`);
        return;
      }
      if (item.val > 100000) {
        setErrorMsg(`${item.label} cannot exceed 100,000 units.`);
        return;
      }
    }

    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      await updateAgencySettings({
        id: settingsId,
        agency_name: agencyName.trim(),
        subtitle: subtitle.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        default_price_4kg: Number(price4kg),
        default_price_12kg: Number(price12kg),
        default_price_17kg: Number(price17kg),
        default_price_21kg: Number(price21kg),
        default_buying_price_4kg: Number(buyingPrice4kg),
        default_buying_price_12kg: Number(buyingPrice12kg),
        default_buying_price_17kg: Number(buyingPrice17kg),
        default_buying_price_21kg: Number(buyingPrice21kg),
        default_deposit_4kg: Number(deposit4kg),
        default_deposit_12kg: Number(deposit12kg),
        default_deposit_17kg: Number(deposit17kg),
        default_deposit_21kg: Number(deposit21kg),
        opening_stock_4kg: Number(openingStock4kg),
        opening_stock_12kg: Number(openingStock12kg),
        opening_stock_17kg: Number(openingStock17kg),
        opening_stock_21kg: Number(openingStock21kg),
        reminder_auto_enabled: reminderAutoEnabled,
        reminder_interval_4kg: Number(reminderInterval4kg),
        reminder_interval_12kg: Number(reminderInterval12kg),
        reminder_interval_17kg: Number(reminderInterval17kg),
        reminder_interval_21kg: Number(reminderInterval21kg),
        reminder_lead_days_4kg: Number(reminderLeadDays4kg),
        reminder_lead_days_12kg: Number(reminderLeadDays12kg),
        reminder_lead_days_17kg: Number(reminderLeadDays17kg),
        reminder_lead_days_21kg: Number(reminderLeadDays21kg),
      });

      await loadSettings();
      setSuccessMsg('Agency configuration, prices, deposits, opening stock, and refill rules saved successfully!');
      showSuccess('Settings saved and synchronized to database successfully!');
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to save settings');
      showError(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      setPasswordError('Please enter a new password.');
      showError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      showError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match. Please re-enter.');
      showError('New passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const res = await updatePassword(newPassword);
      if (res.error) {
        setPasswordError(res.error);
        showError(res.error);
      } else {
        setPasswordSuccess(res.success || 'Password updated successfully!');
        showSuccess('Admin password updated successfully in Supabase Auth!');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
      showError(err.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#111111] dark:text-white tracking-tight flex items-center gap-2.5">
          <SettingsIcon className="w-7 h-7 text-[#E31B23]" /> Agency Settings & Configuration
        </h1>
        <p className="text-xs font-semibold text-[#525252] dark:text-[#A3A3A3] mt-1">
          Configure agency master profile, default cylinder refilling prices, refill reminder schedules, visual theme and admin security
        </p>
      </div>

      {successMsg && (
        <div className="p-4 bg-[#ECFDF5] border border-emerald-200 text-[#059669] text-xs font-bold rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#059669]" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-[#FFF1F2] border border-[#FECDD3] text-[#DC2626] text-xs font-bold rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626]" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Application Visual Theme */}
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center gap-3 border-b border-[#F1F5F9] dark:border-[#262626] pb-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFFBEB] dark:bg-amber-950/40 text-[#D97706] flex items-center justify-center shrink-0 border border-amber-200/60">
              <Sun className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#111111] dark:text-white">Application Visual Theme</h3>
              <p className="text-[11px] font-semibold text-[#737373]">Customize light mode, dark mode, or follow operating system</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div>
              <p className="text-xs font-bold text-[#111111] dark:text-white">Color Mode Selection</p>
              <p className="text-[11px] font-medium text-[#737373]">Instant real-time theme transition with local state persistence</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 border transition-all ${
                  theme === 'light'
                    ? 'bg-[#FFF1F2] text-[#C9151C] border-[#FECDD3] shadow-2xs'
                    : 'bg-white dark:bg-[#1F1F1F] border-[#E5E7EB] dark:border-[#2A2A2A] text-[#525252] dark:text-[#A3A3A3] hover:bg-[#F8FAFC]'
                }`}
              >
                <Sun className="w-4 h-4 text-[#E31B23]" /> Light
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 border transition-all ${
                  theme === 'dark'
                    ? 'bg-[#FFF1F2] text-[#C9151C] border-[#FECDD3] dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50 shadow-2xs'
                    : 'bg-white dark:bg-[#1F1F1F] border-[#E5E7EB] dark:border-[#2A2A2A] text-[#525252] dark:text-[#A3A3A3] hover:bg-[#F8FAFC]'
                }`}
              >
                <Moon className="w-4 h-4 text-[#E31B23]" /> Dark
              </button>
              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 border transition-all ${
                  theme === 'system'
                    ? 'bg-[#FFF1F2] text-[#C9151C] border-[#FECDD3] shadow-2xs'
                    : 'bg-white dark:bg-[#1F1F1F] border-[#E5E7EB] dark:border-[#2A2A2A] text-[#525252] dark:text-[#A3A3A3] hover:bg-[#F8FAFC]'
                }`}
              >
                <Laptop className="w-4 h-4 text-[#E31B23]" /> System
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Agency Master Profile */}
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center gap-3 border-b border-[#F1F5F9] dark:border-[#262626] pb-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFF1F2] dark:bg-red-950/40 text-[#E31B23] flex items-center justify-center shrink-0 border border-[#FECDD3]">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#111111] dark:text-white">Agency Master Profile</h3>
              <p className="text-[11px] font-semibold text-[#737373]">Official agency identity displayed on customer invoices and reports</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">Agency Name</label>
              <input
                type="text"
                required
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">Subtitle / Tagline</label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-semibold text-[#111111] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">Contact Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#111111] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">Official Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#111111] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">Agency Office Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-semibold text-[#111111] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
            />
          </div>
        </div>

        {/* Section 3: Cylinder Selling Prices (Customer Refill Rates) */}
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center gap-3 border-b border-[#F1F5F9] dark:border-[#262626] pb-3">
            <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] dark:bg-emerald-950/40 text-[#059669] flex items-center justify-center shrink-0 border border-emerald-200/60">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#111111] dark:text-white">Cylinder Selling Prices (₹) — Customer Refill Rates</h3>
              <p className="text-[11px] font-semibold text-[#737373]">Authorized rates charged to customers per refill (used in Sales, Invoices & Add Customer)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">4 kg Domestic</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-black text-[#737373]">₹</span>
                <input
                  type="number"
                  min="0"
                  value={price4kg}
                  onChange={(e) => setPrice4kg(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">12 kg Commercial</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-black text-[#737373]">₹</span>
                <input
                  type="number"
                  min="0"
                  value={price12kg}
                  onChange={(e) => setPrice12kg(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">17 kg Commercial</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-black text-[#737373]">₹</span>
                <input
                  type="number"
                  min="0"
                  value={price17kg}
                  onChange={(e) => setPrice17kg(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">21 kg Industrial</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-black text-[#737373]">₹</span>
                <input
                  type="number"
                  min="0"
                  value={price21kg}
                  onChange={(e) => setPrice21kg(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Cylinder Buying Prices (Supplier Acquisition Cost) */}
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center gap-3 border-b border-[#F1F5F9] dark:border-[#262626] pb-3">
            <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] dark:bg-indigo-950/40 text-[#4F46E5] flex items-center justify-center shrink-0 border border-indigo-200/60">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#111111] dark:text-white">Cylinder Buying Prices (₹) — Supplier Stock Acquisition</h3>
              <p className="text-[11px] font-semibold text-[#737373]">Acquisition cost per cylinder paid to suppliers (used in Supplier Purchases & Stock Inflow)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">4 kg Buying (Domestic)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-black text-[#737373]">₹</span>
                <input
                  type="number"
                  min="0"
                  value={buyingPrice4kg}
                  onChange={(e) => setBuyingPrice4kg(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">12 kg Buying</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-black text-[#737373]">₹</span>
                <input
                  type="number"
                  min="0"
                  value={buyingPrice12kg}
                  onChange={(e) => setBuyingPrice12kg(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">17 kg Buying</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-black text-[#737373]">₹</span>
                <input
                  type="number"
                  min="0"
                  value={buyingPrice17kg}
                  onChange={(e) => setBuyingPrice17kg(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">21 kg Buying</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-black text-[#737373]">₹</span>
                <input
                  type="number"
                  min="0"
                  value={buyingPrice21kg}
                  onChange={(e) => setBuyingPrice21kg(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Default Security Deposits (Held Cylinder Liability) */}
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center gap-3 border-b border-[#F1F5F9] dark:border-[#262626] pb-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFFBEB] dark:bg-amber-950/40 text-[#D97706] flex items-center justify-center shrink-0 border border-amber-200/60">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#111111] dark:text-white">Default Security Deposits (₹) — Held Refundable Deposits</h3>
              <p className="text-[11px] font-semibold text-[#737373]">Held liability against customer cylinders (NEVER included in Gas Sales or Revenue)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">4 kg Deposit</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-black text-[#737373]">₹</span>
                <input
                  type="number"
                  min="0"
                  value={deposit4kg}
                  onChange={(e) => setDeposit4kg(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">12 kg Deposit</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-black text-[#737373]">₹</span>
                <input
                  type="number"
                  min="0"
                  value={deposit12kg}
                  onChange={(e) => setDeposit12kg(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">17 kg Deposit</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-black text-[#737373]">₹</span>
                <input
                  type="number"
                  min="0"
                  value={deposit17kg}
                  onChange={(e) => setDeposit17kg(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">21 kg Deposit</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-black text-[#737373]">₹</span>
                <input
                  type="number"
                  min="0"
                  value={deposit21kg}
                  onChange={(e) => setDeposit21kg(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/10"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 6: Opening Stock Baseline Configuration (Units) */}
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center gap-3 border-b border-[#F1F5F9] dark:border-[#262626] pb-3">
            <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] dark:bg-indigo-950/40 text-[#4F46E5] flex items-center justify-center shrink-0 border border-indigo-200/60">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#111111] dark:text-white">Opening Stock Baseline Configuration (Units)</h3>
              <p className="text-[11px] font-semibold text-[#737373]">Initial full cylinders available before recorded transactions (authoritative warehouse baseline)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">4 kg Domestic (Units)</label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={openingStock4kg}
                onChange={(e) => setOpeningStock4kg(parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">12 kg Commercial (Units)</label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={openingStock12kg}
                onChange={(e) => setOpeningStock12kg(parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">17 kg Commercial (Units)</label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={openingStock17kg}
                onChange={(e) => setOpeningStock17kg(parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">21 kg Industrial (Units)</label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={openingStock21kg}
                onChange={(e) => setOpeningStock21kg(parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10"
              />
            </div>
          </div>
        </div>

        {/* Section 7: Customer Refill Reminder Rules */}
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#F1F5F9] dark:border-[#262626] pb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#FFF1F2] dark:bg-red-950/40 text-[#E31B23] flex items-center justify-center shrink-0 border border-[#FECDD3]">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#111111] dark:text-white">Customer Refill Reminder Rules</h3>
                <p className="text-[11px] font-semibold text-[#737373]">Automatic refill intervals and advance notice lead days</p>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={reminderAutoEnabled}
                onChange={(e) => setReminderAutoEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-[#E31B23] focus:ring-[#E31B23]"
              />
              <span className="text-xs font-bold text-[#111111] dark:text-white">Auto Engine Active</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3 bg-[#F8FAFC] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] space-y-2">
              <span className="font-black text-xs text-[#111111] dark:text-white block">4 kg Domestic</span>
              <div>
                <label className="block text-[10px] font-bold text-[#737373]">Interval (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={reminderInterval4kg}
                  onChange={(e) => setReminderInterval4kg(parseInt(e.target.value) || 14)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#171717] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-lg text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#737373]">Lead Notice (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={reminderLeadDays4kg}
                  onChange={(e) => setReminderLeadDays4kg(parseInt(e.target.value) || 2)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#171717] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-lg text-xs font-bold"
                />
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] space-y-2">
              <span className="font-black text-xs text-[#111111] dark:text-white block">12 kg Commercial</span>
              <div>
                <label className="block text-[10px] font-bold text-[#737373]">Interval (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={reminderInterval12kg}
                  onChange={(e) => setReminderInterval12kg(parseInt(e.target.value) || 30)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#171717] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-lg text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#737373]">Lead Notice (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={reminderLeadDays12kg}
                  onChange={(e) => setReminderLeadDays12kg(parseInt(e.target.value) || 3)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#171717] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-lg text-xs font-bold"
                />
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] space-y-2">
              <span className="font-black text-xs text-[#111111] dark:text-white block">17 kg Commercial</span>
              <div>
                <label className="block text-[10px] font-bold text-[#737373]">Interval (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={reminderInterval17kg}
                  onChange={(e) => setReminderInterval17kg(parseInt(e.target.value) || 60)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#171717] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-lg text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#737373]">Lead Notice (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={reminderLeadDays17kg}
                  onChange={(e) => setReminderLeadDays17kg(parseInt(e.target.value) || 5)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#171717] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-lg text-xs font-bold"
                />
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] space-y-2">
              <span className="font-black text-xs text-[#111111] dark:text-white block">21 kg Industrial</span>
              <div>
                <label className="block text-[10px] font-bold text-[#737373]">Interval (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={reminderInterval21kg}
                  onChange={(e) => setReminderInterval21kg(parseInt(e.target.value) || 60)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#171717] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-lg text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#737373]">Lead Notice (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={reminderLeadDays21kg}
                  onChange={(e) => setReminderLeadDays21kg(parseInt(e.target.value) || 5)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#171717] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-lg text-xs font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 8: Multi-Administrator Access Control */}
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center gap-3 border-b border-[#F1F5F9] dark:border-[#262626] pb-3">
            <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] dark:bg-indigo-950/40 text-[#4F46E5] flex items-center justify-center shrink-0 border border-indigo-200/60">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#111111] dark:text-white">Administrator Access Control</h3>
              <p className="text-[11px] font-semibold text-[#737373]">Authorized administrator accounts with PostgreSQL RLS access</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-[#F8FAFC] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] space-y-1">
              <span className="font-extrabold text-[#E31B23] block text-[11px] uppercase tracking-wider">Administrator 1 (Owner)</span>
              <p className="text-[#111111] dark:text-white font-black text-sm">Harikanth</p>
              <p className="text-[#737373] font-mono text-[11px]">sshk5318@gmail.com</p>
            </div>
            <div className="p-4 bg-[#F8FAFC] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] space-y-1">
              <span className="font-extrabold text-[#E31B23] block text-[11px] uppercase tracking-wider">Administrator 2 (Executive Admin)</span>
              <p className="text-[#111111] dark:text-white font-black text-sm">Selvaraj</p>
              <p className="text-[#737373] font-mono text-[11px]">selvarajkm33@gmail.com</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-[#E31B23] hover:bg-[#C9151C] active:bg-[#A90F16] text-white font-black text-xs px-6 py-3 rounded-[12px] shadow-[0_6px_18px_rgba(227,27,35,0.16)] transition-all disabled:opacity-50 active:scale-98"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving Settings...' : 'Save Settings, Prices, Opening Stock & Rules'}
          </button>
        </div>
      </form>

      {/* Section 9: Change Administrator Password */}
      <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-6 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center gap-3 border-b border-[#F1F5F9] dark:border-[#262626] pb-3">
          <div className="w-8 h-8 rounded-lg bg-[#FFF1F2] dark:bg-red-950/40 text-[#E31B23] flex items-center justify-center shrink-0 border border-[#FECDD3]">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#111111] dark:text-white">Change Account Password</h3>
            <p className="text-[11px] font-semibold text-[#737373]">Update administrator password securely in Supabase Auth</p>
          </div>
        </div>

        {passwordSuccess && (
          <div className="p-3.5 bg-[#F0FDF4] border border-emerald-200 text-[#16A34A] rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16A34A]" />
            <span>{passwordSuccess}</span>
          </div>
        )}

        {passwordError && (
          <div className="p-3.5 bg-[#FFF1F2] border border-[#FECDD3] text-[#DC2626] rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626]" />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#737373] absolute left-3.5 top-3" />
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full pl-10 pr-11 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
                />
                <button
                  type="button"
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-2.5 p-1 text-[#737373] hover:text-[#111111] dark:hover:text-white focus:outline-none"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#525252] dark:text-[#D4D4D4] mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#737373] absolute left-3.5 top-3" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full pl-10 pr-11 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#D1D5DB] dark:border-[#2A2A2A] rounded-xl text-xs font-black text-[#111111] dark:text-white focus:outline-none focus:border-[#E31B23] focus:ring-2 focus:ring-[#E31B23]/10"
                />
                <button
                  type="button"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-2.5 p-1 text-[#737373] hover:text-[#111111] dark:hover:text-white focus:outline-none"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={passwordLoading || !newPassword}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#111111] dark:bg-white text-white dark:text-[#111111] text-xs font-black rounded-xl hover:bg-black dark:hover:bg-slate-100 transition-all disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4" />
              <span>{passwordLoading ? 'Updating...' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

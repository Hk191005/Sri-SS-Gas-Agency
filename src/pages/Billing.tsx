import React, { useState, useEffect } from 'react';
import type { Customer, CylinderType, AgencySettings } from '../types/database.types';
import {
  getCustomers,
  getCylinderTypes,
  getAgencySettings,
  createPurchase,
} from '../lib/db';
import {
  generateCustomerInvoicePdf,
  numberToWordsINR,
  type InvoiceLineItem,
  type InvoiceData,
} from '../lib/invoicePdfExport';
import { useToast } from '../context/ToastContext';
import {
  Receipt,
  FileText,
  Plus,
  Trash2,
  Download,
  CheckCircle2,
  AlertTriangle,
  User,
  Calculator,
  Calendar,
  ShieldCheck,
  Truck,
  Loader2,
} from 'lucide-react';

interface BillingItemRow {
  id: string;
  cylinder_type_id: string;
  description: string;
  hsn: string;
  quantity: number;
  rate: number;
  gstRate: number; // e.g. 18 or 5
}

export const Billing: React.FC = () => {
  const { showSuccess, showError } = useToast();

  // Mode: regular vs gst
  const [billingType, setBillingType] = useState<'regular' | 'gst'>('regular');

  // Master Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cylinderTypes, setCylinderTypes] = useState<CylinderType[]>([]);
  const [agencySettings, setAgencySettings] = useState<AgencySettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Form State - Customer
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCity, setCustomerCity] = useState('Tiruppur');
  const [customerState, setCustomerState] = useState('Tamil Nadu');
  const [customerStateCode, setCustomerStateCode] = useState('33');
  const [customerGstin, setCustomerGstin] = useState('');

  // Form State - Invoice Metadata
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplyDate, setSupplyDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'bank_transfer' | 'credit'>('cash');
  const [notes, setNotes] = useState('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Form State - Line items
  const [items, setItems] = useState<BillingItemRow[]>([]);

  // Execution states
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [savingToDb, setSavingToDb] = useState(false);

  // Initial load
  useEffect(() => {
    loadMasterData();
    generateNextInvoiceNumber();
  }, [billingType]);

  const loadMasterData = async () => {
    setLoading(true);
    try {
      const [custList, types, settings] = await Promise.all([
        getCustomers({ limit: 1000, activeOnly: true }),
        getCylinderTypes(),
        getAgencySettings(),
      ]);

      setCustomers(custList.customers || []);
      setCylinderTypes(types || []);
      setAgencySettings(settings);

      // Default first row
      if (types && types.length > 0 && items.length === 0) {
        const defaultType = types.find((t) => t.weight_kg === 12) || types[0];
        setItems([
          {
            id: 'row-1',
            cylinder_type_id: defaultType.id,
            description: defaultType.name,
            hsn: '27111200',
            quantity: 1,
            rate: defaultType.default_price || 1700,
            gstRate: defaultType.weight_kg <= 5 ? 5 : 18,
          },
        ]);
      }
    } catch (e: any) {
      console.error(e);
      showError('Failed to load customers or cylinder prices: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const generateNextInvoiceNumber = () => {
    const prefix = billingType === 'gst' ? 'GST-INV' : 'BILL';
    const timestamp = Date.now().toString().slice(-6);
    setInvoiceNumber(`${prefix}-${timestamp}`);
  };

  // When a customer is selected from dropdown
  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (!customerId) {
      setCustomerName('');
      setCustomerCompany('');
      setCustomerPhone('');
      setCustomerAddress('');
      setCustomerCity('Tiruppur');
      setCustomerState('Tamil Nadu');
      setCustomerStateCode('33');
      setCustomerGstin('');
      return;
    }

    const c = customers.find((cust) => cust.id === customerId);
    if (c) {
      setCustomerName(c.name);
      setCustomerCompany(c.company_name || '');
      setCustomerPhone(c.phone || '');
      const fullAddr = [c.street, c.area1, c.area2, c.landmark].filter(Boolean).join(', ');
      setCustomerAddress(fullAddr || 'Tiruppur');
      setCustomerCity(c.city || 'Tiruppur');
      setCustomerState('Tamil Nadu');
      setCustomerStateCode('33');
      setCustomerGstin(c.customer_type === 'company' ? '33AAAAA0000A1Z5' : '');
    }
  };

  // Item Row manipulations
  const handleAddItem = () => {
    const defaultType = cylinderTypes[0] || { id: '', name: 'Gas Cylinder Refill', default_price: 1700, weight_kg: 12 };
    setItems([
      ...items,
      {
        id: 'row-' + Date.now(),
        cylinder_type_id: defaultType.id,
        description: defaultType.name,
        hsn: '27111200',
        quantity: 1,
        rate: defaultType.default_price || 1700,
        gstRate: defaultType.weight_kg <= 5 ? 5 : 18,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) {
      showError('An invoice must have at least one line item.');
      return;
    }
    setItems(items.filter((item) => item.id !== id));
  };

  const handleItemCylinderChange = (rowId: string, cylinderTypeId: string) => {
    const matched = cylinderTypes.find((t) => t.id === cylinderTypeId);
    setItems(
      items.map((row) => {
        if (row.id === rowId && matched) {
          return {
            ...row,
            cylinder_type_id: matched.id,
            description: matched.name,
            rate: matched.default_price || 1700,
            gstRate: matched.weight_kg <= 5 ? 5 : 18,
          };
        }
        return row;
      })
    );
  };

  const handleItemFieldChange = (rowId: string, field: keyof BillingItemRow, value: any) => {
    setItems(
      items.map((row) => {
        if (row.id === rowId) {
          return { ...row, [field]: value };
        }
        return row;
      })
    );
  };

  // Calculations
  const isInterState = customerStateCode.trim() !== '33' && customerState.toLowerCase() !== 'tamil nadu';

  const processedItems: InvoiceLineItem[] = items.map((row) => {
    const qty = Math.max(1, Number(row.quantity) || 1);
    const unitRate = Math.max(0, Number(row.rate) || 0);

    if (billingType === 'gst') {
      // For GST, rate is considered the taxable unit rate
      const taxable = qty * unitRate;
      const gstPct = Number(row.gstRate) || 18;
      const totalTax = (taxable * gstPct) / 100;

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isInterState) {
        igst = totalTax;
      } else {
        cgst = totalTax / 2;
        sgst = totalTax / 2;
      }

      return {
        description: row.description || 'Gas Refill',
        cylinder_type_id: row.cylinder_type_id,
        hsn: row.hsn || '27111200',
        quantity: qty,
        rate: unitRate,
        taxableAmount: taxable,
        gstRate: gstPct,
        cgst,
        sgst,
        igst,
        total: taxable + totalTax,
      };
    } else {
      // Regular bill (all-inclusive retail pricing)
      const amount = qty * unitRate;
      return {
        description: row.description || 'Gas Refill',
        cylinder_type_id: row.cylinder_type_id,
        hsn: '27111200',
        quantity: qty,
        rate: unitRate,
        taxableAmount: amount,
        gstRate: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total: amount,
      };
    }
  });

  const rawSubtotal = processedItems.reduce((acc, item) => acc + (billingType === 'gst' ? item.taxableAmount : item.total), 0);
  const totalCgst = processedItems.reduce((acc, item) => acc + item.cgst, 0);
  const totalSgst = processedItems.reduce((acc, item) => acc + item.sgst, 0);
  const totalIgst = processedItems.reduce((acc, item) => acc + item.igst, 0);
  const totalTaxAmount = totalCgst + totalSgst + totalIgst;

  const preRoundGrandTotal = billingType === 'gst'
    ? rawSubtotal + totalTaxAmount - discountAmount
    : rawSubtotal - discountAmount;

  const roundedGrandTotal = Math.round(preRoundGrandTotal);
  const roundOff = Number((roundedGrandTotal - preRoundGrandTotal).toFixed(2));

  // GST Safety Validation Check
  const isGstConfigIncomplete =
    billingType === 'gst' &&
    (!customerName.trim() || items.some((it) => !it.hsn || it.rate <= 0));

  const constructInvoiceData = (): InvoiceData => {
    return {
      invoiceType: billingType,
      invoiceNumber: invoiceNumber.trim() || `${billingType === 'gst' ? 'GST' : 'BILL'}-${Date.now().toString().slice(-6)}`,
      invoiceDate,
      supplyDate,
      vehicleNumber: vehicleNumber.trim() || undefined,
      agencyName: agencySettings?.agency_name || 'SRI SS GAS AGENCY',
      agencyAddress: agencySettings?.address || 'Tiruppur District, Tamil Nadu, India',
      agencyPhone: agencySettings?.phone || '+91 9876543210',
      agencyEmail: agencySettings?.email || 'contact@srissgas.com',
      agencyGstin: '33AAAAA0000A1Z5',
      agencyState: 'Tamil Nadu',
      agencyStateCode: '33',
      customerName: customerName.trim() || 'Valued Customer',
      customerCompany: customerCompany.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      customerCity: customerCity.trim() || 'Tiruppur',
      customerState,
      customerStateCode,
      customerGstin: customerGstin.trim() || undefined,
      items: processedItems,
      subtotal: rawSubtotal,
      discount: discountAmount,
      taxableAmount: rawSubtotal,
      cgstAmount: totalCgst,
      sgstAmount: totalSgst,
      igstAmount: totalIgst,
      totalTax: totalTaxAmount,
      roundOff,
      grandTotal: roundedGrandTotal,
      notes: notes.trim() || undefined,
      paymentMode,
    };
  };

  const handleDownloadPdf = async () => {
    if (!customerName.trim()) {
      showError('Please enter or select a customer name before generating invoice.');
      return;
    }
    if (items.length === 0) {
      showError('Please add at least one item to the invoice.');
      return;
    }

    setGeneratingPdf(true);
    try {
      const invoiceData = constructInvoiceData();
      await generateCustomerInvoicePdf(invoiceData);
      showSuccess(`PDF generated successfully for ${invoiceData.invoiceNumber}`);
    } catch (e: any) {
      console.error(e);
      showError('Failed to generate PDF: ' + e.message);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!selectedCustomerId) {
      showError('Please select a registered customer from the dropdown to record this in database.');
      return;
    }
    if (items.length === 0) {
      showError('Please add at least one cylinder line item.');
      return;
    }

    setSavingToDb(true);
    try {
      await createPurchase({
        customer_id: selectedCustomerId,
        purchase_date: invoiceDate,
        items: items.map((it) => ({
          cylinder_type_id: it.cylinder_type_id,
          quantity: it.quantity,
          unit_price: it.rate,
        })),
        payment_amount: paymentMode === 'credit' ? 0 : roundedGrandTotal,
        payment_method: paymentMode === 'credit' ? 'other' : (paymentMode as any),
        delivery_status: 'delivered',
        notes: `Issued via ${billingType.toUpperCase()} Invoice (${invoiceNumber}). ${notes || ''}`.trim(),
      });

      showSuccess(`Invoice ${invoiceNumber} successfully recorded as a sales transaction in database!`);
    } catch (e: any) {
      console.error(e);
      showError('Failed to record sales invoice: ' + e.message);
    } finally {
      setSavingToDb(false);
    }
  };

  const handleReset = () => {
    generateNextInvoiceNumber();
    setSelectedCustomerId('');
    setCustomerName('');
    setCustomerCompany('');
    setCustomerPhone('');
    setCustomerAddress('');
    setCustomerGstin('');
    setNotes('');
    setDiscountAmount(0);
    if (cylinderTypes.length > 0) {
      const def = cylinderTypes[0];
      setItems([
        {
          id: 'row-1',
          cylinder_type_id: def.id,
          description: def.name,
          hsn: '27111200',
          quantity: 1,
          rate: def.default_price || 1700,
          gstRate: def.weight_kg <= 5 ? 5 : 18,
        },
      ]);
    }
    showSuccess('Invoice form cleared.');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#171717] dark:text-white tracking-tight flex items-center gap-2.5">
            <Receipt className="w-7 h-7 text-[#E31B23]" /> Billing & Invoices
          </h1>
          <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4] mt-1">
            Official customer billing engine for Sri SS Gas Agency. Create Retail Sales Bills and GST Tax Invoices.
          </p>
        </div>

        {/* Billing Type Toggle */}
        <div className="flex items-center bg-[#F5F5F5] dark:bg-[#222] p-1 rounded-2xl border border-[#E5E5E5] dark:border-[#333] shrink-0">
          <button
            onClick={() => setBillingType('regular')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              billingType === 'regular'
                ? 'bg-white dark:bg-[#171717] text-[#E31B23] shadow-xs'
                : 'text-[#737373] hover:text-[#171717] dark:hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Regular Bill</span>
          </button>
          <button
            onClick={() => setBillingType('gst')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              billingType === 'gst'
                ? 'bg-[#E31B23] text-white shadow-xs'
                : 'text-[#737373] hover:text-[#171717] dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>GST Tax Invoice</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-12 text-center rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] text-xs font-semibold text-[#737373]">
          <Loader2 className="w-8 h-8 animate-spin text-[#E31B23] mx-auto mb-2" />
          Loading billing parameters and customer directory...
        </div>
      ) : (
        <>
          {/* GST Validation Alert */}
          {billingType === 'gst' && isGstConfigIncomplete && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">GST configuration is incomplete.</p>
                <p className="text-[11px] mt-0.5 text-amber-700 dark:text-amber-400">
                  Ensure customer name, HSN codes, and taxable rates are specified before generating tax invoices.
                </p>
              </div>
            </div>
          )}

          {/* Main Grid: Form Left (2 Cols) + Summary Right (1 Col) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Form Fields */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Customer Selection & Details */}
          <div className="saas-card bg-white dark:bg-[#171717] p-5 rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F1F1] dark:border-[#262626] pb-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#E31B23]" />
                <h2 className="text-sm font-black text-[#171717] dark:text-white">Customer Details</h2>
              </div>
              <span className="text-[10px] font-bold text-[#737373] uppercase tracking-wider">
                Seller: SRI SS GAS AGENCY
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Dropdown Customer Selector */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-[#525252] dark:text-[#D4D4D4] mb-1">
                  Select Existing Customer (Optional)
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl font-bold text-[#171717] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E31B23]/20"
                >
                  <option value="">-- Choose Registered Customer or Enter Manually --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.customer_code}) {c.company_name ? `· ${c.company_name}` : ''} - {c.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#525252] dark:text-[#D4D4D4] mb-1">
                  Customer / Buyer Name <span className="text-[#E31B23]">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3.5 py-2 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl font-semibold text-[#171717] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E31B23]/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#525252] dark:text-[#D4D4D4] mb-1">
                  Company / Trade Name (Optional)
                </label>
                <input
                  type="text"
                  value={customerCompany}
                  onChange={(e) => setCustomerCompany(e.target.value)}
                  placeholder="e.g. Sri Balaji Textiles"
                  className="w-full px-3.5 py-2 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl font-semibold text-[#171717] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E31B23]/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#525252] dark:text-[#D4D4D4] mb-1">Phone Number</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3.5 py-2 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl font-semibold text-[#171717] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E31B23]/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#525252] dark:text-[#D4D4D4] mb-1">City</label>
                <input
                  type="text"
                  value={customerCity}
                  onChange={(e) => setCustomerCity(e.target.value)}
                  placeholder="Tiruppur"
                  className="w-full px-3.5 py-2 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl font-semibold text-[#171717] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E31B23]/20"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-[#525252] dark:text-[#D4D4D4] mb-1">Delivery Address</label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Street / Landmark / Area"
                  className="w-full px-3.5 py-2 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl font-semibold text-[#171717] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E31B23]/20"
                />
              </div>

              {/* Dynamic GST-Specific Fields */}
              {billingType === 'gst' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-[#525252] dark:text-[#D4D4D4] mb-1">
                      Customer GSTIN
                    </label>
                    <input
                      type="text"
                      value={customerGstin}
                      onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                      placeholder="e.g. 33AAAAA0000A1Z5"
                      className="w-full px-3.5 py-2 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl font-mono uppercase font-semibold text-[#171717] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E31B23]/20"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#525252] dark:text-[#D4D4D4] mb-1">
                      State & State Code
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customerState}
                        onChange={(e) => setCustomerState(e.target.value)}
                        placeholder="Tamil Nadu"
                        className="flex-1 px-3.5 py-2 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl font-semibold text-[#171717] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E31B23]/20"
                      />
                      <input
                        type="text"
                        value={customerStateCode}
                        onChange={(e) => setCustomerStateCode(e.target.value)}
                        placeholder="33"
                        className="w-16 px-2 text-center bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl font-mono font-bold text-[#171717] dark:text-white"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Card 2: Invoice Info & Metadata */}
          <div className="saas-card bg-white dark:bg-[#171717] p-5 rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F1F1] dark:border-[#262626] pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#E31B23]" />
                <h2 className="text-sm font-black text-[#171717] dark:text-white">Invoice Information</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#525252] dark:text-[#D4D4D4] mb-1">
                  Invoice Number <span className="text-[#E31B23]">*</span>
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl font-mono font-black text-[#E31B23] focus:outline-none focus:ring-2 focus:ring-[#E31B23]/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#525252] dark:text-[#D4D4D4] mb-1">
                  Invoice Date <span className="text-[#E31B23]">*</span>
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl font-bold text-[#171717] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E31B23]/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#525252] dark:text-[#D4D4D4] mb-1">Payment Method</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                  className="w-full px-3.5 py-2 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl font-bold text-[#171717] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E31B23]/20"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / GPay / PhonePe</option>
                  <option value="bank_transfer">Bank Transfer / NEFT</option>
                  <option value="credit">Credit (Outstanding)</option>
                </select>
              </div>

              {billingType === 'gst' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-[#525252] dark:text-[#D4D4D4] mb-1">Date of Supply</label>
                    <input
                      type="date"
                      value={supplyDate}
                      onChange={(e) => setSupplyDate(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl font-bold text-[#171717] dark:text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-[#525252] dark:text-[#D4D4D4] mb-1">
                      Transport / Vehicle Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      placeholder="e.g. TN 39 AB 1234"
                      className="w-full px-3.5 py-2 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl font-semibold text-[#171717] dark:text-white"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Card 3: Cylinder Line Items */}
          <div className="saas-card bg-white dark:bg-[#171717] p-5 rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F1F1] dark:border-[#262626] pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#E31B23]" />
                <h2 className="text-sm font-black text-[#171717] dark:text-white">Cylinder Line Items</h2>
              </div>
              <button
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF1F2] dark:bg-red-950/40 text-[#E31B23] hover:bg-[#E31B23] hover:text-white text-xs font-black rounded-xl transition-all border border-[#FECDD3] dark:border-red-900/40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[620px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAFAFA] dark:bg-[#1F1F1F] border-b border-[#E5E5E5] dark:border-[#2A2A2A] font-extrabold text-[#525252] uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Cylinder Item</th>
                    {billingType === 'gst' && <th className="py-2.5 px-3 text-center">HSN</th>}
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                    {billingType === 'gst' && <th className="py-2.5 px-3 text-center">GST %</th>}
                    <th className="py-2.5 px-3 text-right">Total (₹)</th>
                    <th className="py-2.5 px-3 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F1F1] dark:divide-[#262626]">
                  {items.map((row) => {
                    const matchedProc = processedItems.find((p) => p.cylinder_type_id === row.cylinder_type_id) || {
                      total: row.quantity * row.rate,
                    };

                    return (
                      <tr key={row.id}>
                        <td className="py-2.5 px-3">
                          <select
                            value={row.cylinder_type_id}
                            onChange={(e) => handleItemCylinderChange(row.id, e.target.value)}
                            className="w-full px-2 py-1.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg font-bold text-xs"
                          >
                            {cylinderTypes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.weight_kg} kg) - ₹{t.default_price}
                              </option>
                            ))}
                          </select>
                        </td>

                        {billingType === 'gst' && (
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="text"
                              value={row.hsn}
                              onChange={(e) => handleItemFieldChange(row.id, 'hsn', e.target.value)}
                              className="w-20 px-2 py-1.5 text-center bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg font-mono text-xs"
                            />
                          </td>
                        )}

                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={(e) => handleItemFieldChange(row.id, 'quantity', parseInt(e.target.value, 10) || 1)}
                            className="w-16 px-2 py-1.5 text-center bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg font-bold text-xs"
                          />
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={row.rate}
                            onChange={(e) => handleItemFieldChange(row.id, 'rate', parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1.5 text-right bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg font-mono font-bold text-xs"
                          />
                        </td>

                        {billingType === 'gst' && (
                          <td className="py-2.5 px-3 text-center">
                            <select
                              value={row.gstRate}
                              onChange={(e) => handleItemFieldChange(row.id, 'gstRate', parseInt(e.target.value, 10) || 18)}
                              className="px-2 py-1.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg font-bold text-xs text-center"
                            >
                              <option value="5">5% (Domestic)</option>
                              <option value="18">18% (Commercial)</option>
                              <option value="0">0% (Exempt)</option>
                              <option value="12">12%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>
                        )}

                        <td className="py-2.5 px-3 text-right font-black text-sm">
                          ₹{matchedProc.total.toFixed(2)}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleRemoveItem(row.id)}
                            className="p-1.5 text-[#737373] hover:text-[#E31B23] hover:bg-[#FFF1F2] rounded-lg transition-colors"
                            title="Remove Row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Column: Calculation & Actions */}
        <div className="space-y-6">
          <div className="saas-card bg-white dark:bg-[#171717] p-5 rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs space-y-4 sticky top-6">
            <div className="flex items-center gap-2 border-b border-[#F1F1F1] dark:border-[#262626] pb-3">
              <Calculator className="w-4 h-4 text-[#E31B23]" />
              <h2 className="text-sm font-black text-[#171717] dark:text-white">Summary & Totals</h2>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-[#737373]">
                <span>{billingType === 'gst' ? 'Taxable Amount' : 'Subtotal'}:</span>
                <span className="font-mono font-bold text-[#171717] dark:text-white">₹{rawSubtotal.toFixed(2)}</span>
              </div>

              {billingType === 'gst' && (
                <>
                  {!isInterState ? (
                    <>
                      <div className="flex justify-between text-[#737373]">
                        <span>CGST:</span>
                        <span className="font-mono font-bold text-[#171717] dark:text-white">₹{totalCgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[#737373]">
                        <span>SGST:</span>
                        <span className="font-mono font-bold text-[#171717] dark:text-white">₹{totalSgst.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-[#737373]">
                      <span>IGST:</span>
                      <span className="font-mono font-bold text-[#171717] dark:text-white">₹{totalIgst.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-bold text-[#525252] dark:text-[#D4D4D4] pt-1 border-t border-[#F1F1F1] dark:border-[#262626]">
                    <span>Total Tax:</span>
                    <span className="font-mono text-[#E31B23]">₹{totalTaxAmount.toFixed(2)}</span>
                  </div>
                </>
              )}

              {/* Discount */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[#737373]">Discount (₹):</span>
                <input
                  type="number"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-24 px-2 py-1 text-right bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg font-mono font-bold text-xs"
                />
              </div>

              {roundOff !== 0 && (
                <div className="flex justify-between text-[#737373] text-[11px]">
                  <span>Round Off:</span>
                  <span className="font-mono font-bold">{roundOff >= 0 ? '+' : ''}{roundOff.toFixed(2)}</span>
                </div>
              )}

              {/* Grand Total Box */}
              <div className="p-4 bg-[#FFF1F2] dark:bg-red-950/30 rounded-xl border border-[#FECDD3] dark:border-red-900/50 space-y-1">
                <span className="text-[10px] font-black uppercase text-[#E31B23] block tracking-wider">
                  Grand Total
                </span>
                <p className="text-2xl font-black text-[#E31B23] font-mono">
                  ₹{roundedGrandTotal.toLocaleString('en-IN')}
                </p>
              </div>

              {/* Amount in Words */}
              <div className="p-3 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A]">
                <span className="text-[10px] font-bold text-[#737373] uppercase block mb-1">
                  Amount in Words:
                </span>
                <p className="text-[11px] font-bold text-[#171717] dark:text-white italic">
                  {numberToWordsINR(roundedGrandTotal)}
                </p>
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-[11px] font-bold text-[#525252] dark:text-[#D4D4D4] mb-1">
                  Remarks / Terms
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Delivered via Van #2. Cylinders received in good condition."
                  rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-semibold text-[#171717] dark:text-white"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-3 border-t border-[#F1F1F1] dark:border-[#262626]">
              <button
                onClick={handleDownloadPdf}
                disabled={generatingPdf}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#E31B23] hover:bg-[#C9151C] text-white text-xs font-black py-3 px-4 rounded-xl shadow-[0_6px_18px_rgba(227,27,35,0.2)] transition-all active:scale-98 disabled:opacity-50"
              >
                {generatingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating A4 PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download {billingType === 'gst' ? 'GST Invoice' : 'Retail Bill'} PDF</span>
                  </>
                )}
              </button>

              <button
                onClick={handleSaveToDatabase}
                disabled={savingToDb || !selectedCustomerId}
                className="w-full inline-flex items-center justify-center gap-2 bg-white dark:bg-[#1F1F1F] hover:bg-[#FAFAFA] text-[#171717] dark:text-white border border-[#E5E5E5] dark:border-[#2A2A2A] text-xs font-bold py-2.5 px-4 rounded-xl transition-all active:scale-98 disabled:opacity-50"
              >
                {savingToDb ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span>Record in Sales Database</span>
                  </>
                )}
              </button>

              <button
                onClick={handleReset}
                className="w-full text-center text-xs font-bold text-[#737373] hover:text-[#171717] dark:hover:text-white py-1 transition-colors"
              >
                Reset Invoice Form
              </button>
            </div>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
